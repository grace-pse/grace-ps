import { z } from 'zod';

const uuid = z.string().uuid();

export const assessmentTypeEnum = z.enum([
  'FULL_SRA', 'VULNERABILITY_ASSESSMENT', 'THREAT_ASSESSMENT', 'SURVEY', 'AUDIT',
]);

export const assessmentStatusEnum = z.enum([
  'DRAFT',
  'STEP_1_ASSETS', 'STEP_2_THREATS', 'STEP_3_LIKELIHOOD', 'STEP_4_IMPACT',
  'STEP_5_IRV', 'STEP_6_VULNERABILITY', 'STEP_7_TREATMENT',
  'REVIEW', 'APPROVED', 'ARCHIVED',
]);

export const reviewStatusEnum = z.enum([
  'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED',
]);

export const adversaryTypeEnum = z.enum([
  'CRIMINAL', 'TERRORIST', 'INSIDER', 'COMPETITOR', 'ACTIVIST',
  'NATION_STATE', 'OPPORTUNIST', 'NATURAL',
]);

export const actionTypeEnum = z.enum([
  'THEFT', 'DAMAGE', 'DISRUPTION', 'ESPIONAGE', 'SABOTAGE',
  'ASSAULT', 'INTRUSION', 'FRAUD', 'ARSON', 'BOMB', 'CYBER', 'NATURAL_DISASTER',
]);

export const irvBandEnum = z.enum(['NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH', 'EXTREME']);
export const vulnerabilityEnum = z.enum(['STRONG', 'BASELINE', 'BARELY_ADEQUATE', 'INADEQUATE']);
export const riskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'HIGHEST']);
export const tearStrategyEnum = z.enum(['TRANSFER', 'ELIMINATE', 'ACCEPT', 'REDUCE']);
export const complianceTagEnum = z.enum([
  'ISO_31000', 'NIS2_ART_21', 'NIS2_ART_23', 'CER', 'ASIS_SPC_1', 'ISO_28000',
]);
export const complianceTagsArray = z.array(complianceTagEnum);

// ── Assessments ────────────────────────────────────────────

export const assessmentSummarySchema = z.object({
  id: uuid,
  title: z.string(),
  assessmentType: assessmentTypeEnum,
  status: assessmentStatusEnum,
  currentStep: z.number().int().min(1).max(7),
  reviewStatus: reviewStatusEnum,
  assetId: uuid.nullable(),
  clusterId: uuid.nullable(),
  assetName: z.string().nullable(),
  clusterName: z.string().nullable(),
  leadAssessorId: uuid,
  leadAssessorName: z.string().nullable(),
  approverId: uuid.nullable(),
  version: z.string(),
  period: z.string().nullable(),
  scopeDescription: z.string().nullable(),
  threatCount: z.number().int(),
  highestPriority: riskPriorityEnum.nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  signedOffAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});

export const threatSummarySchema = z.object({
  id: uuid,
  assessmentId: uuid,
  targetAssetId: uuid,
  targetAssetName: z.string().nullable(),
  adversaryType: adversaryTypeEnum,
  actionType: actionTypeEnum,
  adversaryDescription: z.string().nullable(),
  actionDescription: z.string().nullable(),
  locationContext: z.string().nullable(),
  facilitatingFactors: z.string().nullable(),
  timeContext: z.string().nullable(),
  likelihoodScore: z.number().int().min(1).max(5).nullable(),
  likelihoodRationale: z.string().nullable(),
  impactScore: z.number().int().min(1).max(5).nullable(),
  impactRationale: z.string().nullable(),
  impactBreakdown: z.record(z.number()).nullable(),
  irv: irvBandEnum.nullable(),
  vulnerabilityRating: vulnerabilityEnum.nullable(),
  vulnerabilityRationale: z.string().nullable(),
  riskTreatmentPriority: riskPriorityEnum.nullable(),
  tearStrategy: tearStrategyEnum.nullable(),
  alarpJustification: z.string().nullable(),
  complianceTags: complianceTagsArray.default([]),
  dbtReferenceId: uuid.nullable(),
});

