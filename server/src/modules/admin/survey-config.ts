// Admin survey-config routes (P2). Gated on `surveys:admin` — admins
// configure which SurveyTypes are enabled, their per-asset-type defaults,
// and any custom-type definitions they want on top of the built-in enum.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { getInstanceOrg } from '../../lib/instance-org.js';
import {
  tenantSurveyConfigSchema,
  tenantSurveyConfigUpdateSchema,
  assetTypeSurveyDefaultListSchema,
  assetTypeSurveyDefaultUpsertSchema,
  assetTypeSurveyDefaultSchema,
  surveyTypeSuggestionSchema,
} from './survey-config-schema.js';
import { surveyTypeEnum } from '../surveys/schema.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

// Built-in survey-type codes. Anything in `customTypes` is merged on top.
const BUILTIN_TYPES = ['PHYSICAL', 'REMOTE_TECH', 'DOC_REVIEW', 'HYBRID', 'CUSTOM'] as const;

type CustomTypeLite = {
  code: string;
  name: string;
  description?: string | null;
  requiresPhysical: boolean;
};

function asCustomTypes(raw: unknown): CustomTypeLite[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => ({
      code: String(c.code ?? ''),
      name: String(c.name ?? ''),
      description: typeof c.description === 'string' ? c.description : null,
      requiresPhysical: Boolean(c.requiresPhysical ?? false),
    }))
    .filter((c) => c.code && c.name);
}

type BuiltInOverrideLite = {
  code: 'PHYSICAL' | 'REMOTE_TECH' | 'DOC_REVIEW' | 'HYBRID';
  name?: string;
  description?: string;
  requiresPhysical?: boolean;
};

const OVERRIDABLE_BUILTINS = new Set(['PHYSICAL', 'REMOTE_TECH', 'DOC_REVIEW', 'HYBRID']);

export function asBuiltInOverrides(raw: unknown): BuiltInOverrideLite[] {
  if (!Array.isArray(raw)) return [];
  const byCode = new Map<string, BuiltInOverrideLite>();
  for (const c of raw) {
    if (typeof c !== 'object' || c === null) continue;
    const rec = c as Record<string, unknown>;
    const code = String(rec.code ?? '');
    if (!OVERRIDABLE_BUILTINS.has(code)) continue;
    const entry: BuiltInOverrideLite = { code: code as BuiltInOverrideLite['code'] };
    if (typeof rec.name === 'string' && rec.name.trim()) entry.name = rec.name.trim();
    if (typeof rec.description === 'string' && rec.description.trim()) entry.description = rec.description.trim();
    if (typeof rec.requiresPhysical === 'boolean') entry.requiresPhysical = rec.requiresPhysical;
    // Drop entries that carry no actual override signal.
    if (entry.name === undefined && entry.description === undefined && entry.requiresPhysical === undefined) continue;
    byCode.set(code, entry);
  }
  return [...byCode.values()];
}

