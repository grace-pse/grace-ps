// P3 — in-process survey scheduler.
//
// Single setInterval fires every 60s, scans survey_schedules for rows
// whose next_run_at <= now(), claims each row with FOR UPDATE SKIP LOCKED,
// inserts an empty DRAFT SurveyResponse + SURVEY_DUE notification, and
// advances next_run_at via croner.nextRun(). Idempotent by schedule_id +
// 10-minute window so a restart mid-tick can't double-fire.

import { Cron } from 'croner';
import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '../../lib/prisma.js';

const TICK_INTERVAL_MS = 60_000;
const OVERDUE_HOURS = 24 * 7; // 7 days
const OVERDUE_SWEEP_HOUR_UTC = 2; // 02:00 UTC nightly sweep

let tickTimer: NodeJS.Timeout | null = null;
let overdueTimer: NodeJS.Timeout | null = null;
let running = false;

export function computeNextRun(cron: string, from: Date = new Date()): Date | null {
  try {
    const job = new Cron(cron, { timezone: 'UTC', paused: true });
    const next = job.nextRun(from);
    return next ?? null;
  } catch {
    return null;
  }
}

export function isValidCron(cron: string): boolean {
  try {
    new Cron(cron, { timezone: 'UTC', paused: true });
    return true;
  } catch {
    return false;
  }
}

async function fireDueSchedules(log: FastifyBaseLogger) {
  const now = new Date();
  const due = await prisma.surveySchedule.findMany({
    where: { status: 'ACTIVE', nextRunAt: { lte: now } },
    select: { id: true },
  });
  if (due.length === 0) return;

  for (const { id: scheduleId } of due) {
    try {
      await prisma.$transaction(async (tx) => {
        // Claim with FOR UPDATE SKIP LOCKED so parallel replicas don't
        // double-fire the same tick.
        const [row] = await tx.$queryRawUnsafe<
          Array<{
            id: string;
            tenant_id: string;
            cluster_id: string;
            template_id: string;
            assigned_to_id: string;
            cron: string;
            next_run_at: Date | null;
          }>
        >(
          `SELECT id, tenant_id, cluster_id, template_id, assigned_to_id, cron, next_run_at
           FROM survey_schedules WHERE id = $1 AND status = 'ACTIVE'
           FOR UPDATE SKIP LOCKED`,
          scheduleId,
        );
        if (!row) return;
        if (!row.next_run_at || row.next_run_at > now) return;

        const firedAt = new Date();
        const tenMinAgo = new Date(firedAt.getTime() - 10 * 60_000);
        const existing = await tx.surveyResponse.findFirst({
          where: { scheduleId: row.id, conductedAt: { gte: tenMinAgo } },
          select: { id: true },
        });

        const template = await tx.surveyTemplate.findUnique({
          where: { id: row.template_id },
          select: {
            id: true, name: true, surveyType: true, requiresPhysical: true, isActive: true,
          },
        });
        if (!template || !template.isActive) {
          // Template was deleted or deactivated — pause the schedule and
          // notify ORG_ADMINs so they can fix it.
          await tx.surveySchedule.update({
            where: { id: row.id },
            data: { status: 'PAUSED', lastRunAt: firedAt },
          });
          await tx.notification.create({
            data: {
              tenantId: row.tenant_id,
              userId: null,
              kind: 'SCHEDULE_NEEDS_TEMPLATE',
              severity: 'WARN',
              title: 'Survey schedule paused: template unavailable',
              body: `Schedule ${row.id} references an inactive or deleted template.`,
              payload: { scheduleId: row.id },
            },
          });
          return;
        }

        const cluster = await tx.assetCluster.findUnique({
          where: { id: row.cluster_id },
          select: { id: true, name: true },
        });

        let surveyId: string | null = existing?.id ?? null;
        if (!existing) {
          const created = await tx.surveyResponse.create({
            data: {
              tenantId: row.tenant_id,
              clusterId: row.cluster_id,
              templateId: row.template_id,
              surveyType: template.surveyType,
              conductedById: row.assigned_to_id,
              conductedAt: firedAt,
              answers: {},
              requiresPhysical: template.requiresPhysical,
              status: 'DRAFT',
              scheduleId: row.id,
            },
            select: { id: true },
          });
          surveyId = created.id;

          await tx.notification.create({
            data: {
              tenantId: row.tenant_id,
              userId: row.assigned_to_id,
              kind: 'SURVEY_DUE',
              severity: 'INFO',
              title: `Survey due: ${template.name} for ${cluster?.name ?? 'cluster'}`,
              body: 'A scheduled survey has opened. Fill it in as soon as possible.',
              payload: {
                scheduleId: row.id,
                surveyResponseId: created.id,
                clusterId: row.cluster_id,
              },
            },
          });
        }

        const nextRunAt = computeNextRun(row.cron, firedAt);
        await tx.surveySchedule.update({
          where: { id: row.id },
          data: {
            lastRunAt: firedAt,
            nextRunAt: nextRunAt ?? null,
          },
        });

        log.info(
          { scheduleId: row.id, surveyId, nextRunAt },
          'survey schedule tick fired',
        );
      });
    } catch (err) {
      log.error({ err, scheduleId }, 'survey schedule tick failed');
    }
  }
}

