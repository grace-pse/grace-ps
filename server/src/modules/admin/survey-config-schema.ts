import { z } from 'zod';
import { surveyTypeEnum, surveyQuestionSchema } from '../surveys/schema.js';

// The nine core asset types we expose in the admin UI. Keep in sync with
// the Prisma `AssetType` enum.
export const assetTypeEnum = z.enum([
  'SITE', 'BUILDING', 'FLOOR', 'ROOM', 'ZONE',
  'EQUIPMENT', 'VEHICLE', 'PERSON', 'INFORMATION',
  'IP', 'PROCESS', 'REPUTATION', 'CONTINUITY', 'SYSTEM',
]);

// ── Custom survey types (per-tenant) ──────────────────────────
// Tenants can declare their own type codes (e.g. `PRE_HANDOVER`) that are
// not part of the built-in SurveyType enum. Stored as JSON on
// TenantSurveyConfig; the starter template is materialised into
// `survey_templates` lazily when the user saves the config.
export const customSurveyTypeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,39}$/,
    'Code must be uppercase letters/digits/underscores, 2-40 chars'),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  requiresPhysical: z.boolean().default(false),
  // Per §10 decision 4 — custom types must ship with a usable starter.
  starterTemplate: z.object({
    questions: z.array(surveyQuestionSchema).min(3, 'At least 3 questions required'),
  }),
});

// ── Built-in survey-type overrides ────────────────────────────
// Tenants can rename / tweak the 4 built-in types (PHYSICAL,
// REMOTE_TECH, DOC_REVIEW, HYBRID) without declaring a whole custom
// type. Stored sparse on TenantSurveyConfig — only entries for
// built-ins the tenant actually changed are persisted.
export const builtInSurveyTypeOverrideSchema = z.object({
  code: z.enum(['PHYSICAL', 'REMOTE_TECH', 'DOC_REVIEW', 'HYBRID']),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  requiresPhysical: z.boolean().optional(),
});
export type BuiltInSurveyTypeOverride = z.infer<typeof builtInSurveyTypeOverrideSchema>;

// ── Organization survey config ────────────────────────────────
export const tenantSurveyConfigSchema = z.object({
  organizationId: z.string().uuid(),
  enabledTypes: z.array(z.string()),
  customTypes: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      requiresPhysical: z.boolean(),
    }),
  ),
  builtInOverrides: z.array(builtInSurveyTypeOverrideSchema),
  updatedAt: z.string(),
});

export const tenantSurveyConfigUpdateSchema = z.object({
  enabledTypes: z.array(surveyTypeEnum.or(z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/)))
    .optional(),
  customTypes: z.array(customSurveyTypeSchema).optional(),
  builtInOverrides: z.array(builtInSurveyTypeOverrideSchema).optional(),
});
export type TenantSurveyConfigUpdateInput = z.infer<typeof tenantSurveyConfigUpdateSchema>;

// ── Asset-type survey defaults ────────────────────────────────
export const assetTypeSurveyDefaultSchema = z.object({
  id: z.string().uuid(),
  assetType: assetTypeEnum,
  surveyType: surveyTypeEnum,
  isDefault: z.boolean(),
  templateId: z.string().uuid().nullable(),
  templateName: z.string().nullable(),
  updatedAt: z.string(),
});

export const assetTypeSurveyDefaultListSchema = z.object({
  items: z.array(assetTypeSurveyDefaultSchema),
});

export const assetTypeSurveyDefaultUpsertSchema = z.object({
  assetType: assetTypeEnum,
  surveyType: surveyTypeEnum,
  isDefault: z.boolean().default(false),
  templateId: z.string().uuid().nullable().optional(),
});
export type AssetTypeSurveyDefaultUpsertInput = z.infer<typeof assetTypeSurveyDefaultUpsertSchema>;

// ── Suggestion endpoint output ────────────────────────────────
export const surveyTypeSuggestionSchema = z.object({
  surveyType: surveyTypeEnum,
  templateId: z.string().uuid().nullable(),
  templateName: z.string().nullable(),
  reason: z.enum(['ASSET_TYPE_DEFAULT', 'MAJORITY_VOTE', 'FALLBACK']),
});