export default async function adminSurveyConfigRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /config ───────────────────────────────────────────
  // Auto-creates a default config row on first access so the admin UI
  // can always assume a row exists.
  router.get(
    '/config',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['admin-surveys'],
        summary: 'Get the instance survey config (enabled types + custom types)',
        security: [{ bearerAuth: [] }],
        response: { 200: tenantSurveyConfigSchema },
      },
    },
    async () => {
      const org = await getInstanceOrg();
      let row = await prisma.organizationSurveyConfig.findUnique({
        where: { organizationId: org.id },
      });
      if (!row) {
        row = await prisma.organizationSurveyConfig.create({
          data: {
            organizationId: org.id,
            enabledTypes: [...BUILTIN_TYPES],
            customTypes: [],
            builtInOverrides: [],
          },
        });
      }
      return {
        organizationId: row.organizationId,
        enabledTypes: row.enabledTypes,
        customTypes: asCustomTypes(row.customTypes),
        builtInOverrides: asBuiltInOverrides(row.builtInOverrides),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
  );

  // ── PUT /config ───────────────────────────────────────────
  router.put(
    '/config',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['admin-surveys'],
        summary: 'Update instance survey config',
        security: [{ bearerAuth: [] }],
        body: tenantSurveyConfigUpdateSchema,
        response: { 200: tenantSurveyConfigSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const org = await getInstanceOrg();

      // Materialise custom types into survey_templates (one per custom type) so
      // existing template pickers continue to work without special-casing
      // custom-type codes. We store the code as surveyType='CUSTOM' and keep
      // the real code in the template's name prefix + description.
      const nextCustomTypes = req.body.customTypes?.map((c) => ({
        code: c.code,
        name: c.name,
        description: c.description ?? null,
        requiresPhysical: c.requiresPhysical,
      }));

      // Dedupe builtInOverrides by code (last-write-wins) and sanitise via the
      // same helper used on read, so we never persist rows that carry no
      // actual override signal.
      const nextBuiltInOverrides =
        req.body.builtInOverrides !== undefined
          ? asBuiltInOverrides(req.body.builtInOverrides)
          : undefined;

      const data: Prisma.OrganizationSurveyConfigUpdateInput = {};
      if (req.body.enabledTypes !== undefined) data.enabledTypes = req.body.enabledTypes;
      if (nextCustomTypes !== undefined) {
        data.customTypes = nextCustomTypes as Prisma.InputJsonValue;
      }
      if (nextBuiltInOverrides !== undefined) {
        data.builtInOverrides = nextBuiltInOverrides as Prisma.InputJsonValue;
      }

      const row = await prisma.organizationSurveyConfig.upsert({
        where: { organizationId: org.id },
        update: data,
        create: {
          organizationId: org.id,
          enabledTypes: req.body.enabledTypes ?? [...BUILTIN_TYPES],
          customTypes: (nextCustomTypes ?? []) as Prisma.InputJsonValue,
          builtInOverrides: (nextBuiltInOverrides ?? []) as Prisma.InputJsonValue,
        },
      });

      // For every new custom type that doesn't yet have a materialised
      // starter template, create one.
      if (req.body.customTypes?.length) {
        for (const ct of req.body.customTypes) {
          const existing = await prisma.surveyTemplate.findFirst({
            where: { name: `${ct.code} — Starter` },
          });
          if (existing) continue;
          await prisma.surveyTemplate.create({
            data: {
              name: `${ct.code} — Starter`,
              description: ct.description ?? `Starter template for custom type ${ct.code}`,
              surveyType: 'CUSTOM',
              applicableClusterTypes: [],
              applicableAssetTypes: [],
              requiresPhysical: ct.requiresPhysical,
              isSystem: false,
              isActive: true,
              schema: { questions: ct.starterTemplate.questions } as Prisma.InputJsonValue,
            },
          });
        }
      }

      return reply.code(200).send({
        organizationId: row.organizationId,
        enabledTypes: row.enabledTypes,
        customTypes: asCustomTypes(row.customTypes),
        builtInOverrides: asBuiltInOverrides(row.builtInOverrides),
        updatedAt: row.updatedAt.toISOString(),
      });
    },
  );

  // ── GET /defaults ─────────────────────────────────────────
  router.get(
    '/defaults',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['admin-surveys'],
        summary: 'List per-asset-type survey defaults',
        security: [{ bearerAuth: [] }],
        response: { 200: assetTypeSurveyDefaultListSchema },
      },
    },
    async () => {
      const rows = await prisma.assetTypeSurveyDefault.findMany({
        include: { template: { select: { name: true } } },
        orderBy: [{ assetType: 'asc' }, { surveyType: 'asc' }],
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          assetType: r.assetType,
          surveyType: r.surveyType,
          isDefault: r.isDefault,
          templateId: r.templateId,
          templateName: r.template?.name ?? null,
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    },
  );

  // ── PUT /defaults ─────────────────────────────────────────
  // Upsert by (assetType, surveyType). If isDefault=true, clear any other
  // rows of the same assetType so there is at most one default per asset
  // type.
  router.put(
    '/defaults',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['admin-surveys'],
        summary: 'Upsert an asset-type survey default',
        security: [{ bearerAuth: [] }],
        body: assetTypeSurveyDefaultUpsertSchema,
        response: { 200: assetTypeSurveyDefaultSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      if (req.body.templateId) {
        const t = await prisma.surveyTemplate.findFirst({
          where: { id: req.body.templateId },
        });
        if (!t) return reply.code(404).send({ error: 'Template not found' });
      }

      const row = await prisma.$transaction(async (tx) => {
        if (req.body.isDefault) {
          await tx.assetTypeSurveyDefault.updateMany({
            where: { assetType: req.body.assetType, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.assetTypeSurveyDefault.upsert({
          where: {
            assetType_surveyType: {
              assetType: req.body.assetType,
              surveyType: req.body.surveyType,
            },
          },
          update: {
            isDefault: req.body.isDefault,
            templateId: req.body.templateId ?? null,
          },
          create: {
            assetType: req.body.assetType,
            surveyType: req.body.surveyType,
            isDefault: req.body.isDefault,
            templateId: req.body.templateId ?? null,
          },
          include: { template: { select: { name: true } } },
        });
      });

      return reply.code(200).send({
        id: row.id,
        assetType: row.assetType,
        surveyType: row.surveyType,
        isDefault: row.isDefault,
        templateId: row.templateId,
        templateName: row.template?.name ?? null,
        updatedAt: row.updatedAt.toISOString(),
      });
    },
  );

  // ── DELETE /defaults/:id ──────────────────────────────────
  router.delete(
    '/defaults/:id',
    {
      onRequest: [app.authenticate, requirePermission('surveys:admin')],
      schema: {
        tags: ['admin-surveys'],
        summary: 'Remove an asset-type survey default',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema },
      },
    },
    async (req, reply) => {
      const existing = await prisma.assetTypeSurveyDefault.findFirst({
        where: { id: req.params.id },
      });
      if (!existing) return reply.code(404).send({ error: 'Default not found' });
      await prisma.assetTypeSurveyDefault.delete({ where: { id: existing.id } });
      return reply.code(204).send();
    },
  );

  // ── GET /suggest?clusterId=... ────────────────────────────
  // Upgraded from the P1 naive PHYSICAL fallback. Picks the default for
  // the majority asset type in the cluster; falls back to PHYSICAL if
  // nothing is configured yet.
  router.get(
    '/suggest',
    {
      onRequest: [app.authenticate, requirePermission('surveys:read')],
      schema: {
        tags: ['admin-surveys'],
        summary: 'Suggest a survey type + template for a cluster',
        security: [{ bearerAuth: [] }],
        querystring: z.object({ clusterId: uuid }),
        response: { 200: surveyTypeSuggestionSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const cluster = await prisma.assetCluster.findFirst({
        where: { id: req.query.clusterId },
        include: {
          memberships: { include: { asset: { select: { assetType: true } } } },
        },
      });
      if (!cluster) return reply.code(404).send({ error: 'Cluster not found' });

      // Majority vote on member asset types.
      const counts = new Map<string, number>();
      for (const m of cluster.memberships) {
        const at = m.asset?.assetType;
        if (!at) continue;
        counts.set(at, (counts.get(at) ?? 0) + 1);
      }
      const topAssetType = [...counts.entries()]
        .sort(([, a], [, b]) => b - a)[0]?.[0];

      if (topAssetType) {
        const def = await prisma.assetTypeSurveyDefault.findFirst({
          where: {
            assetType: topAssetType as Prisma.AssetTypeSurveyDefaultWhereInput['assetType'],
            isDefault: true,
          },
          include: { template: { select: { name: true } } },
        });
        if (def) {
          return {
            surveyType: def.surveyType,
            templateId: def.templateId,
            templateName: def.template?.name ?? null,
            reason: 'ASSET_TYPE_DEFAULT' as const,
          };
        }
      }

      // Naive fallback
      return {
        surveyType: 'PHYSICAL' as const,
        templateId: null,
        templateName: null,
        reason: 'FALLBACK' as const,
      };
    },
  );
}
