import { z } from 'zod';

export const shapeCategoryEnum = z.enum([
  'SECURITY_PROGRAMME',
  'HUMAN',
  'ARCHITECTURAL',
  'PROCEDURAL',
  'EQUIPMENT',
]);

export const ppsFunctionEnum = z.enum([
  'DETER',
  'DETECT',
  'DELAY',
  'DENY',
  'DISRUPT',
  'DEFEAT',
  'RECOVER',
]);

export const protectionDomainEnum = z.enum([
  'PERIMETER',
  'BUILDING',
  'ACCESS',
  'SURVEILLANCE',
  'INFORMATION',
  'PERSONNEL',
  'COUNTERTERRORISM',
]);

export const implementationStatusEnum = z.enum([
  'PROPOSED',
  'APPROVED',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'VERIFIED',
  'DECOMMISSIONED',
]);

export const tearStrategyEnum = z.enum(['TRANSFER', 'ELIMINATE', 'ACCEPT', 'REDUCE']);

export const vulnerabilityRatingEnum = z.enum([
  'STRONG',
  'BASELINE',
  'BARELY_ADEQUATE',
  'INADEQUATE',
]);

export const implementationHorizonEnum = z.enum(['SHORT', 'MEDIUM', 'LONG']);

const uuid = z.string().uuid();

export const countermeasureSummarySchema = z.object({
  id: uuid,
  name: z.string(),
  shapeCategory: shapeCategoryEnum,
  ppsFunctions: z.array(ppsFunctionEnum),
  domain: protectionDomainEnum,
  implementationStatus: implementationStatusEnum,
  effectivenessRating: vulnerabilityRatingEnum.nullable(),
  tearStrategy: tearStrategyEnum.nullable(),
  costEstimate: z.number().nullable(),
  annualCost: z.number().nullable(),
  assignedToAssetId: uuid.nullable(),
  assignedToThreatId: uuid.nullable(),
  assignedToAssetName: z.string().nullable(),
  assignedToThreatTitle: z.string().nullable(),
  isExisting: z.boolean(),
  effectivenessScore: z.number().int().min(1).max(4).nullable(),
  surveyRatingAtCreation: vulnerabilityRatingEnum.nullable(),
  surveyRatingNumeric: z.number().int().min(1).max(4).nullable(),
  gapDelta: z.number().int().nullable(),
  implementationHorizon: implementationHorizonEnum.nullable(),
  dueDate: z.string().datetime().nullable(),
  ownerUserId: uuid.nullable(),
  updatedAt: z.string().datetime(),
});

export const countermeasureDetailSchema = countermeasureSummarySchema.extend({
  description: z.string().nullable(),
  alarpJustification: z.string().nullable(),
  effectivenessNotes: z.string().nullable(),
  reviewDate: z.string().datetime().nullable(),
  implementationDate: z.string().datetime().nullable(),
  verificationSurveyId: uuid.nullable(),
  alarpAcceptedBy: uuid.nullable(),
  alarpAcceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  sourceTemplateId: uuid.nullable(),
});

export const countermeasureListResponseSchema = z.object({
  items: z.array(countermeasureSummarySchema),
  total: z.number().int(),
});

export const countermeasureCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().nullable().optional(),
  shapeCategory: shapeCategoryEnum,
  ppsFunctions: z.array(ppsFunctionEnum).min(1),
  domain: protectionDomainEnum,
  implementationStatus: implementationStatusEnum.default('PROPOSED'),
  effectivenessRating: vulnerabilityRatingEnum.nullable().optional(),
  tearStrategy: tearStrategyEnum.nullable().optional(),
  costEstimate: z.number().nullable().optional(),
  annualCost: z.number().nullable().optional(),
  assignedToAssetId: uuid.nullable().optional(),
  assignedToThreatId: uuid.nullable().optional(),
  alarpJustification: z.string().nullable().optional(),
  sourceTemplateId: uuid.nullable().optional(),
  isExisting: z.boolean().optional(),
  implementationHorizon: implementationHorizonEnum.nullable().optional(),
  ownerUserId: uuid.nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  reviewDate: z.string().datetime().nullable().optional(),
});

export const countermeasureUpdateSchema = countermeasureCreateSchema.partial();

export const countermeasureListQuerySchema = z.object({
  shapeCategory: shapeCategoryEnum.optional(),
  ppsFunction: ppsFunctionEnum.optional(),
  domain: protectionDomainEnum.optional(),
  implementationStatus: implementationStatusEnum.optional(),
  assignedToAssetId: uuid.optional(),
  assignedToThreatId: uuid.optional(),
  isExisting: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean(),
  ).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

// ── Step 6 bridge endpoints ─────────────────────────────────

export const effectivenessUpdateSchema = z.object({
  effectivenessRating: vulnerabilityRatingEnum,
  effectivenessNotes: z.string().trim().max(2000).nullable().optional(),
});

export const statusTransitionSchema = z.object({
  toStatus: implementationStatusEnum,
  notes: z.string().trim().max(2000).nullable().optional(),
  evidenceUrl: z.string().url().max(500).nullable().optional(),
});