export const assessmentDetailSchema = assessmentSummarySchema.extend({
  threats: z.array(threatSummarySchema),
  reviewedById: uuid.nullable(),
  reviewNotes: z.string().nullable(),
});

export const assessmentCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  assessmentType: assessmentTypeEnum.default('FULL_SRA'),
  assetId: uuid.nullable().optional(),
  clusterId: uuid.nullable().optional(),
}).refine(
  (d) => Boolean(d.assetId) !== Boolean(d.clusterId),
  { message: 'Provide exactly one of assetId or clusterId' },
);

export const assessmentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  assessmentType: assessmentTypeEnum.optional(),
  approverId: uuid.nullable().optional(),
  version: z.string().trim().min(1).max(16).optional(),
  period: z.string().trim().max(40).nullable().optional(),
  scopeDescription: z.string().trim().nullable().optional(),
});

export const assessmentListQuerySchema = z.object({
  search: z.string().optional(),
  status: assessmentStatusEnum.optional(),
  reviewStatus: reviewStatusEnum.optional(),
  leadAssessorId: uuid.optional(),
  complianceTag: complianceTagEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const assessmentListResponseSchema = z.object({
  items: z.array(assessmentSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

// ── Threats ────────────────────────────────────────────────

export const threatCreateSchema = z.object({
  targetAssetId: uuid,
  adversaryType: adversaryTypeEnum,
  actionType: actionTypeEnum,
  adversaryDescription: z.string().nullable().optional(),
  actionDescription: z.string().nullable().optional(),
  locationContext: z.string().nullable().optional(),
  facilitatingFactors: z.string().nullable().optional(),
  timeContext: z.string().nullable().optional(),
  complianceTags: complianceTagsArray.optional(),
  dbtReferenceId: uuid.nullable().optional(),
});

export const threatUpdateSchema = threatCreateSchema.partial();

export const likelihoodRatingSchema = z.object({
  likelihoodScore: z.number().int().min(1).max(5),
  likelihoodRationale: z.string().trim().min(1),
});

export const impactRatingSchema = z.object({
  impactRationale: z.string().trim().min(1),
  impactBreakdown: z.object({
    people: z.number().int().min(1).max(5),
    property: z.number().int().min(1).max(5),
    operations: z.number().int().min(1).max(5),
    reputation: z.number().int().min(1).max(5),
    financial: z.number().int().min(1).max(5),
  }),
});

export const vulnerabilityRatingSchema = z.object({
  vulnerabilityRating: vulnerabilityEnum,
  vulnerabilityRationale: z.string().trim().min(1),
});

export const tearStrategySchema = z.object({
  tearStrategy: tearStrategyEnum,
  alarpJustification: z.string().trim().nullable().optional(),
});

// ── Template-based threat suggestion ───────────────────────

export const relevanceEnum = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const suggestedThreatSchema = z.object({
  assetId: uuid,
  assetName: z.string(),
  threatTemplateId: uuid,
  scenarioName: z.string(),
  adversaryType: adversaryTypeEnum,
  actionType: actionTypeEnum,
  relevance: relevanceEnum,
  rationale: z.string().nullable(),
  csmpUnitReference: z.string().nullable(),
  alreadyAdded: z.boolean(),
});

export const suggestedThreatsResponseSchema = z.object({
  items: z.array(suggestedThreatSchema),
});

export const threatFromTemplateSchema = z.object({
  targetAssetId: uuid,
  threatTemplateId: uuid,
});

// ── Review ─────────────────────────────────────────────────

export const reviewActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().trim().default(''),
});

export const advanceResponseSchema = z.object({
  id: uuid,
  status: assessmentStatusEnum,
  currentStep: z.number().int(),
  reviewStatus: reviewStatusEnum,
});
