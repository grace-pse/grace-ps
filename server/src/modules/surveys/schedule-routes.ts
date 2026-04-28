// P3 — CRUD for SurveySchedule (gated on `surveys:schedule`).

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { computeNextRun, isValidCron } from './scheduler.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

const scheduleStatusEnum = z.enum(['ACTIVE', 'PAUSED']);

const scheduleSummarySchema = z.object({
  id: z.string().uuid(),
  clusterId: z.string().uuid(),
  clusterName: z.string().nullable(),
  templateId: z.string().uuid(),
  templateName: z.string().nullable(),
  cron: z.string(),
  assignedToId: z.string().uuid(),
  assignedToName: z.string().nullable(),
  status: scheduleStatusEnum,
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  updatedAt: z.string(),
});

const scheduleListSchema = z.object({ items: z.array(scheduleSummarySchema) });

const scheduleCreateSchema = z.object({
  clusterId: uuid,
  templateId: uuid,
  assignedToId: uuid,
  cron: z.string().trim().min(5).max(80),
  status: scheduleStatusEnum.default('ACTIVE'),
});

const scheduleUpdateSchema = scheduleCreateSchema.partial();

const summaryInclude = {
  cluster: { select: { name: true } },
  template: { select: { name: true } },
  assignedTo: { select: { firstName: true, lastName: true } },
};

function summarize(r: {
  id: string;
  clusterId: string;
  templateId: string;
  cron: string;
  assignedToId: string;
  status: 'ACTIVE' | 'PAUSED';
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  updatedAt: Date;
  cluster: { name: string } | null;
  template: { name: string } | null;
  assignedTo: { firstName: string; lastName: string } | null;
}) {
  return {
    id: r.id,
    clusterId: r.clusterId,
    clusterName: r.cluster?.name ?? null,
    templateId: r.templateId,
    templateName: r.template?.name ?? null,
    cron: r.cron,
    assignedToId: r.assignedToId,
    assignedToName: r.assignedTo
      ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}`.trim()
      : null,
    status: r.status,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    nextRunAt: r.nextRunAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export default async function surveyScheduleRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['survey-schedules'],
        summary: 'List schedules for the current tenant',
        security: [{ bearerAuth: [] }],
        response: { 200: scheduleListSchema },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const rows = await prisma.surveySchedule.findMany({
        where: { tenantId },
        include: summaryInclude,
        orderBy: { updatedAt: 'desc' },
      });
      return { items: rows.map(summarize) };
    },
  );

  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('surveys:schedule')],
      schema: {
        tags: ['survey-schedules'],
        summary: 'Create a new survey schedule',
        security: [{ bearerAuth: [] }],
        body: scheduleCreateSchema,
        response: { 201: scheduleSummarySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const body = req.body;

      if (!isValidCron(body.cron)) {
        return reply.code(400).send({ error: `Invalid cron expression: ${body.cron}` });
      }

      const [cluster, template, assignee] = await Promise.all([
        prisma.assetCluster.findFirst({ where: { id: body.clusterId, tenantId }, select: { id: true } }),
        prisma.surveyTemplate.findFirst({
          where: {
            id: body.templateId,
            isActive: true,
            OR: [{ tenantId }, { tenantId: null }],
          },
          select: { id: true },
        }),
        prisma.user.findFirst({ where: { id: body.assignedToId, tenantId, isActive: true }, select: { id: true } }),
      ]);
      if (!cluster) return reply.code(404).send({ error: 'Cluster not found' });
      if (!template) return reply.code(404).send({ error: 'Template not found' });
      if (!assignee) return reply.code(404).send({ error: 'Assignee not found' });

      const nextRunAt = body.status === 'ACTIVE' ? computeNextRun(body.cron) : null;

      const created = await prisma.surveySchedule.create({
        data: {
          tenantId,
          clusterId: body.clusterId,
          templateId: body.templateId,
          assignedToId: body.assignedToId,
          cron: body.cron,
          status: body.status,
          nextRunAt,
        },
        include: summaryInclude,
      });
      return reply.code(201).send(summarize(created));
    },
  );

  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:schedule')],
      schema: {
        tags: ['survey-schedules'],
        summary: 'Update a schedule (pause/resume, change cron, reassign)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: scheduleUpdateSchema,
        response: { 200: scheduleSummarySchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.surveySchedule.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: 'Schedule not found' });

      const patch = req.body;
      if (patch.cron !== undefined && !isValidCron(patch.cron)) {
        return reply.code(400).send({ error: `Invalid cron expression: ${patch.cron}` });
      }

      const nextCron = patch.cron ?? existing.cron;
      const nextStatus = patch.status ?? existing.status;
      const cronChanged = patch.cron !== undefined && patch.cron !== existing.cron;
      const statusChanged = patch.status !== undefined && patch.status !== existing.status;

      let nextRunAt = existing.nextRunAt;
      if (nextStatus === 'PAUSED') {
        nextRunAt = null;
      } else if (cronChanged || statusChanged) {
        nextRunAt = computeNextRun(nextCron);
      }

      const updated = await prisma.surveySchedule.update({
        where: { id: existing.id },
        data: {
          clusterId: patch.clusterId ?? undefined,
          templateId: patch.templateId ?? undefined,
          assignedToId: patch.assignedToId ?? undefined,
          cron: patch.cron ?? undefined,
          status: patch.status ?? undefined,
          nextRunAt,
        },
        include: summaryInclude,
      });
      return summarize(updated);
    },
  );

  router.post(
    '/:id/run-now',
    {
      onRequest: [app.authenticate, requirePermission('surveys:schedule')],
      schema: {
        tags: ['survey-schedules'],
        summary: 'Force the next tick to fire within 60s',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: scheduleSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.surveySchedule.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: 'Schedule not found' });

      const updated = await prisma.surveySchedule.update({
        where: { id: existing.id },
        data: { nextRunAt: new Date(), status: 'ACTIVE' },
        include: summaryInclude,
      });
      return summarize(updated);
    },
  );

  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:schedule')],
      schema: {
        tags: ['survey-schedules'],
        summary: 'Delete a schedule',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.surveySchedule.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: 'Schedule not found' });
      await prisma.surveySchedule.delete({ where: { id: existing.id } });
      return reply.code(204).send();
    },
  );
}
