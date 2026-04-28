import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB hex color');
const iconName = z.string().min(1).max(40).regex(/^[A-Z][A-Za-z0-9]+$/, 'Expected PascalCase Lucide icon name');
const dashArray = z
  .string()
  .regex(/^\d+(\s+\d+)*$/, 'Expected stroke-dasharray like "4 3"')
  .nullable();
const borderStyle = z.enum(['solid', 'dashed', 'dotted']);

const assetRoleStyleSchema = z.object({
  borderColor: hexColor,
  borderWidth: z.number().int().min(1).max(8),
  borderStyle,
  iconName,
  chipBg: hexColor,
  chipInk: hexColor,
});

const assetTypeStyleSchema = z.object({
  color: hexColor,
  bg: hexColor,
  ink: hexColor,
  iconName,
  abbr: z.string().min(1).max(8),
});

const edgeStyleSchema = z.object({
  stroke: hexColor,
  strokeWidth: z.number().min(0.5).max(8),
  dashArray,
  showLabel: z.boolean(),
});

const riskColorSchema = z.object({
  bg: hexColor,
  ink: hexColor,
});

const ASSET_ROLES = ['PROTECTED', 'PROTECTIVE', 'DUAL'] as const;
const ASSET_TYPES = [
  'SITE', 'BUILDING', 'FLOOR', 'ROOM', 'ZONE',
  'EQUIPMENT', 'VEHICLE', 'PERSON', 'INFORMATION',
  'IP', 'PROCESS', 'REPUTATION', 'CONTINUITY',
] as const;
const RELATIONSHIP_TYPES = [
  'DEPENDS_ON', 'PROTECTS', 'SERVES', 'CONTAINS',
  'COMMUNICATES_WITH', 'ADJACENT_TO', 'SUPPLIES', 'MONITORS',
] as const;
const RISK_LEVELS = ['Negligible', 'Low', 'Moderate', 'High', 'Extreme'] as const;

function exhaustiveRecord<K extends readonly string[], V extends z.ZodTypeAny>(keys: K, value: V) {
  const shape: Record<string, V> = {};
  for (const k of keys) shape[k] = value;
  return z.object(shape).strict();
}

export const appearanceSchema = z.object({
  v: z.literal(1),
  assetRoleStyles: exhaustiveRecord(ASSET_ROLES, assetRoleStyleSchema),
  assetTypeStyles: exhaustiveRecord(ASSET_TYPES, assetTypeStyleSchema),
  edgeStyles: exhaustiveRecord(RELATIONSHIP_TYPES, edgeStyleSchema),
  riskColors: exhaustiveRecord(RISK_LEVELS, riskColorSchema),
});

export const orgSettingsResponseSchema = z.object({
  appearance: appearanceSchema.nullable(),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    subscriptionTier: z.enum(['FREE', 'PROFESSIONAL', 'ENTERPRISE']),
    isActive: z.boolean(),
    createdAt: z.string(),
    memberCount: z.number().int(),
  }),
});

export const orgSettingsPatchBodySchema = z.object({
  appearance: appearanceSchema,
});

export const orgSettingsPatchResponseSchema = z.object({
  appearance: appearanceSchema,
});

export const orgPatchBodySchema = z.object({
  name: z.string().min(1).max(255),
});

export const orgPatchResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  subscriptionTier: z.enum(['FREE', 'PROFESSIONAL', 'ENTERPRISE']),
  isActive: z.boolean(),
});

export type AppearanceSettings = z.infer<typeof appearanceSchema>;
