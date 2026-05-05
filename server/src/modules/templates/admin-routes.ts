import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import {
  packageCreateSchema,
  packageUpdateSchema,
  moduleCreateSchema,
  moduleUpdateSchema,
  assetTemplateCreateSchema,
  assetTemplateUpdateSchema,
  threatTemplateCreateSchema,
  threatTemplateUpdateSchema,
  countermeasureTemplateCreateSchema,
  countermeasureTemplateUpdateSchema,
  junctionUpsertSchema,
  onConflictSchema,
  adminPackageSchema,
  adminPackageWithTreeSchema,
  adminModuleDetailSchema,
  packageBundleEnvelopeSchema,
  moduleEnvelopeSchema,
  assetTemplateEnvelopeSchema,
  threatTemplateEnvelopeSchema,
  countermeasureTemplateEnvelopeSchema,
  importResultSchema,
  assetTemplateExportSchema,
  threatTemplateExportSchema,
  countermeasureTemplateExportSchema,
  moduleExportSchema,
  packageBundleContentSchema,
} from './admin-schema.js';
import {
  serializeAssetTemplate,
  serializeThreatTemplate,
  serializeCountermeasureTemplate,
  serializePackage,
  serializeModule,
  envelope,
  packageBundle,
  nextAvailableSlug,
} from './export.js';

const uuid = z.string().uuid();
const errorSchema = z.object({ error: z.string() });

function decimalOrNull(v: number | null | undefined): Prisma.Decimal | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return new (require('@prisma/client/runtime/library').Decimal as new (v: number) => Prisma.Decimal)(v);
}

// Prisma treats JS `null` on a nullable JSON column as "do not change".
// To write a SQL NULL we need the sentinel `Prisma.JsonNull`. This helper
// translates `null | undefined | object` → the correct Prisma input.
function jsonOrDbNull(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (v == null) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}

// Fastify-side helper: reject writes against a system package with 409.
async function assertPackageEditable(packageId: string, reply: FastifyReply): Promise<boolean> {
  const pkg = await prisma.templatePackage.findUnique({ where: { id: packageId }, select: { isSystem: true } });
  if (!pkg) {
    reply.code(404).send({ error: 'package_not_found' });
    return false;
  }
  if (pkg.isSystem) {
    reply.code(409).send({ error: 'system_package_locked' });
    return false;
  }
  return true;
}

async function assertModuleEditable(moduleId: string, reply: FastifyReply): Promise<boolean> {
  const m = await prisma.templateModule.findUnique({
    where: { id: moduleId },
    select: { package: { select: { id: true, isSystem: true } } },
  });
  if (!m) {
    reply.code(404).send({ error: 'module_not_found' });
    return false;
  }
  if (m.package.isSystem) {
    reply.code(409).send({ error: 'system_package_locked' });
    return false;
  }
  return true;
}

async function assertAssetTemplateEditable(id: string, reply: FastifyReply): Promise<boolean> {
  const r = await prisma.assetTemplate.findUnique({
    where: { id },
    select: { module: { select: { package: { select: { isSystem: true } } } } },
  });
  if (!r) return (reply.code(404).send({ error: 'not_found' }), false);
  if (r.module.package.isSystem) return (reply.code(409).send({ error: 'system_package_locked' }), false);
  return true;
}

async function assertThreatTemplateEditable(id: string, reply: FastifyReply): Promise<boolean> {
  const r = await prisma.threatTemplate.findUnique({
    where: { id },
    select: { module: { select: { package: { select: { isSystem: true } } } } },
  });
  if (!r) return (reply.code(404).send({ error: 'not_found' }), false);
  if (r.module.package.isSystem) return (reply.code(409).send({ error: 'system_package_locked' }), false);
  return true;
}

async function assertCmTemplateEditable(id: string, reply: FastifyReply): Promise<boolean> {
  const r = await prisma.countermeasureTemplate.findUnique({
    where: { id },
    select: { module: { select: { package: { select: { isSystem: true } } } } },
  });
  if (!r) return (reply.code(404).send({ error: 'not_found' }), false);
  if (r.module.package.isSystem) return (reply.code(409).send({ error: 'system_package_locked' }), false);
  return true;
}

async function summarizePackage(id: string) {
  const p = await prisma.templatePackage.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: [{ sortOrder: 'asc' }],
        include: {
          _count: {
            select: {
              assetTemplates: true,
              threatTemplates: true,
              countermeasureTemplates: true,
            },
          },
        },
      },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    industry: p.industry,
    version: p.version,
    regionScope: p.regionScope,
    description: p.description,
    complianceRefs: p.complianceRefs,
    isSystem: p.isSystem,
    enabled: p.enabled,
    customFieldSchema: (p.customFieldSchema ?? null) as Record<string, unknown> | null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    modules: p.modules.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      description: m.description,
      icon: m.icon,
      sortOrder: m.sortOrder,
      assetTemplateCount: m._count.assetTemplates,
      threatTemplateCount: m._count.threatTemplates,
      countermeasureTemplateCount: m._count.countermeasureTemplates,
    })),
  };
}

async function loadModuleDetail(id: string) {
  const m = await prisma.templateModule.findUnique({
    where: { id },
    include: {
      assetTemplates: { orderBy: [{ name: 'asc' }] },
      threatTemplates: { orderBy: [{ scenarioName: 'asc' }] },
      countermeasureTemplates: { orderBy: [{ name: 'asc' }] },
    },
  });
  if (!m) return null;
  const assetIds = m.assetTemplates.map((a) => a.id);
  const threatIds = m.threatTemplates.map((t) => t.id);
  const cmIds = m.countermeasureTemplates.map((c) => c.id);
  const [assetThreatLinks, threatCmLinks] = await Promise.all([
    assetIds.length && threatIds.length
      ? prisma.assetTemplateThreat.findMany({
          where: {
            assetTemplateId: { in: assetIds },
            threatTemplateId: { in: threatIds },
          },
        })
      : Promise.resolve([] as Prisma.AssetTemplateThreatGetPayload<{}>[]),
    threatIds.length && cmIds.length
      ? prisma.threatTemplateCountermeasure.findMany({
          where: {
            threatTemplateId: { in: threatIds },
            countermeasureTemplateId: { in: cmIds },
          },
        })
      : Promise.resolve([] as Prisma.ThreatTemplateCountermeasureGetPayload<{}>[]),
  ]);
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    packageId: m.packageId,
    description: m.description,
    icon: m.icon,
    sortOrder: m.sortOrder,
    assetTemplates: m.assetTemplates.map((t) => ({ id: t.id, ...serializeAssetTemplate(t) })),
    threatTemplates: m.threatTemplates.map((t) => ({ id: t.id, ...serializeThreatTemplate(t) })),
    countermeasureTemplates: m.countermeasureTemplates.map((t) => ({ id: t.id, ...serializeCountermeasureTemplate(t) })),
    assetThreatLinks: assetThreatLinks.map((l) => ({
      assetTemplateId: l.assetTemplateId,
      threatTemplateId: l.threatTemplateId,
      relevance: l.relevance,
      rationale: l.rationale,
    })),
    threatCountermeasureLinks: threatCmLinks.map((l) => ({
      threatTemplateId: l.threatTemplateId,
      countermeasureTemplateId: l.countermeasureTemplateId,
      relevance: l.relevance,
      rationale: l.rationale,
    })),
  };
}

