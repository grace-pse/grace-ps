import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

const actionStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED']);
const riskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'HIGHEST']);
const complianceTagEnum = z.enum([
  'ISO_31000', 'NIS2_ART_21', 'NIS2_ART_23', 'CER', 'ASIS_SPC_1', 'ISO_28000',
]);

const actionPlanSchema = z.object({
  id: uuid,
  assessmentId: uuid,
  threatId: uuid,
  riskPriority: riskPriorityEnum,
  actionRequired: z.string(),
  responsiblePerson: z.string().nullable(),
  targetDate: z.string().nullable(),
  status: actionStatusEnum,
  completionDate: z.string().nullable(),
  evidence: z.string().nullable(),
  complianceTags: z.array(complianceTagEnum).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const actionPlanCreateSchema = z.object({
  threatId: uuid,
  actionRequired: z.string().trim().min(1),
  responsiblePerson: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  status: actionStatusEnum.default('PENDING'),
  complianceTags: z.array(complianceTagEnum).optional(),
});

const actionPlanUpdateSchema = z.object({
  actionRequired: z.string().trim().min(1).optional(),
  responsiblePerson: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  status: actionStatusEnum.optional(),
  completionDate: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
  complianceTags: z.array(complianceTagEnum).optional(),
});

function serialize(p: {
  id: string; assessmentId: string; threatId: string; riskPriority: string;
  actionRequired: string; responsiblePerson: string | null;
  targetDate: Date | null; status: string;
  completionDate: Date | null; evidence: string | null;
  complianceTags: string[];
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id,
    assessmentId: p.assessmentId,
    threatId: p.threatId,
    riskPriority: p.riskPriority as z.infer<typeof riskPriorityEnum>,
    actionRequired: p.actionRequired,
    responsiblePerson: p.responsiblePerson,
    targetDate: p.targetDate?.toISOString().slice(0, 10) ?? null,
    status: p.status as z.infer<typeof actionStatusEnum>,
    completionDate: p.completionDate?.toISOString().slice(0, 10) ?? null,
    evidence: p.evidence,
    complianceTags: p.complianceTags as z.infer<typeof complianceTagEnum>[],
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export default async function actionPlanRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/assessments/:id/action-plans',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['action-plans'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: z.object({ items: z.array(actionPlanSchema) }), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId }, select: { id: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const items = await prisma.actionPlan.findMany({
        where: { assessmentId: a.id },
        orderBy: [{ createdAt: 'asc' }],
      });
      return { items: items.map(serialize) };
    },
  );

  router.post(
    '/assessments/:id/action-plans',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['action-plans'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: actionPlanCreateSchema,
        response: { 201: actionPlanSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const a = await prisma.assessment.findFirst({
        where: { id: req.params.id, tenantId }, select: { id: true },
      });
      if (!a) return reply.code(404).send({ error: 'Assessment not found' });

      const threat = await prisma.threat.findFirst({
        where: { id: req.body.threatId, assessmentId: a.id },
        select: { id: true, riskTreatmentPriority: true },
      });
      if (!threat) return reply.code(404).send({ error: 'Threat not found in this assessment' });
      if (!threat.riskTreatmentPriority) {
        return reply.code(400).send({ error: 'Threat has no priority yet — score vulnerability first' });
      }

      const created = await prisma.actionPlan.create({
        data: {
          assessmentId: a.id,
          threatId: threat.id,
          riskPriority: threat.riskTreatmentPriority,
          actionRequired: req.body.actionRequired,
          responsiblePerson: req.body.responsiblePerson ?? null,
          targetDate: req.body.targetDate ? new Date(req.body.targetDate) : null,
          status: req.body.status,
          complianceTags: req.body.complianceTags ?? [],
        },
      });
      return reply.code(201).send(serialize(created));
    },
  );

  router.patch(
    '/action-plans/:planId',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['action-plans'],
        security: [{ bearerAuth: [] }],
        params: z.object({ planId: uuid }),
        body: actionPlanUpdateSchema,
        response: { 200: actionPlanSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.actionPlan.findFirst({
        where: { id: req.params.planId, assessment: { tenantId } },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Action plan not found' });

      const data: Record<string, unknown> = {};
      if (req.body.actionRequired !== undefined) data.actionRequired = req.body.actionRequired;
      if (req.body.responsiblePerson !== undefined) data.responsiblePerson = req.body.responsiblePerson;
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.evidence !== undefined) data.evidence = req.body.evidence;
      if (req.body.targetDate !== undefined) {
        data.targetDate = req.body.targetDate ? new Date(req.body.targetDate) : null;
      }
      if (req.body.completionDate !== undefined) {
        data.completionDate = req.body.completionDate ? new Date(req.body.completionDate) : null;
      }
      if (req.body.complianceTags !== undefined) data.complianceTags = req.body.complianceTags;

      const updated = await prisma.actionPlan.update({
        where: { id: req.params.planId },
        data,
      });
      return serialize(updated);
    },
  );

  router.delete(
    '/action-plans/:planId',
    {
      onRequest: [app.authenticate, requirePermission('assessments:write')],
      schema: {
        tags: ['action-plans'],
        security: [{ bearerAuth: [] }],
        params: z.object({ planId: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.user as JwtPayload;
      const existing = await prisma.actionPlan.findFirst({
        where: { id: req.params.planId, assessment: { tenantId } },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Action plan not found' });
      await prisma.actionPlan.delete({ where: { id: req.params.planId } });
      return reply.code(204).send();
    },
  );
}
