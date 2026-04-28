import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────
export const surveyTypeEnum = z.enum(['PHYSICAL', 'REMOTE_TECH', 'DOC_REVIEW', 'HYBRID', 'CUSTOM']);
export const surveyRatingEnum = z.enum(['STRONG', 'BASELINE', 'BARELY_ADEQUATE', 'INADEQUATE']);
export const surveyStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);

// ── Question schema (lives inside template.schema.questions) ──
export const surveyQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  category: z.string().max(80).optional(),
  prompt: z.string().min(1).max(500),
  type: z.enum(['yes_no_partial', 'number', 'text', 'select']),
  weight: z.number().int().min(1).max(5).default(1),
  hint: z.string().max(300).optional(),
  options: z.array(z.string().max(80)).optional(),
  severityMap: z.record(z.string(), z.enum(['ok', 'warn', 'bad'])).optional(),
});

export const surveyTemplateContentSchema = z.object({
  questions: z.array(surveyQuestionSchema).min(1).max(200),
});

// ── Template I/O schemas ──────────────────────────────────────
export const surveyTemplateSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  surveyType: surveyTypeEnum,
  applicableClusterTypes: z.array(z.string()),
  applicableAssetTypes: z.array(z.string()),
  requiresPhysical: z.boolean(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  questionCount: z.number().int().min(0),
  updatedAt: z.string(),
});

export const surveyTemplateDetailSchema = surveyTemplateSummarySchema.extend({
  schema: surveyTemplateContentSchema,
});

export const surveyTemplateListResponseSchema = z.object({
  items: z.array(surveyTemplateSummarySchema),
});

export const surveyTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  surveyType: surveyTypeEnum,
  applicableClusterTypes: z.array(z.string().max(40)).default([]),
  applicableAssetTypes: z.array(z.string().max(40)).default([]),
  requiresPhysical: z.boolean().default(true),
  schema: surveyTemplateContentSchema,
});
export type SurveyTemplateCreateInput = z.infer<typeof surveyTemplateCreateSchema>;

export const surveyTemplateUpdateSchema = surveyTemplateCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type SurveyTemplateUpdateInput = z.infer<typeof surveyTemplateUpdateSchema>;

export const surveyTemplateForkSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});
export type SurveyTemplateForkInput = z.infer<typeof surveyTemplateForkSchema>;

// ── Response I/O schemas ──────────────────────────────────────
export const surveyResponseSummarySchema = z.object({
  id: z.string().uuid(),
  clusterId: z.string().uuid(),
  clusterName: z.string().nullable(),
  templateId: z.string().uuid(),
  templateName: z.string().nullable(),
  surveyType: surveyTypeEnum,
  conductedById: z.string().uuid(),
  conductedByName: z.string().nullable(),
  conductedAt: z.string(),
  scorePct: z.number().nullable(),
  rating: surveyRatingEnum.nullable(),
  evidenceSource: z.string().nullable(),
  requiresPhysical: z.boolean(),
  status: surveyStatusEnum,
  updatedAt: z.string(),
});

export const surveyResponseDetailSchema = surveyResponseSummarySchema.extend({
  answers: z.record(z.string(), z.unknown()),
  template: surveyTemplateDetailSchema,
});

export const surveyResponseListResponseSchema = z.object({
  items: z.array(surveyResponseSummarySchema),
});

export const surveyResponseCreateSchema = z.object({
  clusterId: z.string().uuid(),
  templateId: z.string().uuid(),
  evidenceSource: z.string().trim().max(120).optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
  conductedAt: z.string().datetime().optional(),
});
export type SurveyResponseCreateInput = z.infer<typeof surveyResponseCreateSchema>;

export const surveyResponseUpdateSchema = z.object({
  answers: z.record(z.string(), z.unknown()).optional(),
  evidenceSource: z.string().trim().max(120).nullable().optional(),
});
export type SurveyResponseUpdateInput = z.infer<typeof surveyResponseUpdateSchema>;

// ── Link schema ───────────────────────────────────────────────
export const assessmentSurveyLinkCreateSchema = z.object({
  surveyResponseId: z.string().uuid(),
  vulnerabilityOverride: z.boolean().default(false),
});

export const assessmentSurveyLinkSchema = z.object({
  surveyResponseId: z.string().uuid(),
  surveyType: surveyTypeEnum,
  templateName: z.string(),
  clusterName: z.string().nullable(),
  status: surveyStatusEnum,
  rating: surveyRatingEnum.nullable(),
  scorePct: z.number().nullable(),
  conductedAt: z.string(),
  linkedAt: z.string(),
  linkedByName: z.string().nullable(),
  vulnerabilityOverride: z.boolean(),
});

export const assessmentSurveyLinkListSchema = z.object({
  items: z.array(assessmentSurveyLinkSchema),
});
