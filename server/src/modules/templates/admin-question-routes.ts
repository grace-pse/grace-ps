// Per-template question link endpoints. Each AAA template (Asset/Threat/
// Countermeasure) can attach reusable SurveyQuestion rows via a M:N join,
// with optional weight override and rationale. System-package templates
// are read-only — same lock policy as the existing admin-routes editor.

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  templateQuestionLinkUpsertSchema,
  templateQuestionLinkListSchema,
  questionAttachmentsResponseSchema,
} from '../surveys/questions-schema.js';

const uuid = z.string().uuid();
const errorSchema = z.object({ error: z.string() });

type LinkRow = {
  questionId: string;
  weight: number | null;
  sortOrder: number;
  rationale: string | null;
  question: { id: string; prompt: string; type: string; evidenceType: string; defaultWeight: number };
};

function serializeLinks(rows: LinkRow[]) {
  return rows
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.question.prompt.localeCompare(b.question.prompt))
    .map((r) => ({
      questionId: r.questionId,
      prompt: r.question.prompt,
      type: r.question.type as 'yes_no_partial' | 'number' | 'text' | 'select',
      evidenceType: r.question.evidenceType as
        | 'PHYSICAL'
        | 'REMOTE_TECH'
        | 'DOC_REVIEW'
        | 'HYBRID'
        | 'CUSTOM',
      defaultWeight: r.question.defaultWeight,
      weight: r.weight,
      sortOrder: r.sortOrder,
      rationale: r.rationale,
    }));
}

async function assertTemplateEditable(
  kind: 'asset' | 'threat' | 'cm',
  id: string,
  reply: FastifyReply,
): Promise<boolean> {
  const select = { module: { select: { package: { select: { isSystem: true } } } } } as const;
  const row =
    kind === 'asset'
      ? await prisma.assetTemplate.findUnique({ where: { id }, select })
      : kind === 'threat'
        ? await prisma.threatTemplate.findUnique({ where: { id }, select })
        : await prisma.countermeasureTemplate.findUnique({ where: { id }, select });
  if (!row) {
    reply.code(404).send({ error: 'not_found' });
    return false;
  }
  if (row.module.package.isSystem) {
    reply.code(409).send({ error: 'system_package_locked' });
    return false;
  }
  return true;
}

async function assertQuestionVisible(
  questionId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const q = await prisma.surveyQuestion.findFirst({
    where: { id: questionId, isActive: true },
    select: { id: true },
  });
  if (!q) {
    reply.code(404).send({ error: 'question_not_found_or_inactive' });
    return false;
  }
  return true;
}

