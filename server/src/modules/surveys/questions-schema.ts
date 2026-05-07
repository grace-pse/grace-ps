import { z } from 'zod';
import { surveyTypeEnum } from './schema.js';

export const questionTypeEnum = z.enum(['yes_no_partial', 'number', 'text', 'select']);
export const severityEnum = z.enum(['ok', 'warn', 'bad']);

export const questionOptionsSchema = z.array(z.string().min(1).max(120)).optional();
export const severityMapSchema = z.record(z.string(), severityEnum).optional();

// Reusable library question — attached M:N to AAA templates and (via scope items) to ClusterSurveyScope.
export const surveyQuestionCreateSchema = z
  .object({
    prompt: z.string().trim().min(1).max(500),
    category: z.string().trim().max(80).optional().nullable(),
    hint: z.string().trim().max(500).optional().nullable(),
    type: questionTypeEnum,
    options: questionOptionsSchema,
    severityMap: severityMapSchema,
    evidenceType: surveyTypeEnum,
    defaultWeight: z.number().int().min(1).max(5).default(1),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'select' && (!val.options || val.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'select questions require at least one option',
      });
    }
  });

export type SurveyQuestionCreateInput = z.infer<typeof surveyQuestionCreateSchema>;

export const surveyQuestionUpdateSchema = z
  .object({
    prompt: z.string().trim().min(1).max(500).optional(),
    category: z.string().trim().max(80).nullable().optional(),
    hint: z.string().trim().max(500).nullable().optional(),
    type: questionTypeEnum.optional(),
    options: questionOptionsSchema.nullable(),
    severityMap: severityMapSchema.nullable(),
    evidenceType: surveyTypeEnum.optional(),
    defaultWeight: z.number().int().min(1).max(5).optional(),
    isActive: z.boolean().optional(),
  });

export type SurveyQuestionUpdateInput = z.infer<typeof surveyQuestionUpdateSchema>;

export const surveyQuestionSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  prompt: z.string(),
  category: z.string().nullable(),
  hint: z.string().nullable(),
  type: questionTypeEnum,
  options: z.array(z.string()).nullable(),
  severityMap: z.record(z.string(), severityEnum).nullable(),
  evidenceType: surveyTypeEnum,
  defaultWeight: z.number().int(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  attachedTemplateCount: z.number().int(),
  updatedAt: z.string(),
});

export const surveyQuestionListResponseSchema = z.object({
  items: z.array(surveyQuestionSummarySchema),
});

// ── Template ↔ Question link schemas ─────────────────────────
export const templateQuestionLinkUpsertSchema = z.object({
  weight: z.number().int().min(1).max(5).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  rationale: z.string().trim().max(1000).nullable().optional(),
});

export const templateQuestionLinkSchema = z.object({
  questionId: z.string().uuid(),
  prompt: z.string(),
  type: questionTypeEnum,
  evidenceType: surveyTypeEnum,
  defaultWeight: z.number().int(),
  weight: z.number().int().nullable(),
  sortOrder: z.number().int(),
  rationale: z.string().nullable(),
});

export const templateQuestionLinkListSchema = z.object({
  items: z.array(templateQuestionLinkSchema),
});

// Reverse: list AAA templates that attach a given question. Used by the
// Question detail panel to surface "where is this question used".
const questionAttachmentItemSchema = z.object({
  templateId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  moduleName: z.string(),
  packageName: z.string(),
  weight: z.number().int().nullable(),
  sortOrder: z.number().int(),
  rationale: z.string().nullable(),
});

export const questionAttachmentsResponseSchema = z.object({
  asset: z.array(questionAttachmentItemSchema),
  threat: z.array(questionAttachmentItemSchema),
  cm: z.array(questionAttachmentItemSchema),
});
