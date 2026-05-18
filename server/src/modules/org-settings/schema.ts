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
  // Optional with default for backward-compat: orgs that saved before nodeBg
  // existed will hydrate with #ffffff and keep working.
  nodeBg: hexColor.default('#ffffff'),
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

const nodePortStyleSchema = z.object({
  size: z.number().min(4).max(20),
  shape: z.enum(['square', 'circle', 'rounded']),
  spatialColor: hexColor,
  logicalColor: hexColor,
  borderWidth: z.number().min(0).max(4),
  borderColor: hexColor,
  disabledOpacity: z.number().min(0).max(1),
});

// Default applied when an org row predates this field. Mirrors
// DEFAULT_NODE_PORT_STYLE on the client; keep the two in sync.
const DEFAULT_NODE_PORT_STYLE = {
  size: 9,
  shape: 'square',
  spatialColor: '#94a3b8',
  logicalColor: '#6366f1',
  borderWidth: 1.5,
  borderColor: '#ffffff',
  disabledOpacity: 0.22,
} as const;

const ASSET_ROLES = ['PROTECTED', 'PROTECTIVE', 'DUAL'] as const;
const ASSET_TYPES = [
  'SITE', 'BUILDING', 'FLOOR', 'ROOM', 'ZONE',
  'EQUIPMENT', 'VEHICLE', 'PERSON', 'INFORMATION',
  'IP', 'PROCESS', 'REPUTATION', 'CONTINUITY', 'SYSTEM',
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
  nodePortStyle: nodePortStyleSchema.default(DEFAULT_NODE_PORT_STYLE),
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
