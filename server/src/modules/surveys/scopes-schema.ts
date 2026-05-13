import { z } from 'zod';
import { surveyTypeEnum, surveyRatingEnum } from './schema.js';
import { questionTypeEnum } from './questions-schema.js';

export const scopeStatusEnum = z.enum(['DRAFT', 'APPROVED', 'ARCHIVED']);
export const scopeAggregationModeEnum = z.enum(['AGGREGATE_BY_CM_TEMPLATE', 'PER_INSTANCE']);
export const scopeItemSourceEnum = z.enum([
  'ASSET',
  'THREAT',
  'COUNTERMEASURE',
  'COUNTERMEASURE_GROUP',
  'MANUAL',
]);

// ── Scope create / update ─────────────────────────────────
export const clusterSurveyScopeCreateSchema = z.object({
  clusterId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).nullable().optional(),
  evidenceTypes: z.array(surveyTypeEnum).min(1).max(5),
  aggregationMode: scopeAggregationModeEnum.default('AGGREGATE_BY_CM_TEMPLATE'),
});
export type ClusterSurveyScopeCreateInput = z.infer<typeof clusterSurveyScopeCreateSchema>;

export const clusterSurveyScopeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  evidenceTypes: z.array(surveyTypeEnum).min(1).max(5).optional(),
  aggregationMode: scopeAggregationModeEnum.optional(),
});
export type ClusterSurveyScopeUpdateInput = z.infer<typeof clusterSurveyScopeUpdateSchema>;

// ── Item add (manual) / update ───────────────────────────
export const scopeItemAddSchema = z.object({
  questionId: z.string().uuid(),
  sourceType: scopeItemSourceEnum,
  sourceAssetId: z.string().uuid().nullable().optional(),
  sourceThreatId: z.string().uuid().nullable().optional(),
  sourceCountermeasureId: z.string().uuid().nullable().optional(),
  sourceCountermeasureTemplateId: z.string().uuid().nullable().optional(),
  weightOverride: z.number().int().min(1).max(5).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const scopeItemUpdateSchema = z.object({
  weightOverride: z.number().int().min(1).max(5).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

// ── Output shapes ─────────────────────────────────────────
export const scopeItemSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  prompt: z.string(),
  type: questionTypeEnum,
  evidenceType: surveyTypeEnum,
  defaultWeight: z.number().int(),
  effectiveWeight: z.number().int(),
  sourceType: scopeItemSourceEnum,
  sourceAssetId: z.string().uuid().nullable(),
  sourceThreatId: z.string().uuid().nullable(),
  sourceCountermeasureId: z.string().uuid().nullable(),
  sourceCountermeasureTemplateId: z.string().uuid().nullable(),
  sourceLabel: z.string(),
  weightOverride: z.number().int().nullable(),
  sortOrder: z.number().int(),
});

export const clusterSurveyScopeSummarySchema = z.object({
  id: z.string().uuid(),
  clusterId: z.string().uuid(),
  clusterName: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  evidenceTypes: z.array(surveyTypeEnum),
  aggregationMode: scopeAggregationModeEnum,
  status: scopeStatusEnum,
  version: z.number().int(),
  supersedesId: z.string().uuid().nullable(),
  createdById: z.string().uuid(),
  createdByName: z.string().nullable(),
  approvedById: z.string().uuid().nullable(),
  approvedByName: z.string().nullable(),
  approvedAt: z.string().nullable(),
  itemCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const clusterSurveyScopeDetailSchema = clusterSurveyScopeSummarySchema.extend({
  items: z.array(scopeItemSchema),
});

export const clusterSurveyScopeListResponseSchema = z.object({
  items: z.array(clusterSurveyScopeSummarySchema),
});

// ── Per-AAA score read shape ──────────────────────────────
export const surveyResponseAaaScoreSchema = z.object({
  id: z.string().uuid(),
  sourceType: scopeItemSourceEnum,
  sourceAssetId: z.string().uuid().nullable(),
  sourceThreatId: z.string().uuid().nullable(),
  sourceCountermeasureId: z.string().uuid().nullable(),
  sourceCountermeasureTemplateId: z.string().uuid().nullable(),
  sourceLabel: z.string(),
  scorePct: z.number().nullable(),
  rating: surveyRatingEnum.nullable(),
  answeredCount: z.number().int(),
  totalCount: z.number().int(),
});