async function sweepOverdueDrafts(log: FastifyBaseLogger) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - OVERDUE_HOURS * 60 * 60 * 1000);

  const overdue = await prisma.surveyResponse.findMany({
    where: {
      status: 'DRAFT',
      scheduleId: { not: null },
      conductedAt: { lt: cutoff },
    },
    select: {
      id: true, tenantId: true, conductedById: true, clusterId: true, scheduleId: true,
      template: { select: { name: true } },
      cluster: { select: { name: true } },
    },
  });

  for (const row of overdue) {
    // Has a SURVEY_OVERDUE already been sent for this response?
    const already = await prisma.notification.findFirst({
      where: {
        tenantId: row.tenantId,
        kind: 'SURVEY_OVERDUE',
        payload: { path: ['surveyResponseId'], equals: row.id },
      },
      select: { id: true },
    });
    if (already) continue;

    const admins = await prisma.user.findMany({
      where: { tenantId: row.tenantId, role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    const title = `Overdue survey: ${row.template?.name ?? 'survey'} for ${row.cluster?.name ?? 'cluster'}`;
    const body = `A DRAFT survey assigned to a team member is more than 7 days old. Follow up or reassign.`;
    const payload = {
      scheduleId: row.scheduleId,
      surveyResponseId: row.id,
      clusterId: row.clusterId,
    };

    const recipients = new Set<string>([row.conductedById, ...admins.map((a) => a.id)]);
    for (const userId of recipients) {
      await prisma.notification.create({
        data: {
          tenantId: row.tenantId,
          userId,
          kind: 'SURVEY_OVERDUE',
          severity: 'WARN',
          title,
          body,
          payload,
        },
      });
    }
  }

  if (overdue.length > 0) {
    log.info({ overdueCount: overdue.length }, 'overdue DRAFTs swept');
  }
}

export function startSurveyScheduler(log: FastifyBaseLogger) {
  if (running) return;
  running = true;
  log.info({ intervalMs: TICK_INTERVAL_MS }, 'survey scheduler registered');

  const tick = async () => {
    try {
      await fireDueSchedules(log);
    } catch (err) {
      log.error({ err }, 'scheduler fireDueSchedules fatal');
    }
  };

  const overdueTick = async () => {
    const now = new Date();
    if (now.getUTCHours() !== OVERDUE_SWEEP_HOUR_UTC) return;
    try {
      await sweepOverdueDrafts(log);
    } catch (err) {
      log.error({ err }, 'scheduler sweepOverdueDrafts fatal');
    }
  };

  // First tick after a short delay so we don't race the listen() call.
  setTimeout(tick, 5_000);
  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
  // Check hourly — sweep runs only when hour == 02:00 UTC.
  overdueTimer = setInterval(overdueTick, 60 * 60 * 1000);
}

export function stopSurveyScheduler() {
  if (tickTimer) clearInterval(tickTimer);
  if (overdueTimer) clearInterval(overdueTimer);
  tickTimer = null;
  overdueTimer = null;
  running = false;
}

export { fireDueSchedules, sweepOverdueDrafts };
