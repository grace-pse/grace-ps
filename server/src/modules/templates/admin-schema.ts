import { z } from 'zod';
import { assetTypeEnum, assetCategoryEnum } from '../assets/schema.js';
import { adversaryTypeEnum, actionTypeEnum } from '../assessments/schema.js';
import {
  shapeCategoryEnum,
  ppsFunctionEnum,
  protectionDomainEnum,
  tearStrategyEnum,
  vulnerabilityRatingEnum,
} from '../countermeasures/schema.js';
import { relevanceEnum } from './schema.js';

const uuid = z.string().uuid();
const slug = z.string().min(1).max(150).regex(/^[a-z0-9][a-z0-9-]*$/, 'kebab-case slug');

// ── Package ────────────────────────────────────────────────

export const packageCreateSchema = z.object({
  slug: slug.max(100),
  name: z.string().min(1).max(255),
  industry: z.string().max(100).nullable().optional(),
  version: z.string().max(20).default('1.0.0'),
  regionScope: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  complianceRefs: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  customFieldSchema: z.record(z.unknown()).nullable().optional(),
});

export const packageUpdateSchema = packageCreateSchema.partial();

// ── Module ─────────────────────────────────────────────────

export const moduleCreateSchema = z.object({
  slug: slug.max(100),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const moduleUpdateSchema = moduleCreateSchema.partial();

// ── Asset template ────────────────────────────────────────

export const assetTemplateCreateSchema = z.object({
  slug: slug.max(150),
  name: z.string().min(1).max(255),
  assetType: assetTypeEnum,
  category: assetCategoryEnum,
  defaultCriticality: z.number().int().min(1).max(5).default(3),
  description: z.string().nullable().optional(),
  parentSlug: z.string().max(150).nullable().optional(),
  tags: z.array(z.string()).default([]),
  attributes: z.record(z.unknown()).default({}),
});

export const assetTemplateUpdateSchema = assetTemplateCreateSchema.partial();

// ── Threat template ───────────────────────────────────────

export const threatTemplateCreateSchema = z.object({
  slug: slug.max(150),
  scenarioName: z.string().min(1).max(255),
  adversaryType: adversaryTypeEnum,
  actionType: actionTypeEnum,
  adversaryProfile: z.record(z.unknown()).nullable().optional(),
  typicalActions: z.array(z.string()).default([]),
  targetAssetTypes: z.array(z.string()).default([]),
  indicators: z.array(z.string()).default([]),
  suggestedLikelihood: z.number().int().min(1).max(5).nullable().optional(),
  csmpUnitReference: z.string().max(50).nullable().optional(),
  attributes: z.record(z.unknown()).default({}),
});

export const threatTemplateUpdateSchema = threatTemplateCreateSchema.partial();

// ── Countermeasure template ───────────────────────────────

export const countermeasureTemplateCreateSchema = z.object({
  slug: slug.max(150),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  shapeCategory: shapeCategoryEnum,
  ppsFunctions: z.array(ppsFunctionEnum).default([]),
  domain: protectionDomainEnum,
  defaultTearStrategy: tearStrategyEnum.nullable().optional(),
  defaultEffectiveness: vulnerabilityRatingEnum.nullable().optional(),
  typicalCostEstimate: z.number().nullable().optional(),
  typicalAnnualCost: z.number().nullable().optional(),
  tags: z.array(z.string()).default([]),
  csmpUnitReference: z.string().max(64).nullable().optional(),
  attributes: z.record(z.unknown()).default({}),
});

export const countermeasureTemplateUpdateSchema = countermeasureTemplateCreateSchema.partial();

// ── Junctions ─────────────────────────────────────────────

export const junctionUpsertSchema = z.object({
  relevance: relevanceEnum.default('MEDIUM'),
  rationale: z.string().nullable().optional(),
});

// ── Export / import envelope ──────────────────────────────

export const TEMPLATE_SCHEMA_VERSION = '1.0' as const;

export const onConflictSchema = z.enum(['skip', 'overwrite', 'rename']).default('skip');

// Export schemas use `z.string()` for enum fields. Enums are re-validated
// on import at the Prisma layer (DB constraint), and outbound data already
// comes from the DB. Keeping these wide avoids fighting TS over enum narrowing
// when shared-package types use plain strings.
export const assetTemplateExportSchema = z.object({
  slug: z.string(),
  name: z.string(),
  assetType: z.string(),
  category: z.string(),
  defaultCriticality: z.number().int().min(1).max(5),
  description: z.string().nullable(),
  parentSlug: z.string().nullable(),
  tags: z.array(z.string()),
  attributes: z.record(z.unknown()),
});

export const threatTemplateExportSchema = z.object({
  slug: z.string(),
  scenarioName: z.string(),
  adversaryType: z.string(),
  actionType: z.string(),
  adversaryProfile: z.record(z.unknown()).nullable(),
  typicalActions: z.array(z.string()),
  targetAssetTypes: z.array(z.string()),
  indicators: z.array(z.string()),
  suggestedLikelihood: z.number().int().nullable(),
  csmpUnitReference: z.string().nullable(),
  attributes: z.record(z.unknown()),
});

export const countermeasureTemplateExportSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  shapeCategory: z.string(),
  ppsFunctions: z.array(z.string()),
  domain: z.string(),
  defaultTearStrategy: z.string().nullable(),
  defaultEffectiveness: z.string().nullable(),
  typicalCostEstimate: z.number().nullable(),
  typicalAnnualCost: z.number().nullable(),
  tags: z.array(z.string()),
  csmpUnitReference: z.string().nullable(),
  attributes: z.record(z.unknown()),
});

