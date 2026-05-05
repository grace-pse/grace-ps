import { z } from 'zod';
import { assetTypeEnum, assetCategoryEnum, assetRoleEnum } from '../assets/schema.js';

const uuid = z.string().uuid();

export const relevanceEnum = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const templatePackageSchema = z.object({
  id: uuid,
  slug: z.string(),
  name: z.string(),
  industry: z.string().nullable(),
  version: z.string(),
  description: z.string().nullable(),
  complianceRefs: z.array(z.string()),
  enabled: z.boolean(),
  moduleCount: z.number().int(),
  assetTemplateCount: z.number().int(),
});

export const templateModuleSchema = z.object({
  id: uuid,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
  assetTemplateCount: z.number().int(),
});

export const assetTemplateSummarySchema = z.object({
  id: uuid,
  slug: z.string(),
  name: z.string(),
  assetType: assetTypeEnum,
  category: assetCategoryEnum,
  defaultCriticality: z.number().int().min(1).max(5),
  defaultAssetRole: assetRoleEnum.nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  module: z.object({
    id: uuid,
    slug: z.string(),
    name: z.string(),
    package: z.object({
      id: uuid,
      slug: z.string(),
      name: z.string(),
      enabled: z.boolean(),
    }),
  }),
});

export const assetTemplateDetailSchema = assetTemplateSummarySchema.extend({
  parentSlug: z.string().nullable(),
  attributes: z.record(z.unknown()).nullable(),
  recommendedThreats: z.array(
    z.object({
      relevance: relevanceEnum,
      rationale: z.string().nullable(),
      threatTemplate: z.object({
        id: uuid,
        slug: z.string(),
        scenarioName: z.string(),
        adversaryType: z.string(),
        actionType: z.string(),
      }),
    }),
  ),
});

export const templateListQuerySchema = z.object({
  search: z.string().optional(),
  packageSlug: z.string().optional(),
  moduleSlug: z.string().optional(),
  assetType: assetTypeEnum.optional(),
  category: assetCategoryEnum.optional(),
  // When true, only surface templates from enabled packages. The asset-form
  // subtype picker opts in explicitly so end-users mid-edit don't see hidden
  // packages. Default false so the admin browse / template-library page sees
  // everything and the count in the sidebar matches the listing.
  enabledOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const templateListResponseSchema = z.object({
  items: z.array(assetTemplateSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const packageListResponseSchema = z.object({
  items: z.array(templatePackageSchema),
});

export const moduleListResponseSchema = z.object({
  items: z.array(templateModuleSchema),
  package: templatePackageSchema,
});
