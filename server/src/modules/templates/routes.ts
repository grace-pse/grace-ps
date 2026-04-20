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

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

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
      const { search, packageSlug, moduleSlug, assetType, category, page, pageSize } = req.query;

      const where: Prisma.AssetTemplateWhereInput = {};
      if (assetType) where.assetType = assetType;
      if (category) where.category = category;
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
}