export const moduleExportSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
  assetTemplates: z.array(assetTemplateExportSchema),
  threatTemplates: z.array(threatTemplateExportSchema),
  countermeasureTemplates: z.array(countermeasureTemplateExportSchema),
  assetThreatLinks: z.array(z.object({
    assetSlug: z.string(),
    threatSlug: z.string(),
    relevance: z.string(),
    rationale: z.string().nullable(),
  })),
  threatCountermeasureLinks: z.array(z.object({
    threatSlug: z.string(),
    cmSlug: z.string(),
    relevance: z.string(),
    rationale: z.string().nullable(),
  })),
});

export const packageExportSchema = z.object({
  slug: z.string(),
  name: z.string(),
  industry: z.string().nullable(),
  version: z.string(),
  regionScope: z.string().nullable(),
  description: z.string().nullable(),
  complianceRefs: z.array(z.string()),
  customFieldSchema: z.record(z.unknown()).nullable(),
});

export const packageBundleContentSchema = z.object({
  package: packageExportSchema,
  modules: z.array(moduleExportSchema),
});

export const exportKindEnum = z.enum([
  'package',
  'module',
  'asset-template',
  'threat-template',
  'countermeasure-template',
]);

function envelope<T extends z.ZodTypeAny>(kind: z.ZodTypeAny, content: T) {
  return z.object({
    schemaVersion: z.literal(TEMPLATE_SCHEMA_VERSION),
    kind,
    exportedAt: z.string(),
    sourceOrigin: z.string().optional(),
    content,
  });
}

export const packageBundleEnvelopeSchema = envelope(z.literal('package'), packageBundleContentSchema);
export const moduleEnvelopeSchema = envelope(z.literal('module'), moduleExportSchema);
export const assetTemplateEnvelopeSchema = envelope(z.literal('asset-template'), assetTemplateExportSchema);
export const threatTemplateEnvelopeSchema = envelope(z.literal('threat-template'), threatTemplateExportSchema);
export const countermeasureTemplateEnvelopeSchema = envelope(z.literal('countermeasure-template'), countermeasureTemplateExportSchema);

// ── Shared response shapes ────────────────────────────────

const baseSummary = {
  id: uuid,
  slug: z.string(),
  name: z.string(),
};

export const adminPackageSchema = z.object({
  ...baseSummary,
  industry: z.string().nullable(),
  version: z.string(),
  regionScope: z.string().nullable(),
  description: z.string().nullable(),
  complianceRefs: z.array(z.string()),
  isSystem: z.boolean(),
  enabled: z.boolean(),
  customFieldSchema: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminPackageWithTreeSchema = adminPackageSchema.extend({
  modules: z.array(
    z.object({
      ...baseSummary,
      description: z.string().nullable(),
      icon: z.string().nullable(),
      sortOrder: z.number().int(),
      assetTemplateCount: z.number().int(),
      threatTemplateCount: z.number().int(),
      countermeasureTemplateCount: z.number().int(),
    }),
  ),
});

export const adminModuleDetailSchema = z.object({
  ...baseSummary,
  packageId: uuid,
  description: z.string().nullable(),
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
  assetTemplates: z.array(assetTemplateExportSchema.extend({ id: uuid })),
  threatTemplates: z.array(threatTemplateExportSchema.extend({ id: uuid })),
  countermeasureTemplates: z.array(countermeasureTemplateExportSchema.extend({ id: uuid })),
  assetThreatLinks: z.array(
    z.object({
      assetTemplateId: uuid,
      threatTemplateId: uuid,
      relevance: relevanceEnum,
      rationale: z.string().nullable(),
    }),
  ),
  threatCountermeasureLinks: z.array(
    z.object({
      threatTemplateId: uuid,
      countermeasureTemplateId: uuid,
      relevance: relevanceEnum,
      rationale: z.string().nullable(),
    }),
  ),
});

export const importResultSchema = z.object({
  created: z.array(z.string()),
  updated: z.array(z.string()),
  skipped: z.array(z.string()),
  renamed: z.array(z.object({ from: z.string(), to: z.string() })),
});
