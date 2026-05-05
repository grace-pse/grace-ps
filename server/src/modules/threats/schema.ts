import { z } from 'zod';
import {
  adversaryTypeEnum,
  actionTypeEnum,
  irvBandEnum,
  vulnerabilityEnum,
  riskPriorityEnum,
  tearStrategyEnum,
  complianceTagEnum,
  assessmentStatusEnum,
  threatSummarySchema,
} from '../assessments/schema.js';

const uuid = z.string().uuid();

export const dbtLinkedEnum = z.enum(['yes', 'no']);

export const threatCatalogItemSchema = threatSummarySchema.extend({
  assessmentTitle: z.string().nullable(),
  assessmentStatus: assessmentStatusEnum,
  dbtScenarioName: z.string().nullable(),
  dbtCsmpUnitReference: z.string().nullable(),
  countermeasureCount: z.number().int().nonnegative(),
  actionPlanCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export const threatListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  adversaryType: adversaryTypeEnum.optional(),
  actionType: actionTypeEnum.optional(),
  targetAssetId: uuid.optional(),
  assessmentId: uuid.optional(),
  irv: irvBandEnum.optional(),
  riskTreatmentPriority: riskPriorityEnum.optional(),
  vulnerabilityRating: vulnerabilityEnum.optional(),
  tearStrategy: tearStrategyEnum.optional(),
  dbtLinked: dbtLinkedEnum.optional(),
  complianceTag: complianceTagEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export const threatListResponseSchema = z.object({
  items: z.array(threatCatalogItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