export default async function templateQuestionRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const auth = [app.authenticate, requirePermission('templates:manage')];

  // ── Asset templates ───────────────────────────────────────
  router.get(
    '/admin/asset-templates/:id/questions',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: templateQuestionLinkListSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const at = await prisma.assetTemplate.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!at) return reply.code(404).send({ error: 'not_found' });
      const rows = await prisma.assetTemplateQuestion.findMany({
        where: { assetTemplateId: req.params.id },
        include: { question: true },
      });
      return reply.send({
        items: serializeLinks(
          rows.map((r) => ({
            questionId: r.questionId,
            weight: r.weight,
            sortOrder: r.sortOrder,
            rationale: r.rationale,
            question: r.question,
          })),
        ),
      });
    },
  );

  router.put(
    '/admin/asset-templates/:id/questions/:questionId',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, questionId: uuid }),
        body: templateQuestionLinkUpsertSchema,
        response: { 200: z.object({ ok: z.literal(true) }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertTemplateEditable('asset', req.params.id, reply))) return;
      if (!(await assertQuestionVisible(req.params.questionId, reply))) return;
      await prisma.assetTemplateQuestion.upsert({
        where: {
          assetTemplateId_questionId: {
            assetTemplateId: req.params.id,
            questionId: req.params.questionId,
          },
        },
        create: {
          assetTemplateId: req.params.id,
          questionId: req.params.questionId,
          weight: req.body.weight ?? null,
          sortOrder: req.body.sortOrder,
          rationale: req.body.rationale ?? null,
        },
        update: {
          weight: req.body.weight ?? null,
          sortOrder: req.body.sortOrder,
          rationale: req.body.rationale ?? null,
        },
      });
      return reply.send({ ok: true } as const);
    },
  );

  router.delete(
    '/admin/asset-templates/:id/questions/:questionId',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, questionId: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertTemplateEditable('asset', req.params.id, reply))) return;
      await prisma.assetTemplateQuestion.deleteMany({
        where: { assetTemplateId: req.params.id, questionId: req.params.questionId },
      });
      return reply.code(204).send(null);
    },
  );

  // ── Threat templates ──────────────────────────────────────
  router.get(
    '/admin/threat-templates/:id/questions',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: templateQuestionLinkListSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const tt = await prisma.threatTemplate.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!tt) return reply.code(404).send({ error: 'not_found' });
      const rows = await prisma.threatTemplateQuestion.findMany({
        where: { threatTemplateId: req.params.id },
        include: { question: true },
      });
      return reply.send({
        items: serializeLinks(
          rows.map((r) => ({
            questionId: r.questionId,
            weight: r.weight,
            sortOrder: r.sortOrder,
            rationale: r.rationale,
            question: r.question,
          })),
        ),
      });
    },
  );

  router.put(
    '/admin/threat-templates/:id/questions/:questionId',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, questionId: uuid }),
        body: templateQuestionLinkUpsertSchema,
        response: { 200: z.object({ ok: z.literal(true) }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertTemplateEditable('threat', req.params.id, reply))) return;
      if (!(await assertQuestionVisible(req.params.questionId, reply))) return;
      await prisma.threatTemplateQuestion.upsert({
        where: {
          threatTemplateId_questionId: {
            threatTemplateId: req.params.id,
            questionId: req.params.questionId,
          },
        },
        create: {
          threatTemplateId: req.params.id,
          questionId: req.params.questionId,
          weight: req.body.weight ?? null,
          sortOrder: req.body.sortOrder,
          rationale: req.body.rationale ?? null,
        },
        update: {
          weight: req.body.weight ?? null,
          sortOrder: req.body.sortOrder,
          rationale: req.body.rationale ?? null,
        },
      });
      return reply.send({ ok: true } as const);
    },
  );

  router.delete(
    '/admin/threat-templates/:id/questions/:questionId',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, questionId: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertTemplateEditable('threat', req.params.id, reply))) return;
      await prisma.threatTemplateQuestion.deleteMany({
        where: { threatTemplateId: req.params.id, questionId: req.params.questionId },
      });
      return reply.code(204).send(null);
    },
  );

  // ── Countermeasure templates ──────────────────────────────
  router.get(
    '/admin/countermeasure-templates/:id/questions',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: templateQuestionLinkListSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const cmt = await prisma.countermeasureTemplate.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!cmt) return reply.code(404).send({ error: 'not_found' });
      const rows = await prisma.countermeasureTemplateQuestion.findMany({
        where: { countermeasureTemplateId: req.params.id },
        include: { question: true },
      });
      return reply.send({
        items: serializeLinks(
          rows.map((r) => ({
            questionId: r.questionId,
            weight: r.weight,
            sortOrder: r.sortOrder,
            rationale: r.rationale,
            question: r.question,
          })),
        ),
      });
    },
  );

  router.put(
    '/admin/countermeasure-templates/:id/questions/:questionId',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, questionId: uuid }),
        body: templateQuestionLinkUpsertSchema,
        response: { 200: z.object({ ok: z.literal(true) }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertTemplateEditable('cm', req.params.id, reply))) return;
      if (!(await assertQuestionVisible(req.params.questionId, reply))) return;
      await prisma.countermeasureTemplateQuestion.upsert({
        where: {
          countermeasureTemplateId_questionId: {
            countermeasureTemplateId: req.params.id,
            questionId: req.params.questionId,
          },
        },
        create: {
          countermeasureTemplateId: req.params.id,
          questionId: req.params.questionId,
          weight: req.body.weight ?? null,
          sortOrder: req.body.sortOrder,
          rationale: req.body.rationale ?? null,
        },
        update: {
          weight: req.body.weight ?? null,
          sortOrder: req.body.sortOrder,
          rationale: req.body.rationale ?? null,
        },
      });
      return reply.send({ ok: true } as const);
    },
  );

  router.delete(
    '/admin/countermeasure-templates/:id/questions/:questionId',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, questionId: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertTemplateEditable('cm', req.params.id, reply))) return;
      await prisma.countermeasureTemplateQuestion.deleteMany({
        where: { countermeasureTemplateId: req.params.id, questionId: req.params.questionId },
      });
      return reply.code(204).send(null);
    },
  );

  // ── Reverse lookup: which AAA templates attach a given question ───
  router.get(
    '/admin/survey-questions/:id/template-attachments',
    {
      onRequest: auth,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: questionAttachmentsResponseSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const q = await prisma.surveyQuestion.findFirst({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!q) return reply.code(404).send({ error: 'not_found' });

      const moduleInclude = { module: { include: { package: true } } } as const;
      const [assetLinks, threatLinks, cmLinks] = await Promise.all([
        prisma.assetTemplateQuestion.findMany({
          where: { questionId: req.params.id },
          include: { assetTemplate: { include: moduleInclude } },
        }),
        prisma.threatTemplateQuestion.findMany({
          where: { questionId: req.params.id },
          include: { threatTemplate: { include: moduleInclude } },
        }),
        prisma.countermeasureTemplateQuestion.findMany({
          where: { questionId: req.params.id },
          include: { countermeasureTemplate: { include: moduleInclude } },
        }),
      ]);

      return reply.send({
        asset: assetLinks
          .map((l) => ({
            templateId: l.assetTemplateId,
            slug: l.assetTemplate.slug,
            name: l.assetTemplate.name,
            moduleName: l.assetTemplate.module.name,
            packageName: l.assetTemplate.module.package.name,
            weight: l.weight,
            sortOrder: l.sortOrder,
            rationale: l.rationale,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        threat: threatLinks
          .map((l) => ({
            templateId: l.threatTemplateId,
            slug: l.threatTemplate.slug,
            name: l.threatTemplate.scenarioName,
            moduleName: l.threatTemplate.module.name,
            packageName: l.threatTemplate.module.package.name,
            weight: l.weight,
            sortOrder: l.sortOrder,
            rationale: l.rationale,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        cm: cmLinks
          .map((l) => ({
            templateId: l.countermeasureTemplateId,
            slug: l.countermeasureTemplate.slug,
            name: l.countermeasureTemplate.name,
            moduleName: l.countermeasureTemplate.module.name,
            packageName: l.countermeasureTemplate.module.package.name,
            weight: l.weight,
            sortOrder: l.sortOrder,
            rationale: l.rationale,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      });
    },
  );
}
