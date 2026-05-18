import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  templateListQuerySchema,
  templateListResponseSchema,
  assetTemplateDetailSchema,
  packageListResponseSchema,
  moduleListResponseSchema,
} from './schema.js';
import {
  countermeasureTemplateListQuerySchema,
  countermeasureTemplateListResponseSchema,
  countermeasureTemplateDetailSchema,
  threatCountermeasureListResponseSchema,
} from './countermeasure-schema.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

function cmTemplateSummary(t: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  shapeCategory: string;
  ppsFunctions: string[];
  domain: string;
  defaultTearStrategy: string | null;
  defaultEffectiveness: string | null;
  typicalCostEstimate: unknown;
  typicalAnnualCost: unknown;
  tags: string[];
  csmpUnitReference: string | null;
  module: { id: string; slug: string; name: string; package: { id: string; slug: string; name: string } };
}) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    shapeCategory: t.shapeCategory as never,
    ppsFunctions: t.ppsFunctions as never,
    domain: t.domain as never,
    defaultTearStrategy: t.defaultTearStrategy as never,
    defaultEffectiveness: t.defaultEffectiveness as never,
    typicalCostEstimate: t.typicalCostEstimate != null ? Number(t.typicalCostEstimate) : null,
    typicalAnnualCost: t.typicalAnnualCost != null ? Number(t.typicalAnnualCost) : null,
    tags: t.tags,
    csmpUnitReference: t.csmpUnitReference,
    module: {
      id: t.module.id,
      slug: t.module.slug,
      name: t.module.name,
      package: {
        id: t.module.package.id,
        slug: t.module.package.slug,
        name: t.module.package.name,
      },
    },
  };
}

