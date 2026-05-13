import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  assessmentInclude, toAssessmentSummary, toThreatSummary,
  type AssessmentWithRelations,
} from './serializers.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

// Reasons written by auto-capture hooks. Manual snapshots use 'MANUAL_SAVE'
// (a free-form user note is captured on the row as well via the `note` field
// on the payload; see captureSnapshot signature).
const SNAPSHOT_REASONS = [
  'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED', 'MANUAL_SAVE',
  'STEP_ADVANCED', 'THREAT_ADDED', 'THREAT_REMOVED',
  'RECOMMENDATION_ADDED', 'METADATA_UPDATED',
] as const;
const snapshotReasonEnum = z.enum(SNAPSHOT_REASONS);

const snapshotSummarySchema = z.object({
  id: uuid,
  assessmentId: uuid,
  capturedAt: z.string().datetime(),
  capturedById: uuid,
  capturedByName: z.string().nullable(),
  reason: snapshotReasonEnum,
  note: z.string().nullable(),
});

const snapshotDetailSchema = snapshotSummarySchema.extend({
  payload: z.unknown(),
});

// Internal payload shape — mirrors AssessmentDetail so the History UI can
// diff snapshots with the live detail using identical keys.
type SnapshotPayload = {
  assessment: ReturnType<typeof toAssessmentSummary> & {
    reviewedById: string | null;
    reviewNotes: string | null;
  };
  threats: ReturnType<typeof toThreatSummary>[];
  actionPlans: {
    id: string;
    threatId: string;
    riskPriority: string;
    actionRequired: string;
    responsiblePerson: string | null;
    targetDate: string | null;
    status: string;
    completionDate: string | null;
    evidence: string | null;
    complianceTags: string[];
  }[];
};

export async function captureSnapshot(opts: {
  assessmentId: string;
  capturedById: string;
  reason: (typeof SNAPSHOT_REASONS)[number];
  note?: string | null;
}): Promise<void> {
  const a = await prisma.assessment.findUnique({
    where: { id: opts.assessmentId },
    include: assessmentInclude,
  });
  if (!a) return;

  const threats = await prisma.threat.findMany({
    where: { assessmentId: a.id },
    include: { targetAsset: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: 'asc' }],
  });
  const actionPlans = await prisma.actionPlan.findMany({
    where: { assessmentId: a.id },
    orderBy: [{ createdAt: 'asc' }],
  });

  const summary = toAssessmentSummary({
    ...a,
    threats: a.threats.map((t) => ({ id: t.id, riskTreatmentPriority: t.riskTreatmentPriority })),
  } as AssessmentWithRelations);

  const payload: SnapshotPayload = {
    assessment: {
      ...summary,
      reviewedById: a.reviewedById,
      reviewNotes: a.reviewNotes,
    },
    threats: threats.map(toThreatSummary),
    actionPlans: actionPlans.map((p) => ({
      id: p.id,
      threatId: p.threatId,
      riskPriority: p.riskPriority,
      actionRequired: p.actionRequired,
      responsiblePerson: p.responsiblePerson,
      targetDate: p.targetDate?.toISOString().slice(0, 10) ?? null,
      status: p.status,
      completionDate: p.completionDate?.toISOString().slice(0, 10) ?? null,
      evidence: p.evidence,
      complianceTags: p.complianceTags,
    })),
  };

  await prisma.assessmentSnapshot.create({
    data: {
      assessmentId: opts.assessmentId,
      capturedById: opts.capturedById,
      reason: opts.reason,
      payload: {
        ...payload,
        note: opts.note ?? null,
      } as Prisma.InputJsonValue,
    },
  });
}

type SnapshotRow = Prisma.AssessmentSnapshotGetPayload<{
  include: { capturedBy: { select: { id: true; firstName: true; lastName: true } } };
}>;

function serializeSummary(s: SnapshotRow) {
  const p = s.payload as Record<string, unknown> | null;
  const name = s.capturedBy
    ? `${s.capturedBy.firstName} ${s.capturedBy.lastName}`.trim()
    : null;
  return {
    id: s.id,
    assessmentId: s.assessmentId,
    capturedAt: s.capturedAt.toISOString(),
    capturedById: s.capturedById,
    capturedByName: name,
    reason: s.reason as (typeof SNAPSHOT_REASONS)[number],
    note: (p && typeof p['note'] === 'string' ? (p['note'] as string) : null),
  };
}

export default async function snapshotsRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST ─────────────────────────────────────────────────
  router.get(
    '/:id/snapshots',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['snapshots'],
        summary: 'List snapshots for an assessment (newest first)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: {
          200: z.object({ items: z.array(snapshotSummarySchema) }),
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId }, select: { id: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const rows = await prisma.assessmentSnapshot.findMany({
        where: { assessmentId: a.id },
        include: { capturedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ capturedAt: 'desc' }],
      });
      return { items: rows.map(serializeSummary) };
    },
  );

  // ── DETAIL ───────────────────────────────────────────────
  router.get(
    '/:id/snapshots/:snapshotId',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['snapshots'],
        summary: 'Fetch one snapshot with its full captured payload',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, snapshotId: uuid }),
        response: { 200: snapshotDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId }, select: { id: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const s = await prisma.assessmentSnapshot.findFirst({
        where: { id: req.params.snapshotId, assessmentId: a.id },
        include: { capturedBy: { select: { id: true, firstName: true, lastName: true } } },
      });
      if (!s) return reply.code(404).send({ error: 'Snapshot not found' });

      return { ...serializeSummary(s), payload: s.payload };
    },
  );

  // ── MANUAL SAVE ──────────────────────────────────────────
  router.post(
    '/:id/snapshots',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['snapshots'],
        summary: 'Capture a manual snapshot of the current assessment state',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: z.object({
          note: z.string().trim().min(1).max(200),
        }),
        response: { 201: snapshotSummarySchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId, sub } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId }, select: { id: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      await captureSnapshot({
        assessmentId: a.id,
        capturedById: sub,
        reason: 'MANUAL_SAVE',
        note: req.body.note,
      });

      const latest = await prisma.assessmentSnapshot.findFirst({
        where: { assessmentId: a.id },
        include: { capturedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ capturedAt: 'desc' }],
      });
      if (!latest) return reply.code(404).send({ error: 'Snapshot vanished' });
      return reply.code(201).send(serializeSummary(latest));
    },
  );
}
