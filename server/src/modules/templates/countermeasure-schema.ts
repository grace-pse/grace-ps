import { z } from 'zod';
import {
  shapeCategoryEnum,
  ppsFunctionEnum,
  protectionDomainEnum,
  tearStrategyEnum,
  vulnerabilityRatingEnum,
} from '../countermeasures/schema.js';
import { relevanceEnum } from './schema.js';

const uuid = z.string().uuid();

export const countermeasureTemplateSummarySchema = z.object({
  id: uuid,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  shapeCategory: shapeCategoryEnum,
  ppsFunctions: z.array(ppsFunctionEnum),
  domain: protectionDomainEnum,
  defaultTearStrategy: tearStrategyEnum.nullable(),
  defaultEffectiveness: vulnerabilityRatingEnum.nullable(),
  typicalCostEstimate: z.number().nullable(),
  typicalAnnualCost: z.number().nullable(),
  tags: z.array(z.string()),
  csmpUnitReference: z.string().nullable(),
  module: z.object({
    id: uuid,
    slug: z.string(),
    name: z.string(),
    package: z.object({
      id: uuid,
      slug: z.string(),
      name: z.string(),
    }),
  }),
});

export const countermeasureTemplateDetailSchema = countermeasureTemplateSummarySchema.extend({
  threatLinks: z.array(
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

export const countermeasureTemplateListQuerySchema = z.object({
  search: z.string().optional(),
  packageSlug: z.string().optional(),
  moduleSlug: z.string().optional(),
  shapeCategory: shapeCategoryEnum.optional(),
  domain: protectionDomainEnum.optional(),
  ppsFunction: ppsFunctionEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export const countermeasureTemplateListResponseSchema = z.object({
  items: z.array(countermeasureTemplateSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const threatCountermeasureListResponseSchema = z.object({
  items: z.array(
    z.object({
      relevance: relevanceEnum,
      rationale: z.string().nullable(),
      countermeasureTemplate: countermeasureTemplateSummarySchema,
    }),
  ),
});