export default async function templateRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // ── List packages (Banking & Finance, Healthcare, etc.) ─
  router.get(
    '/packages',
    {
      onRequest: [app.authenticate, requirePermission('templates:read')],
      schema: {
        tags: ['templates'],
        summary: 'List template packages',
        security: [{ bearerAuth: [] }],
        response: { 200: packageListResponseSchema },
      },
    },
    async () => {
      const packages = await prisma.templatePackage.findMany({
        orderBy: [{ name: 'asc' }],
        include: {
          modules: {
            include: { _count: { select: { assetTemplates: true } } },
          },
        },
      });

      return {
        items: packages.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          industry: p.industry,
          version: p.version,
          description: p.description,
          complianceRefs: p.complianceRefs,
          enabled: p.enabled,
          moduleCount: p.modules.length,
          assetTemplateCount: p.modules.reduce((sum, m) => sum + m._count.assetTemplates, 0),
        })),
      };
    },
  );

  // ── List modules in a package ───────────────────────────
  router.get(
    '/packages/:slug/modules',
    {
      onRequest: [app.authenticate, requirePermission('templates:read')],
      schema: {
        tags: ['templates'],
        security: [{ bearerAuth: [] }],
        params: z.object({ slug: z.string() }),
        response: { 200: moduleListResponseSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const pkg = await prisma.templatePackage.findUnique({
        where: { slug: req.params.slug },
        include: {
          modules: {
            orderBy: [{ sortOrder: 'asc' }],
            include: { _count: { select: { assetTemplates: true } } },
          },
        },
      });
      if (!pkg) return reply.code(404).send({ error: 'Package not found' });

      return {
        package: {
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.name,
          industry: pkg.industry,
          version: pkg.version,
          description: pkg.description,
          complianceRefs: pkg.complianceRefs,
          enabled: pkg.enabled,
          moduleCount: pkg.modules.length,
          assetTemplateCount: pkg.modules.reduce((sum, m) => sum + m._count.assetTemplates, 0),
        },
        items: pkg.modules.map((m) => ({
          id: m.id,
          slug: m.slug,
          name: m.name,
          description: m.description,
          icon: m.icon,
          sortOrder: m.sortOrder,
          assetTemplateCount: m._count.assetTemplates,
        })),
      };
    },
  );

  // ── List asset templates (the main browsable library) ──
  router.get(
    '/asset-templates',
    {
      onRequest: [app.authenticate, requirePermission('templates:read')],
      schema: {
        tags: ['templates'],
        summary: 'Browse asset templates',
        security: [{ bearerAuth: [] }],
        querystring: templateListQuerySchema,
        response: { 200: templateListResponseSchema },
      },
    },
    async (req) => {
      const { search, packageSlug, moduleSlug, assetType, category, enabledOnly, page, pageSize } = req.query;

      const where: Prisma.AssetTemplateWhereInput = {};
      if (assetType) where.assetType = assetType;
      if (category) where.category = category;
      // The asset-form subtype picker passes enabledOnly=true so disabled
      // packages drop out of the list. Admin tooling can pass false to see
      // everything (including templates from packages they're about to fork).
      const moduleFilter: Prisma.TemplateModuleWhereInput = {};
      if (moduleSlug) moduleFilter.slug = moduleSlug;
      if (packageSlug || enabledOnly) {
        moduleFilter.package = {
          ...(packageSlug ? { slug: packageSlug } : {}),
          ...(enabledOnly ? { enabled: true } : {}),
        };
      }
      if (Object.keys(moduleFilter).length > 0) where.module = moduleFilter;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.assetTemplate.findMany({
          where,
          include: {
            module: { include: { package: true } },
          },
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.assetTemplate.count({ where }),
      ]);

      return {
        items: items.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          assetType: t.assetType,
          category: t.category,
          defaultCriticality: t.defaultCriticality,
          defaultAssetRole: t.defaultAssetRole,
          description: t.description,
          tags: t.tags,
          module: {
            id: t.module.id,
            slug: t.module.slug,
            name: t.module.name,
            package: {
              id: t.module.package.id,
              slug: t.module.package.slug,
              name: t.module.package.name,
              enabled: t.module.package.enabled,
            },
          },
        })),
        total,
        page,
        pageSize,
      };
    },
  );

  // ── Asset template detail (with recommended threats) ───
  router.get(
    '/asset-templates/:id',
    {
      onRequest: [app.authenticate, requirePermission('templates:read')],
      schema: {
        tags: ['templates'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: assetTemplateDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const t = await prisma.assetTemplate.findUnique({
        where: { id: req.params.id },
        include: {
          module: { include: { package: true } },
          recommendedThreats: { include: { threatTemplate: true } },
        },
      });
      if (!t) return reply.code(404).send({ error: 'Template not found' });

      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        assetType: t.assetType,
        category: t.category,
        defaultCriticality: t.defaultCriticality,
        defaultAssetRole: t.defaultAssetRole,
        description: t.description,
        tags: t.tags,
        parentSlug: t.parentSlug,
        attributes: t.attributes as Record<string, unknown> | null,
        module: {
          id: t.module.id,
          slug: t.module.slug,
          name: t.module.name,
          package: {
            id: t.module.package.id,
            slug: t.module.package.slug,
            name: t.module.package.name,
            enabled: t.module.package.enabled,
          },
        },
        recommendedThreats: t.recommendedThreats.map((r) => ({
          relevance: r.relevance,
          rationale: r.rationale,
          threatTemplate: {
            id: r.threatTemplate.id,
            slug: r.threatTemplate.slug,
            scenarioName: r.threatTemplate.scenarioName,
            adversaryType: r.threatTemplate.adversaryType,
            actionType: r.threatTemplate.actionType,
          },
        })),
      };
    },
  );

  // ── List countermeasure templates (browsable library) ──
  router.get(
    '/countermeasure-templates',
    {
      onRequest: [app.authenticate, requirePermission('templates:read')],
      schema: {
        tags: ['templates'],
        summary: 'Browse countermeasure templates',
        security: [{ bearerAuth: [] }],
        querystring: countermeasureTemplateListQuerySchema,
        response: { 200: countermeasureTemplateListResponseSchema },
      },
    },
    async (req) => {
      const { search, packageSlug, moduleSlug, shapeCategory, domain, ppsFunction, page, pageSize } =
        req.query;

      const where: Prisma.CountermeasureTemplateWhereInput = {};
      if (shapeCategory) where.shapeCategory = shapeCategory;
      if (domain) where.domain = domain;
      if (ppsFunction) where.ppsFunctions = { has: ppsFunction };
      if (moduleSlug || packageSlug) {
        where.module = {
          ...(moduleSlug ? { slug: moduleSlug } : {}),
          ...(packageSlug ? { package: { slug: packageSlug } } : {}),
        };
      }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.countermeasureTemplate.findMany({
          where,
          include: { module: { include: { package: true } } },
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.countermeasureTemplate.count({ where }),
      ]);

      return {
        items: items.map(cmTemplateSummary),
        total,
        page,
        pageSize,
      };
    },
  );

  // ── Countermeasure template detail (+ threat links) ────
  router.get(
    '/countermeasure-templates/:id',
    {
      onRequest: [app.authenticate, requirePermission('templates:read')],
      schema: {
        tags: ['templates'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: countermeasureTemplateDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const t = await prisma.countermeasureTemplate.findUnique({
        where: { id: req.params.id },
        include: {
          module: { include: { package: true } },
          threatLinks: { include: { threatTemplate: true } },
        },
      });
      if (!t) return reply.code(404).send({ error: 'Template not found' });

      return {
        ...cmTemplateSummary(t),
        threatLinks: t.threatLinks.map((l) => ({
          relevance: l.relevance,
          rationale: l.rationale,
          threatTemplate: {
            id: l.threatTemplate.id,
            slug: l.threatTemplate.slug,
            scenarioName: l.threatTemplate.scenarioName,
            adversaryType: l.threatTemplate.adversaryType,
            actionType: l.threatTemplate.actionType,
          },
        })),
      };
    },
  );

  // ── Countermeasure templates recommended for a threat ──
  router.get(
    '/threat-templates/:id/countermeasures',
    {
      onRequest: [app.authenticate, requirePermission('templates:read')],
      schema: {
        tags: ['templates'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: threatCountermeasureListResponseSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const threat = await prisma.threatTemplate.findUnique({ where: { id: req.params.id } });
      if (!threat) return reply.code(404).send({ error: 'Threat template not found' });

      const links = await prisma.threatTemplateCountermeasure.findMany({
        where: { threatTemplateId: req.params.id },
        include: {
          countermeasureTemplate: { include: { module: { include: { package: true } } } },
        },
        orderBy: [{ relevance: 'asc' }],
      });

      return {
        items: links.map((l) => ({
          relevance: l.relevance,
          rationale: l.rationale,
          countermeasureTemplate: cmTemplateSummary(l.countermeasureTemplate),
        })),
      };
    },
  );
}
