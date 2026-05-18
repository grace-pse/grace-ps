// Assessment ↔ SurveyResponse link endpoints. Mounted under
// /api/assessments/:assessmentId/surveys in index.ts. Each mutation
// recomputes the owning assessment's evidence basis so the wizard's
// Step 6 gating stays consistent with the linked survey set.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  assessmentSurveyLinkCreateSchema,
  assessmentSurveyLinkListSchema,
  assessmentSurveyLinkSchema,
} from './schema.js';
import { refreshAssessmentEvidenceBasis } from '../assessments/evidence.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

import type { JwtPayload } from '../../lib/jwt.js';

export default async function assessmentSurveyLinkRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── LIST links for an assessment ─────────────────────────
  router.get(
    '/:assessmentId/surveys',
    {
      onRequest: [app.authenticate, requirePermission('assessments:read')],
      schema: {
        tags: ['assessments'],
        summary: 'List surveys linked to an assessment',
        security: [{ bearerAuth: [] }],
        params: z.object({ assessmentId: uuid }),
        response: { 200: assessmentSurveyLinkListSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const assessment = await prisma.assessment.findFirst({
        where: { id: req.params.assessmentId },
        select: { id: true },
      });
      if (!assessment) return reply.code(404).send({ error: 'Assessment not found' });

      const links = await prisma.assessmentSurvey.findMany({
        where: { assessmentId: assessment.id },
        include: {
          surveyResponse: {
            include: {
              cluster: { select: { name: true } },
              template: { select: { name: true } },
              scope: { select: { name: true } },
            },
          },
          linkedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ linkedAt: 'desc' }],
      });

      const items = links.map((l) => ({
        surveyResponseId: l.surveyResponseId,
        surveyType: l.surveyResponse.surveyType,
        templateName: l.surveyResponse.template?.name ?? l.surveyResponse.scope?.name ?? '(unnamed)',
        clusterName: l.surveyResponse.cluster?.name ?? null,
        status: l.surveyResponse.status,
        rating: l.surveyResponse.rating,
        scorePct:
          l.surveyResponse.scorePct == null ? null : Number(l.surveyResponse.scorePct),
        conductedAt: l.surveyResponse.conductedAt.toISOString(),
        linkedAt: l.linkedAt.toISOString(),
        linkedByName: l.linkedBy
          ? `${l.linkedBy.firstName} ${l.linkedBy.lastName}`.trim()
          : null,
        vulnerabilityOverride: l.vulnerabilityOverride,
      }));
      return { items };
    },
  );

  // ── LINK (create) ────────────────────────────────────────
  router.post(
    '/:assessmentId/surveys',
    {
      onRequest: [app.authenticate, requirePermission('assessments:link_survey')],
      schema: {
        tags: ['assessments'],
        summary: 'Link a survey response to an assessment',
        security: [{ bearerAuth: [] }],
        params: z.object({ assessmentId: uuid }),
        body: assessmentSurveyLinkCreateSchema,
        response: { 201: assessmentSurveyLinkSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;

      const assessment = await prisma.assessment.findFirst({
        where: { id: req.params.assessmentId },
      });
      if (!assessment) return reply.code(404).send({ error: 'Assessment not found' });

      const survey = await prisma.surveyResponse.findFirst({
        where: { id: req.body.surveyResponseId },
      });
      if (!survey) return reply.code(404).send({ error: 'Survey response not found' });

      const existing = await prisma.assessmentSurvey.findUnique({
        where: {
          assessmentId_surveyResponseId: {
            assessmentId: assessment.id,
            surveyResponseId: survey.id,
          },
        },
      });
      if (existing) {
        return reply.code(409).send({ error: 'Survey already linked to this assessment' });
      }

      await prisma.assessmentSurvey.create({
        data: {
          assessmentId: assessment.id,
          surveyResponseId: survey.id,
          linkedById: sub,
          vulnerabilityOverride: req.body.vulnerabilityOverride,
        },
      });

      await refreshAssessmentEvidenceBasis(assessment.id);

      const linkRow = await prisma.assessmentSurvey.findUniqueOrThrow({
        where: {
          assessmentId_surveyResponseId: {
            assessmentId: assessment.id,
            surveyResponseId: survey.id,
          },
        },
        include: {
          surveyResponse: {
            include: {
              cluster: { select: { name: true } },
              template: { select: { name: true } },
              scope: { select: { name: true } },
            },
          },
          linkedBy: { select: { firstName: true, lastName: true } },
        },
      });

      return reply.code(201).send({
        surveyResponseId: linkRow.surveyResponseId,
        surveyType: linkRow.surveyResponse.surveyType,
        templateName:
          linkRow.surveyResponse.template?.name ?? linkRow.surveyResponse.scope?.name ?? '(unnamed)',
        clusterName: linkRow.surveyResponse.cluster?.name ?? null,
        status: linkRow.surveyResponse.status,
        rating: linkRow.surveyResponse.rating,
        scorePct:
          linkRow.surveyResponse.scorePct == null
            ? null
            : Number(linkRow.surveyResponse.scorePct),
        conductedAt: linkRow.surveyResponse.conductedAt.toISOString(),
        linkedAt: linkRow.linkedAt.toISOString(),
        linkedByName: linkRow.linkedBy
          ? `${linkRow.linkedBy.firstName} ${linkRow.linkedBy.lastName}`.trim()
          : null,
        vulnerabilityOverride: linkRow.vulnerabilityOverride,
      });
    },
  );

  // ── UNLINK (delete) ──────────────────────────────────────
  router.delete(
    '/:assessmentId/surveys/:surveyResponseId',
    {
      onRequest: [app.authenticate, requirePermission('assessments:link_survey')],
      schema: {
        tags: ['assessments'],
        summary: 'Unlink a survey from an assessment',
        security: [{ bearerAuth: [] }],
        params: z.object({
          assessmentId: uuid,
          surveyResponseId: uuid,
        }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const assessment = await prisma.assessment.findFirst({
        where: { id: req.params.assessmentId },
        select: { id: true },
      });
      if (!assessment) return reply.code(404).send({ error: 'Assessment not found' });

      const link = await prisma.assessmentSurvey.findUnique({
        where: {
          assessmentId_surveyResponseId: {
            assessmentId: assessment.id,
            surveyResponseId: req.params.surveyResponseId,
          },
        },
      });
      if (!link) return reply.code(404).send({ error: 'Link not found' });

      await prisma.assessmentSurvey.delete({
        where: {
          assessmentId_surveyResponseId: {
            assessmentId: assessment.id,
            surveyResponseId: req.params.surveyResponseId,
          },
        },
      });
      await refreshAssessmentEvidenceBasis(assessment.id);
      return reply.code(204).send();
    },
  );
}