export default async function templateAdminRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const authManage = [app.authenticate, requirePermission('templates:manage')];

  // ════════════════════════════════════════════════════════
  // PACKAGES
  // ════════════════════════════════════════════════════════

  router.get(
    '/admin/template-packages',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ items: z.array(adminPackageWithTreeSchema) }) },
      },
    },
    async () => {
      const pkgs = await prisma.templatePackage.findMany({
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        include: {
          modules: {
            orderBy: [{ sortOrder: 'asc' }],
            include: {
              _count: { select: { assetTemplates: true, threatTemplates: true, countermeasureTemplates: true } },
            },
          },
        },
      });
      return {
        items: pkgs.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          industry: p.industry,
          version: p.version,
          regionScope: p.regionScope,
          description: p.description,
          complianceRefs: p.complianceRefs,
          isSystem: p.isSystem,
          enabled: p.enabled,
          customFieldSchema: (p.customFieldSchema ?? null) as Record<string, unknown> | null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          modules: p.modules.map((m) => ({
            id: m.id,
            slug: m.slug,
            name: m.name,
            description: m.description,
            icon: m.icon,
            sortOrder: m.sortOrder,
            assetTemplateCount: m._count.assetTemplates,
            threatTemplateCount: m._count.threatTemplates,
            countermeasureTemplateCount: m._count.countermeasureTemplates,
          })),
        })),
      };
    },
  );

  router.post(
    '/admin/template-packages',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        body: packageCreateSchema,
        response: { 201: adminPackageWithTreeSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      try {
        const userId = (req.user as { sub?: string } | undefined)?.sub;
        const created = await prisma.templatePackage.create({
          data: {
            slug: req.body.slug,
            name: req.body.name,
            industry: req.body.industry ?? null,
            version: req.body.version,
            regionScope: req.body.regionScope ?? null,
            description: req.body.description ?? null,
            complianceRefs: req.body.complianceRefs,
            enabled: req.body.enabled,
            customFieldSchema: jsonOrDbNull(req.body.customFieldSchema),
            isSystem: false,
            updatedById: userId ?? null,
          },
        });
        const full = await summarizePackage(created.id);
        return reply.code(201).send(full!);
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') {
          return reply.code(409).send({ error: 'slug_exists' });
        }
        throw err;
      }
    },
  );

  router.patch(
    '/admin/template-packages/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: packageUpdateSchema,
        response: { 200: adminPackageWithTreeSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      const b = req.body;
      // `enabled` is the only field admins can toggle on system packages —
      // disabling lets them silence a forked-from package without breaking
      // existing assets that reference it.
      const onlyTogglesEnabled =
        b.enabled !== undefined &&
        b.slug === undefined && b.name === undefined && b.industry === undefined &&
        b.version === undefined && b.regionScope === undefined && b.description === undefined &&
        b.complianceRefs === undefined && b.customFieldSchema === undefined;
      if (!onlyTogglesEnabled) {
        if (!(await assertPackageEditable(req.params.id, reply))) return;
      } else {
        const exists = await prisma.templatePackage.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!exists) return reply.code(404).send({ error: 'package_not_found' });
      }
      await prisma.templatePackage.update({
        where: { id: req.params.id },
        data: {
          ...(b.slug !== undefined ? { slug: b.slug } : {}),
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.industry !== undefined ? { industry: b.industry } : {}),
          ...(b.version !== undefined ? { version: b.version } : {}),
          ...(b.regionScope !== undefined ? { regionScope: b.regionScope } : {}),
          ...(b.description !== undefined ? { description: b.description } : {}),
          ...(b.complianceRefs !== undefined ? { complianceRefs: b.complianceRefs } : {}),
          ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
          ...(b.customFieldSchema !== undefined ? { customFieldSchema: jsonOrDbNull(b.customFieldSchema) } : {}),
          updatedById: userId ?? null,
        },
      });
      const full = await summarizePackage(req.params.id);
      return reply.send(full!);
    },
  );

  router.delete(
    '/admin/template-packages/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertPackageEditable(req.params.id, reply))) return;
      await prisma.templatePackage.delete({ where: { id: req.params.id } });
      return reply.code(204).send(null);
    },
  );

  // ── Fork a package (clone isSystem=false) ────────────────
  router.post(
    '/admin/template-packages/:id/fork',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: z.object({ slug: z.string().optional(), name: z.string().optional() }).optional(),
        response: { 201: adminPackageWithTreeSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const src = await prisma.templatePackage.findUnique({
        where: { id: req.params.id },
        include: {
          modules: {
            orderBy: [{ sortOrder: 'asc' }],
            include: {
              assetTemplates: true,
              threatTemplates: true,
              countermeasureTemplates: true,
            },
          },
        },
      });
      if (!src) return reply.code(404).send({ error: 'package_not_found' });
      const userId = (req.user as { sub?: string } | undefined)?.sub;

      const body = req.body ?? {};
      const baseSlug = body.slug || `${src.slug}-fork`;
      const finalSlug = await nextAvailableSlug(baseSlug, async (s) =>
        !!(await prisma.templatePackage.findUnique({ where: { slug: s }, select: { id: true } })),
      ).catch(() => baseSlug);
      const newSlug = (await prisma.templatePackage.findUnique({ where: { slug: baseSlug }, select: { id: true } }))
        ? finalSlug
        : baseSlug;

      const newPkg = await prisma.$transaction(async (tx) => {
        const pkg = await tx.templatePackage.create({
          data: {
            slug: newSlug,
            name: body.name || `${src.name} (fork)`,
            industry: src.industry,
            version: src.version,
            regionScope: src.regionScope,
            description: src.description,
            complianceRefs: src.complianceRefs,
            customFieldSchema: jsonOrDbNull(src.customFieldSchema),
            isSystem: false,
            updatedById: userId ?? null,
          },
        });
        const srcAssetIds = src.modules.flatMap((m) => m.assetTemplates.map((a) => a.id));
        const srcThreatIds = src.modules.flatMap((m) => m.threatTemplates.map((t) => t.id));
        const srcCmIds = src.modules.flatMap((m) => m.countermeasureTemplates.map((c) => c.id));
        const [assetThreatLinks, threatCmLinks] = await Promise.all([
          srcAssetIds.length && srcThreatIds.length
            ? tx.assetTemplateThreat.findMany({
                where: { assetTemplateId: { in: srcAssetIds }, threatTemplateId: { in: srcThreatIds } },
              })
            : [],
          srcThreatIds.length && srcCmIds.length
            ? tx.threatTemplateCountermeasure.findMany({
                where: { threatTemplateId: { in: srcThreatIds }, countermeasureTemplateId: { in: srcCmIds } },
              })
            : [],
        ]);

        const idMapAsset = new Map<string, string>();
        const idMapThreat = new Map<string, string>();
        const idMapCm = new Map<string, string>();

        for (const m of src.modules) {
          const newModule = await tx.templateModule.create({
            data: {
              packageId: pkg.id,
              slug: m.slug,
              name: m.name,
              description: m.description,
              icon: m.icon,
              sortOrder: m.sortOrder,
              updatedById: userId ?? null,
            },
          });
          for (const a of m.assetTemplates) {
            const nA = await tx.assetTemplate.create({
              data: {
                moduleId: newModule.id,
                slug: a.slug,
                name: a.name,
                assetType: a.assetType,
                category: a.category,
                defaultCriticality: a.defaultCriticality,
                defaultAssetRole: a.defaultAssetRole,
                description: a.description,
                parentSlug: a.parentSlug,
                tags: a.tags,
                attributes: jsonOrDbNull(a.attributes),
                updatedById: userId ?? null,
              },
            });
            idMapAsset.set(a.id, nA.id);
          }
          for (const t of m.threatTemplates) {
            const nT = await tx.threatTemplate.create({
              data: {
                moduleId: newModule.id,
                slug: t.slug,
                scenarioName: t.scenarioName,
                adversaryType: t.adversaryType,
                actionType: t.actionType,
                adversaryProfile: jsonOrDbNull(t.adversaryProfile),
                typicalActions: t.typicalActions,
                targetAssetTypes: t.targetAssetTypes,
                indicators: t.indicators,
                suggestedLikelihood: t.suggestedLikelihood,
                csmpUnitReference: t.csmpUnitReference,
                attributes: jsonOrDbNull(t.attributes),
                updatedById: userId ?? null,
              },
            });
            idMapThreat.set(t.id, nT.id);
          }
          for (const c of m.countermeasureTemplates) {
            const nC = await tx.countermeasureTemplate.create({
              data: {
                moduleId: newModule.id,
                slug: c.slug,
                name: c.name,
                description: c.description,
                shapeCategory: c.shapeCategory,
                ppsFunctions: c.ppsFunctions,
                domain: c.domain,
                defaultTearStrategy: c.defaultTearStrategy,
                defaultEffectiveness: c.defaultEffectiveness,
                typicalCostEstimate: c.typicalCostEstimate,
                typicalAnnualCost: c.typicalAnnualCost,
                tags: c.tags,
                csmpUnitReference: c.csmpUnitReference,
                attributes: jsonOrDbNull(c.attributes),
                updatedById: userId ?? null,
              },
            });
            idMapCm.set(c.id, nC.id);
          }
        }
        for (const l of assetThreatLinks) {
          const a = idMapAsset.get(l.assetTemplateId);
          const t = idMapThreat.get(l.threatTemplateId);
          if (a && t) {
            await tx.assetTemplateThreat.create({
              data: { assetTemplateId: a, threatTemplateId: t, relevance: l.relevance, rationale: l.rationale },
            });
          }
        }
        for (const l of threatCmLinks) {
          const t = idMapThreat.get(l.threatTemplateId);
          const c = idMapCm.get(l.countermeasureTemplateId);
          if (t && c) {
            await tx.threatTemplateCountermeasure.create({
              data: { threatTemplateId: t, countermeasureTemplateId: c, relevance: l.relevance, rationale: l.rationale },
            });
          }
        }
        return pkg;
      });

      const full = await summarizePackage(newPkg.id);
      return reply.code(201).send(full!);
    },
  );

  // ════════════════════════════════════════════════════════
  // MODULES
  // ════════════════════════════════════════════════════════

  router.get(
    '/admin/template-modules/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: adminModuleDetailSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const m = await loadModuleDetail(req.params.id);
      if (!m) return reply.code(404).send({ error: 'not_found' });
      return reply.send(m);
    },
  );

  router.post(
    '/admin/template-packages/:id/modules',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: moduleCreateSchema,
        response: { 201: adminModuleDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertPackageEditable(req.params.id, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      try {
        const m = await prisma.templateModule.create({
          data: {
            packageId: req.params.id,
            slug: req.body.slug,
            name: req.body.name,
            description: req.body.description ?? null,
            icon: req.body.icon ?? null,
            sortOrder: req.body.sortOrder,
            updatedById: userId ?? null,
          },
        });
        const full = await loadModuleDetail(m.id);
        return reply.code(201).send(full!);
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') return reply.code(409).send({ error: 'slug_exists' });
        throw err;
      }
    },
  );

  router.patch(
    '/admin/template-modules/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: moduleUpdateSchema,
        response: { 200: adminModuleDetailSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertModuleEditable(req.params.id, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      const b = req.body;
      await prisma.templateModule.update({
        where: { id: req.params.id },
        data: {
          ...(b.slug !== undefined ? { slug: b.slug } : {}),
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.description !== undefined ? { description: b.description } : {}),
          ...(b.icon !== undefined ? { icon: b.icon } : {}),
          ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
          updatedById: userId ?? null,
        },
      });
      const full = await loadModuleDetail(req.params.id);
      return reply.send(full!);
    },
  );

  router.delete(
    '/admin/template-modules/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertModuleEditable(req.params.id, reply))) return;
      await prisma.templateModule.delete({ where: { id: req.params.id } });
      return reply.code(204).send(null);
    },
  );

  // ════════════════════════════════════════════════════════
  // ASSET TEMPLATES
  // ════════════════════════════════════════════════════════

  router.post(
    '/admin/template-modules/:id/asset-templates',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: assetTemplateCreateSchema,
        response: { 201: assetTemplateExportSchema.extend({ id: uuid }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertModuleEditable(req.params.id, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      try {
        const t = await prisma.assetTemplate.create({
          data: {
            moduleId: req.params.id,
            slug: req.body.slug,
            name: req.body.name,
            assetType: req.body.assetType,
            category: req.body.category,
            defaultCriticality: req.body.defaultCriticality,
            defaultAssetRole: req.body.defaultAssetRole ?? null,
            description: req.body.description ?? null,
            parentSlug: req.body.parentSlug ?? null,
            tags: req.body.tags,
            attributes: req.body.attributes as Prisma.InputJsonValue,
            updatedById: userId ?? null,
          },
        });
        return reply.code(201).send({ id: t.id, ...serializeAssetTemplate(t) });
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') return reply.code(409).send({ error: 'slug_exists' });
        throw err;
      }
    },
  );

  router.patch(
    '/admin/asset-templates/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: assetTemplateUpdateSchema,
        response: { 200: assetTemplateExportSchema.extend({ id: uuid }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertAssetTemplateEditable(req.params.id, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      const b = req.body;
      const t = await prisma.assetTemplate.update({
        where: { id: req.params.id },
        data: {
          ...(b.slug !== undefined ? { slug: b.slug } : {}),
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.assetType !== undefined ? { assetType: b.assetType } : {}),
          ...(b.category !== undefined ? { category: b.category } : {}),
          ...(b.defaultCriticality !== undefined ? { defaultCriticality: b.defaultCriticality } : {}),
          ...(b.defaultAssetRole !== undefined ? { defaultAssetRole: b.defaultAssetRole } : {}),
          ...(b.description !== undefined ? { description: b.description } : {}),
          ...(b.parentSlug !== undefined ? { parentSlug: b.parentSlug } : {}),
          ...(b.tags !== undefined ? { tags: b.tags } : {}),
          ...(b.attributes !== undefined ? { attributes: b.attributes as Prisma.InputJsonValue } : {}),
          updatedById: userId ?? null,
        },
      });
      return reply.send({ id: t.id, ...serializeAssetTemplate(t) });
    },
  );

  router.delete(
    '/admin/asset-templates/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertAssetTemplateEditable(req.params.id, reply))) return;
      await prisma.assetTemplate.delete({ where: { id: req.params.id } });
      return reply.code(204).send(null);
    },
  );

  // ════════════════════════════════════════════════════════
  // THREAT TEMPLATES
  // ════════════════════════════════════════════════════════

  router.post(
    '/admin/template-modules/:id/threat-templates',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: threatTemplateCreateSchema,
        response: { 201: threatTemplateExportSchema.extend({ id: uuid }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertModuleEditable(req.params.id, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      try {
        const t = await prisma.threatTemplate.create({
          data: {
            moduleId: req.params.id,
            slug: req.body.slug,
            scenarioName: req.body.scenarioName,
            adversaryType: req.body.adversaryType,
            actionType: req.body.actionType,
            adversaryProfile: jsonOrDbNull(req.body.adversaryProfile),
            typicalActions: req.body.typicalActions,
            targetAssetTypes: req.body.targetAssetTypes,
            indicators: req.body.indicators,
            suggestedLikelihood: req.body.suggestedLikelihood ?? null,
            csmpUnitReference: req.body.csmpUnitReference ?? null,
            attributes: req.body.attributes as Prisma.InputJsonValue,
            updatedById: userId ?? null,
          },
        });
        return reply.code(201).send({ id: t.id, ...serializeThreatTemplate(t) });
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') return reply.code(409).send({ error: 'slug_exists' });
        throw err;
      }
    },
  );

  router.patch(
    '/admin/threat-templates/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: threatTemplateUpdateSchema,
        response: { 200: threatTemplateExportSchema.extend({ id: uuid }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertThreatTemplateEditable(req.params.id, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      const b = req.body;
      const t = await prisma.threatTemplate.update({
        where: { id: req.params.id },
        data: {
          ...(b.slug !== undefined ? { slug: b.slug } : {}),
          ...(b.scenarioName !== undefined ? { scenarioName: b.scenarioName } : {}),
          ...(b.adversaryType !== undefined ? { adversaryType: b.adversaryType } : {}),
          ...(b.actionType !== undefined ? { actionType: b.actionType } : {}),
          ...(b.adversaryProfile !== undefined ? { adversaryProfile: jsonOrDbNull(b.adversaryProfile) } : {}),
          ...(b.typicalActions !== undefined ? { typicalActions: b.typicalActions } : {}),
          ...(b.targetAssetTypes !== undefined ? { targetAssetTypes: b.targetAssetTypes } : {}),
          ...(b.indicators !== undefined ? { indicators: b.indicators } : {}),
          ...(b.suggestedLikelihood !== undefined ? { suggestedLikelihood: b.suggestedLikelihood } : {}),
          ...(b.csmpUnitReference !== undefined ? { csmpUnitReference: b.csmpUnitReference } : {}),
          ...(b.attributes !== undefined ? { attributes: b.attributes as Prisma.InputJsonValue } : {}),
          updatedById: userId ?? null,
        },
      });
      return reply.send({ id: t.id, ...serializeThreatTemplate(t) });
    },
  );

  router.delete(
    '/admin/threat-templates/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertThreatTemplateEditable(req.params.id, reply))) return;
      await prisma.threatTemplate.delete({ where: { id: req.params.id } });
      return reply.code(204).send(null);
    },
  );

  // ════════════════════════════════════════════════════════
  // COUNTERMEASURE TEMPLATES
  // ════════════════════════════════════════════════════════

  router.post(
    '/admin/template-modules/:id/countermeasure-templates',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: countermeasureTemplateCreateSchema,
        response: { 201: countermeasureTemplateExportSchema.extend({ id: uuid }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertModuleEditable(req.params.id, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      try {
        const b = req.body;
        const t = await prisma.countermeasureTemplate.create({
          data: {
            moduleId: req.params.id,
            slug: b.slug,
            name: b.name,
            description: b.description ?? null,
            shapeCategory: b.shapeCategory,
            ppsFunctions: b.ppsFunctions,
            domain: b.domain,
            defaultTearStrategy: b.defaultTearStrategy ?? null,
            defaultEffectiveness: b.defaultEffectiveness ?? null,
            typicalCostEstimate: b.typicalCostEstimate ?? null,
            typicalAnnualCost: b.typicalAnnualCost ?? null,
            tags: b.tags,
            csmpUnitReference: b.csmpUnitReference ?? null,
            attributes: b.attributes as Prisma.InputJsonValue,
            updatedById: userId ?? null,
          },
        });
        return reply.code(201).send({ id: t.id, ...serializeCountermeasureTemplate(t) });
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') return reply.code(409).send({ error: 'slug_exists' });
        throw err;
      }
    },
  );

  router.patch(
    '/admin/countermeasure-templates/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: countermeasureTemplateUpdateSchema,
        response: { 200: countermeasureTemplateExportSchema.extend({ id: uuid }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertCmTemplateEditable(req.params.id, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      const b = req.body;
      const t = await prisma.countermeasureTemplate.update({
        where: { id: req.params.id },
        data: {
          ...(b.slug !== undefined ? { slug: b.slug } : {}),
          ...(b.name !== undefined ? { name: b.name } : {}),
          ...(b.description !== undefined ? { description: b.description } : {}),
          ...(b.shapeCategory !== undefined ? { shapeCategory: b.shapeCategory } : {}),
          ...(b.ppsFunctions !== undefined ? { ppsFunctions: b.ppsFunctions } : {}),
          ...(b.domain !== undefined ? { domain: b.domain } : {}),
          ...(b.defaultTearStrategy !== undefined ? { defaultTearStrategy: b.defaultTearStrategy } : {}),
          ...(b.defaultEffectiveness !== undefined ? { defaultEffectiveness: b.defaultEffectiveness } : {}),
          ...(b.typicalCostEstimate !== undefined ? { typicalCostEstimate: b.typicalCostEstimate } : {}),
          ...(b.typicalAnnualCost !== undefined ? { typicalAnnualCost: b.typicalAnnualCost } : {}),
          ...(b.tags !== undefined ? { tags: b.tags } : {}),
          ...(b.csmpUnitReference !== undefined ? { csmpUnitReference: b.csmpUnitReference } : {}),
          ...(b.attributes !== undefined ? { attributes: b.attributes as Prisma.InputJsonValue } : {}),
          updatedById: userId ?? null,
        },
      });
      return reply.send({ id: t.id, ...serializeCountermeasureTemplate(t) });
    },
  );

  router.delete(
    '/admin/countermeasure-templates/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 204: z.null(), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertCmTemplateEditable(req.params.id, reply))) return;
      await prisma.countermeasureTemplate.delete({ where: { id: req.params.id } });
      return reply.code(204).send(null);
    },
  );

  // ════════════════════════════════════════════════════════
  // JUNCTIONS
  // ════════════════════════════════════════════════════════

  router.put(
    '/admin/asset-templates/:id/threats/:threatId',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        body: junctionUpsertSchema,
        response: { 200: z.object({ ok: z.literal(true) }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertAssetTemplateEditable(req.params.id, reply))) return;
      await prisma.assetTemplateThreat.upsert({
        where: {
          assetTemplateId_threatTemplateId: {
            assetTemplateId: req.params.id,
            threatTemplateId: req.params.threatId,
          },
        },
        create: {
          assetTemplateId: req.params.id,
          threatTemplateId: req.params.threatId,
          relevance: req.body.relevance,
          rationale: req.body.rationale ?? null,
        },
        update: {
          relevance: req.body.relevance,
          rationale: req.body.rationale ?? null,
        },
      });
      return reply.send({ ok: true });
    },
  );

  router.delete(
    '/admin/asset-templates/:id/threats/:threatId',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, threatId: uuid }),
        response: { 204: z.null(), 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertAssetTemplateEditable(req.params.id, reply))) return;
      await prisma.assetTemplateThreat.deleteMany({
        where: { assetTemplateId: req.params.id, threatTemplateId: req.params.threatId },
      });
      return reply.code(204).send(null);
    },
  );

  router.put(
    '/admin/threat-templates/:id/countermeasures/:cmId',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, cmId: uuid }),
        body: junctionUpsertSchema,
        response: { 200: z.object({ ok: z.literal(true) }), 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertThreatTemplateEditable(req.params.id, reply))) return;
      await prisma.threatTemplateCountermeasure.upsert({
        where: {
          threatTemplateId_countermeasureTemplateId: {
            threatTemplateId: req.params.id,
            countermeasureTemplateId: req.params.cmId,
          },
        },
        create: {
          threatTemplateId: req.params.id,
          countermeasureTemplateId: req.params.cmId,
          relevance: req.body.relevance,
          rationale: req.body.rationale ?? null,
        },
        update: {
          relevance: req.body.relevance,
          rationale: req.body.rationale ?? null,
        },
      });
      return reply.send({ ok: true });
    },
  );

  router.delete(
    '/admin/threat-templates/:id/countermeasures/:cmId',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid, cmId: uuid }),
        response: { 204: z.null(), 409: errorSchema },
      },
    },
    async (req, reply) => {
      if (!(await assertThreatTemplateEditable(req.params.id, reply))) return;
      await prisma.threatTemplateCountermeasure.deleteMany({
        where: { threatTemplateId: req.params.id, countermeasureTemplateId: req.params.cmId },
      });
      return reply.code(204).send(null);
    },
  );

  // ════════════════════════════════════════════════════════
  // EXPORT
  // ════════════════════════════════════════════════════════

  router.get(
    '/admin/export/package/:slug',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ slug: z.string() }),
        response: { 200: packageBundleEnvelopeSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const p = await prisma.templatePackage.findUnique({
        where: { slug: req.params.slug },
        include: {
          modules: {
            orderBy: [{ sortOrder: 'asc' }],
            include: {
              assetTemplates: { orderBy: [{ name: 'asc' }] },
              threatTemplates: { orderBy: [{ scenarioName: 'asc' }] },
              countermeasureTemplates: { orderBy: [{ name: 'asc' }] },
            },
          },
        },
      });
      if (!p) return reply.code(404).send({ error: 'package_not_found' });

      const assetIds = p.modules.flatMap((m) => m.assetTemplates.map((a) => a.id));
      const threatIds = p.modules.flatMap((m) => m.threatTemplates.map((t) => t.id));
      const cmIds = p.modules.flatMap((m) => m.countermeasureTemplates.map((c) => c.id));

      const [atLinks, tcLinks] = await Promise.all([
        assetIds.length && threatIds.length
          ? prisma.assetTemplateThreat.findMany({
              where: { assetTemplateId: { in: assetIds }, threatTemplateId: { in: threatIds } },
              include: { assetTemplate: true, threatTemplate: true },
            })
          : [],
        threatIds.length && cmIds.length
          ? prisma.threatTemplateCountermeasure.findMany({
              where: { threatTemplateId: { in: threatIds }, countermeasureTemplateId: { in: cmIds } },
              include: { threatTemplate: true, countermeasureTemplate: true },
            })
          : [],
      ]);

      const modules = p.modules.map((m) => {
        const mAssetIds = new Set(m.assetTemplates.map((a) => a.id));
        const mThreatIds = new Set(m.threatTemplates.map((t) => t.id));
        const mCmIds = new Set(m.countermeasureTemplates.map((c) => c.id));
        return serializeModule(
          m,
          atLinks
            .filter((l) => mAssetIds.has(l.assetTemplateId) && mThreatIds.has(l.threatTemplateId))
            .map((l) => ({
              assetSlug: l.assetTemplate.slug,
              threatSlug: l.threatTemplate.slug,
              relevance: l.relevance,
              rationale: l.rationale,
            })),
          tcLinks
            .filter((l) => mThreatIds.has(l.threatTemplateId) && mCmIds.has(l.countermeasureTemplateId))
            .map((l) => ({
              threatSlug: l.threatTemplate.slug,
              cmSlug: l.countermeasureTemplate.slug,
              relevance: l.relevance,
              rationale: l.rationale,
            })),
        );
      });

      return reply.send(envelope('package', packageBundle(p, modules)));
    },
  );

  router.get(
    '/admin/export/asset-template/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: assetTemplateEnvelopeSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const t = await prisma.assetTemplate.findUnique({ where: { id: req.params.id } });
      if (!t) return reply.code(404).send({ error: 'not_found' });
      return reply.send(envelope('asset-template', serializeAssetTemplate(t)));
    },
  );

  router.get(
    '/admin/export/threat-template/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: threatTemplateEnvelopeSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const t = await prisma.threatTemplate.findUnique({ where: { id: req.params.id } });
      if (!t) return reply.code(404).send({ error: 'not_found' });
      return reply.send(envelope('threat-template', serializeThreatTemplate(t)));
    },
  );

  router.get(
    '/admin/export/countermeasure-template/:id',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: countermeasureTemplateEnvelopeSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const t = await prisma.countermeasureTemplate.findUnique({ where: { id: req.params.id } });
      if (!t) return reply.code(404).send({ error: 'not_found' });
      return reply.send(envelope('countermeasure-template', serializeCountermeasureTemplate(t)));
    },
  );

  // ════════════════════════════════════════════════════════
  // IMPORT
  // ════════════════════════════════════════════════════════

  router.post(
    '/admin/import/package',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        querystring: z.object({ onConflict: onConflictSchema }),
        body: packageBundleEnvelopeSchema,
        response: { 200: importResultSchema, 400: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { onConflict } = req.query;
      const content = req.body.content;
      const userId = (req.user as { sub?: string } | undefined)?.sub;

      const result = { created: [] as string[], updated: [] as string[], skipped: [] as string[], renamed: [] as Array<{ from: string; to: string }> };

      // Resolve package slug per conflict policy.
      let pkgSlug = content.package.slug;
      const existing = await prisma.templatePackage.findUnique({ where: { slug: pkgSlug } });
      let targetPkgId: string;
      if (existing) {
        if (existing.isSystem) return reply.code(409).send({ error: 'system_package_locked' });
        if (onConflict === 'skip') {
          result.skipped.push(`package:${pkgSlug}`);
          return reply.send(result);
        }
        if (onConflict === 'rename') {
          const newSlug = await nextAvailableSlug(pkgSlug, async (s) =>
            !!(await prisma.templatePackage.findUnique({ where: { slug: s }, select: { id: true } })),
          );
          result.renamed.push({ from: pkgSlug, to: newSlug });
          pkgSlug = newSlug;
          targetPkgId = '';
        } else {
          targetPkgId = existing.id;
        }
      } else {
        targetPkgId = '';
      }

      await prisma.$transaction(async (tx) => {
        const pkg = targetPkgId
          ? await tx.templatePackage.update({
              where: { id: targetPkgId },
              data: {
                name: content.package.name,
                industry: content.package.industry,
                version: content.package.version,
                regionScope: content.package.regionScope,
                description: content.package.description,
                complianceRefs: content.package.complianceRefs,
                customFieldSchema: jsonOrDbNull(content.package.customFieldSchema),
                updatedById: userId ?? null,
              },
            })
          : await tx.templatePackage.create({
              data: {
                slug: pkgSlug,
                name: content.package.name,
                industry: content.package.industry,
                version: content.package.version,
                regionScope: content.package.regionScope,
                description: content.package.description,
                complianceRefs: content.package.complianceRefs,
                customFieldSchema: jsonOrDbNull(content.package.customFieldSchema),
                isSystem: false,
                updatedById: userId ?? null,
              },
            });
        (targetPkgId ? result.updated : result.created).push(`package:${pkg.slug}`);
        targetPkgId = pkg.id;

        const assetIdBySlug = new Map<string, string>();
        const threatIdBySlug = new Map<string, string>();
        const cmIdBySlug = new Map<string, string>();

        for (const m of content.modules) {
          const mod = await tx.templateModule.upsert({
            where: { packageId_slug: { packageId: pkg.id, slug: m.slug } },
            create: {
              packageId: pkg.id,
              slug: m.slug,
              name: m.name,
              description: m.description,
              icon: m.icon,
              sortOrder: m.sortOrder,
              updatedById: userId ?? null,
            },
            update: onConflict === 'overwrite'
              ? {
                  name: m.name,
                  description: m.description,
                  icon: m.icon,
                  sortOrder: m.sortOrder,
                  updatedById: userId ?? null,
                }
              : { updatedById: userId ?? null },
          });
          for (const a of m.assetTemplates) {
            const r = await tx.assetTemplate.upsert({
              where: { moduleId_slug: { moduleId: mod.id, slug: a.slug } },
              create: {
                moduleId: mod.id,
                slug: a.slug,
                name: a.name,
                assetType: a.assetType as Prisma.AssetTemplateCreateInput['assetType'],
                category: a.category as Prisma.AssetTemplateCreateInput['category'],
                defaultCriticality: a.defaultCriticality,
                defaultAssetRole: a.defaultAssetRole as Prisma.AssetTemplateCreateInput['defaultAssetRole'],
                description: a.description,
                parentSlug: a.parentSlug,
                tags: a.tags,
                attributes: a.attributes as Prisma.InputJsonValue,
                updatedById: userId ?? null,
              },
              update: onConflict === 'overwrite'
                ? {
                    name: a.name,
                    assetType: a.assetType as Prisma.AssetTemplateCreateInput['assetType'],
                    category: a.category as Prisma.AssetTemplateCreateInput['category'],
                    defaultCriticality: a.defaultCriticality,
                    defaultAssetRole: a.defaultAssetRole as Prisma.AssetTemplateCreateInput['defaultAssetRole'],
                    description: a.description,
                    parentSlug: a.parentSlug,
                    tags: a.tags,
                    attributes: a.attributes as Prisma.InputJsonValue,
                    updatedById: userId ?? null,
                  }
                : { updatedById: userId ?? null },
            });
            assetIdBySlug.set(a.slug, r.id);
          }
          for (const th of m.threatTemplates) {
            const r = await tx.threatTemplate.upsert({
              where: { moduleId_slug: { moduleId: mod.id, slug: th.slug } },
              create: {
                moduleId: mod.id,
                slug: th.slug,
                scenarioName: th.scenarioName,
                adversaryType: th.adversaryType as Prisma.ThreatTemplateCreateInput['adversaryType'],
                actionType: th.actionType as Prisma.ThreatTemplateCreateInput['actionType'],
                adversaryProfile: jsonOrDbNull(th.adversaryProfile),
                typicalActions: th.typicalActions,
                targetAssetTypes: th.targetAssetTypes,
                indicators: th.indicators,
                suggestedLikelihood: th.suggestedLikelihood,
                csmpUnitReference: th.csmpUnitReference,
                attributes: th.attributes as Prisma.InputJsonValue,
                updatedById: userId ?? null,
              },
              update: onConflict === 'overwrite'
                ? {
                    scenarioName: th.scenarioName,
                    adversaryType: th.adversaryType as Prisma.ThreatTemplateCreateInput['adversaryType'],
                    actionType: th.actionType as Prisma.ThreatTemplateCreateInput['actionType'],
                    adversaryProfile: jsonOrDbNull(th.adversaryProfile),
                    typicalActions: th.typicalActions,
                    targetAssetTypes: th.targetAssetTypes,
                    indicators: th.indicators,
                    suggestedLikelihood: th.suggestedLikelihood,
                    csmpUnitReference: th.csmpUnitReference,
                    attributes: th.attributes as Prisma.InputJsonValue,
                    updatedById: userId ?? null,
                  }
                : { updatedById: userId ?? null },
            });
            threatIdBySlug.set(th.slug, r.id);
          }
          for (const c of m.countermeasureTemplates) {
            const r = await tx.countermeasureTemplate.upsert({
              where: { moduleId_slug: { moduleId: mod.id, slug: c.slug } },
              create: {
                moduleId: mod.id,
                slug: c.slug,
                name: c.name,
                description: c.description,
                shapeCategory: c.shapeCategory as Prisma.CountermeasureTemplateCreateInput['shapeCategory'],
                ppsFunctions: c.ppsFunctions as Prisma.CountermeasureTemplateCreateInput['ppsFunctions'],
                domain: c.domain as Prisma.CountermeasureTemplateCreateInput['domain'],
                defaultTearStrategy: c.defaultTearStrategy as Prisma.CountermeasureTemplateCreateInput['defaultTearStrategy'],
                defaultEffectiveness: c.defaultEffectiveness as Prisma.CountermeasureTemplateCreateInput['defaultEffectiveness'],
                typicalCostEstimate: c.typicalCostEstimate,
                typicalAnnualCost: c.typicalAnnualCost,
                tags: c.tags,
                csmpUnitReference: c.csmpUnitReference,
                attributes: c.attributes as Prisma.InputJsonValue,
                updatedById: userId ?? null,
              },
              update: onConflict === 'overwrite'
                ? {
                    name: c.name,
                    description: c.description,
                    shapeCategory: c.shapeCategory as Prisma.CountermeasureTemplateCreateInput['shapeCategory'],
                    ppsFunctions: c.ppsFunctions as Prisma.CountermeasureTemplateCreateInput['ppsFunctions'],
                    domain: c.domain as Prisma.CountermeasureTemplateCreateInput['domain'],
                    defaultTearStrategy: c.defaultTearStrategy as Prisma.CountermeasureTemplateCreateInput['defaultTearStrategy'],
                    defaultEffectiveness: c.defaultEffectiveness as Prisma.CountermeasureTemplateCreateInput['defaultEffectiveness'],
                    typicalCostEstimate: c.typicalCostEstimate,
                    typicalAnnualCost: c.typicalAnnualCost,
                    tags: c.tags,
                    csmpUnitReference: c.csmpUnitReference,
                    attributes: c.attributes as Prisma.InputJsonValue,
                    updatedById: userId ?? null,
                  }
                : { updatedById: userId ?? null },
            });
            cmIdBySlug.set(c.slug, r.id);
          }
          for (const l of m.assetThreatLinks) {
            const aId = assetIdBySlug.get(l.assetSlug);
            const tId = threatIdBySlug.get(l.threatSlug);
            if (!aId || !tId) continue;
            const rel = l.relevance as Prisma.AssetTemplateThreatCreateInput['relevance'];
            await tx.assetTemplateThreat.upsert({
              where: { assetTemplateId_threatTemplateId: { assetTemplateId: aId, threatTemplateId: tId } },
              create: { assetTemplateId: aId, threatTemplateId: tId, relevance: rel, rationale: l.rationale },
              update: { relevance: rel, rationale: l.rationale },
            });
          }
          for (const l of m.threatCountermeasureLinks) {
            const tId = threatIdBySlug.get(l.threatSlug);
            const cId = cmIdBySlug.get(l.cmSlug);
            if (!tId || !cId) continue;
            const rel = l.relevance as Prisma.ThreatTemplateCountermeasureCreateInput['relevance'];
            await tx.threatTemplateCountermeasure.upsert({
              where: { threatTemplateId_countermeasureTemplateId: { threatTemplateId: tId, countermeasureTemplateId: cId } },
              create: { threatTemplateId: tId, countermeasureTemplateId: cId, relevance: rel, rationale: l.rationale },
              update: { relevance: rel, rationale: l.rationale },
            });
          }
        }
      });

      return reply.send(result);
    },
  );

  // Item-level import: attach to a module by id (query param).
  router.post(
    '/admin/import/:kind',
    {
      onRequest: authManage,
      schema: {
        tags: ['templates-admin'],
        security: [{ bearerAuth: [] }],
        params: z.object({ kind: z.enum(['asset-template', 'threat-template', 'countermeasure-template']) }),
        querystring: z.object({
          moduleId: uuid,
          onConflict: onConflictSchema,
        }),
        body: z.discriminatedUnion('kind', [
          assetTemplateEnvelopeSchema,
          threatTemplateEnvelopeSchema,
          countermeasureTemplateEnvelopeSchema,
        ]),
        response: { 200: importResultSchema, 400: errorSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (req, reply) => {
      const { moduleId, onConflict } = req.query;
      if (!(await assertModuleEditable(moduleId, reply))) return;
      const userId = (req.user as { sub?: string } | undefined)?.sub;
      const result = { created: [] as string[], updated: [] as string[], skipped: [] as string[], renamed: [] as Array<{ from: string; to: string }> };

      const envIn = req.body;
      if (envIn.kind !== req.params.kind) {
        return reply.code(400).send({ error: `kind_mismatch_expected_${req.params.kind}` });
      }

      async function resolveSlug<T>(
        slug: string,
        lookup: (slug: string) => Promise<T | null>,
      ): Promise<{ slug: string; existing: T | null; action: 'create' | 'update' | 'skip' }> {
        const existing = await lookup(slug);
        if (!existing) return { slug, existing: null, action: 'create' };
        if (onConflict === 'skip') return { slug, existing, action: 'skip' };
        if (onConflict === 'overwrite') return { slug, existing, action: 'update' };
        // rename
        const newSlug = await nextAvailableSlug(slug, async (s) => !!(await lookup(s)));
        return { slug: newSlug, existing: null, action: 'create' };
      }

      if (envIn.kind === 'asset-template') {
        const c = envIn.content as z.infer<typeof assetTemplateExportSchema>;
        const res = await resolveSlug(c.slug, (s) =>
          prisma.assetTemplate.findUnique({ where: { moduleId_slug: { moduleId, slug: s } } }),
        );
        if (res.action === 'skip') {
          result.skipped.push(`asset-template:${c.slug}`);
        } else {
          const data = {
            moduleId,
            slug: res.slug,
            name: c.name,
            assetType: c.assetType as Prisma.AssetTemplateCreateInput['assetType'],
            category: c.category as Prisma.AssetTemplateCreateInput['category'],
            defaultCriticality: c.defaultCriticality,
            defaultAssetRole: c.defaultAssetRole as Prisma.AssetTemplateCreateInput['defaultAssetRole'],
            description: c.description,
            parentSlug: c.parentSlug,
            tags: c.tags,
            attributes: c.attributes as Prisma.InputJsonValue,
            updatedById: userId ?? null,
          };
          if (res.action === 'update') {
            await prisma.assetTemplate.update({ where: { id: (res.existing as { id: string }).id }, data });
            result.updated.push(`asset-template:${res.slug}`);
          } else {
            await prisma.assetTemplate.create({ data });
            if (res.slug !== c.slug) result.renamed.push({ from: c.slug, to: res.slug });
            result.created.push(`asset-template:${res.slug}`);
          }
        }
      } else if (envIn.kind === 'threat-template') {
        const c = envIn.content as z.infer<typeof threatTemplateExportSchema>;
        const res = await resolveSlug(c.slug, (s) =>
          prisma.threatTemplate.findUnique({ where: { moduleId_slug: { moduleId, slug: s } } }),
        );
        if (res.action === 'skip') {
          result.skipped.push(`threat-template:${c.slug}`);
        } else {
          const data = {
            moduleId,
            slug: res.slug,
            scenarioName: c.scenarioName,
            adversaryType: c.adversaryType as Prisma.ThreatTemplateCreateInput['adversaryType'],
            actionType: c.actionType as Prisma.ThreatTemplateCreateInput['actionType'],
            adversaryProfile: jsonOrDbNull(c.adversaryProfile),
            typicalActions: c.typicalActions,
            targetAssetTypes: c.targetAssetTypes,
            indicators: c.indicators,
            suggestedLikelihood: c.suggestedLikelihood,
            csmpUnitReference: c.csmpUnitReference,
            attributes: c.attributes as Prisma.InputJsonValue,
            updatedById: userId ?? null,
          };
          if (res.action === 'update') {
            await prisma.threatTemplate.update({ where: { id: (res.existing as { id: string }).id }, data });
            result.updated.push(`threat-template:${res.slug}`);
          } else {
            await prisma.threatTemplate.create({ data });
            if (res.slug !== c.slug) result.renamed.push({ from: c.slug, to: res.slug });
            result.created.push(`threat-template:${res.slug}`);
          }
        }
      } else {
        const c = envIn.content as z.infer<typeof countermeasureTemplateExportSchema>;
        const res = await resolveSlug(c.slug, (s) =>
          prisma.countermeasureTemplate.findUnique({ where: { moduleId_slug: { moduleId, slug: s } } }),
        );
        if (res.action === 'skip') {
          result.skipped.push(`countermeasure-template:${c.slug}`);
        } else {
          const data = {
            moduleId,
            slug: res.slug,
            name: c.name,
            description: c.description,
            shapeCategory: c.shapeCategory as Prisma.CountermeasureTemplateCreateInput['shapeCategory'],
            ppsFunctions: c.ppsFunctions as Prisma.CountermeasureTemplateCreateInput['ppsFunctions'],
            domain: c.domain as Prisma.CountermeasureTemplateCreateInput['domain'],
            defaultTearStrategy: c.defaultTearStrategy as Prisma.CountermeasureTemplateCreateInput['defaultTearStrategy'],
            defaultEffectiveness: c.defaultEffectiveness as Prisma.CountermeasureTemplateCreateInput['defaultEffectiveness'],
            typicalCostEstimate: c.typicalCostEstimate,
            typicalAnnualCost: c.typicalAnnualCost,
            tags: c.tags,
            csmpUnitReference: c.csmpUnitReference,
            attributes: c.attributes as Prisma.InputJsonValue,
            updatedById: userId ?? null,
          };
          if (res.action === 'update') {
            await prisma.countermeasureTemplate.update({ where: { id: (res.existing as { id: string }).id }, data });
            result.updated.push(`countermeasure-template:${res.slug}`);
          } else {
            await prisma.countermeasureTemplate.create({ data });
            if (res.slug !== c.slug) result.renamed.push({ from: c.slug, to: res.slug });
            result.created.push(`countermeasure-template:${res.slug}`);
          }
        }
      }

      return reply.send(result);
    },
  );
}

// Silence unused warning for schemas referenced only as types:
void [moduleExportSchema, packageBundleContentSchema];
void decimalOrNull;
