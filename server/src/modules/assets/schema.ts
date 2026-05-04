import { z } from 'zod';

export const assetTypeEnum = z.enum([
  'SITE', 'BUILDING', 'FLOOR', 'ROOM', 'ZONE',
  'EQUIPMENT', 'VEHICLE', 'PERSON', 'INFORMATION',
  'IP', 'PROCESS', 'REPUTATION', 'CONTINUITY',
]);
export const assetCategoryEnum = z.enum(['TANGIBLE', 'INTANGIBLE']);
export const assetStatusEnum = z.enum(['ACTIVE', 'DECOMMISSIONED', 'UNDER_REVIEW', 'COMPROMISED']);
export const assetRoleEnum = z.enum(['PROTECTED', 'PROTECTIVE', 'DUAL']);
export const operationalStatusEnum = z.enum(['OPERATIONAL', 'DEGRADED', 'FAILED', 'UNKNOWN']);

const uuid = z.string().uuid();

export const assetLocationSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  address: z.string().max(500).optional(),
}).nullable();

export const assetSummarySchema = z.object({
  id: uuid,
  name: z.string(),
  assetType: assetTypeEnum,
  category: assetCategoryEnum,
  criticality: z.number().int().min(1).max(5),
  status: assetStatusEnum,
  assetRole: assetRoleEnum,
  operationalStatus: operationalStatusEnum,
  degradedControlPosture: z.boolean(),
  degradedControlSince: z.string().datetime().nullable(),
  parentId: uuid.nullable(),
  tags: z.array(z.string()),
  childCount: z.number().int(),
  updatedAt: z.string().datetime(),
});

export const assetDetailSchema = z.object({
  id: uuid,
  name: z.string(),
  assetType: assetTypeEnum,
  category: assetCategoryEnum,
  description: z.string().nullable(),
  criticality: z.number().int().min(1).max(5),
  status: assetStatusEnum,
  assetRole: assetRoleEnum,
  operationalStatus: operationalStatusEnum,
  degradedControlPosture: z.boolean(),
  degradedControlSince: z.string().datetime().nullable(),
  parentId: uuid.nullable(),
  location: assetLocationSchema,
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()),
  sourceTemplateId: uuid.nullable(),
  createdById: uuid,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  parent: z.object({ id: uuid, name: z.string() }).nullable(),
  children: z.array(assetSummarySchema),
});

export const assetCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  assetType: assetTypeEnum,
  category: assetCategoryEnum,
  description: z.string().nullable().optional(),
  criticality: z.number().int().min(1).max(5).default(3),
  status: assetStatusEnum.default('ACTIVE'),
  assetRole: assetRoleEnum.default('PROTECTED'),
  operationalStatus: operationalStatusEnum.default('OPERATIONAL'),
  parentId: uuid.nullable().optional(),
  location: assetLocationSchema.optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).default([]),
  sourceTemplateId: uuid.nullable().optional(),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export const assetCloneSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});
export type AssetCloneInput = z.infer<typeof assetCloneSchema>;

export const assetListQuerySchema = z.object({
  search: z.string().optional(),
  assetType: assetTypeEnum.optional(),
  category: assetCategoryEnum.optional(),
  status: assetStatusEnum.optional(),
  assetRole: assetRoleEnum.optional(),
  operationalStatus: operationalStatusEnum.optional(),
  degradedControlPosture: z.coerce.boolean().optional(),
  parentId: z.union([uuid, z.literal('none')]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const assetListResponseSchema = z.object({
  items: z.array(assetSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;

// ─── RELATIONSHIPS ───────────────────────────────────────

export const relationshipTypeEnum = z.enum([
  'DEPENDS_ON', 'PROTECTS', 'SERVES', 'CONTAINS',
  'COMMUNICATES_WITH', 'ADJACENT_TO', 'SUPPLIES', 'MONITORS',
]);

export const protectiveRelationshipEnum = z.enum(['PROTECTS', 'MONITORS']);
export const relDirectionEnum = z.enum(['UNIDIRECTIONAL', 'BIDIRECTIONAL']);

export const assetRelationshipSchema = z.object({
  id: uuid,
  sourceAssetId: uuid,
  targetAssetId: uuid,
  relationshipType: relationshipTypeEnum,
  direction: relDirectionEnum,
  impactPropagation: z.boolean(),
  description: z.string().nullable(),
});

export const assetRelationshipCreateSchema = z.object({
  sourceAssetId: uuid,
  targetAssetId: uuid,
  relationshipType: relationshipTypeEnum,
  direction: relDirectionEnum.default('UNIDIRECTIONAL'),
  impactPropagation: z.boolean().default(false),
  description: z.string().nullable().optional(),
});

export const assetRelationshipUpdateSchema = z.object({
  relationshipType: relationshipTypeEnum.optional(),
  direction: relDirectionEnum.optional(),
  impactPropagation: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

export const assetGraphNodeSchema = z.object({
  id: uuid,
  name: z.string(),
  assetType: assetTypeEnum,
  category: assetCategoryEnum,
  criticality: z.number().int().min(1).max(5),
  status: assetStatusEnum,
  parentId: uuid.nullable(),
  assetRole: assetRoleEnum,
});

export const assetGraphResponseSchema = z.object({
  nodes: z.array(assetGraphNodeSchema),
  edges: z.array(assetRelationshipSchema),
});

export type AssetRelationshipCreateInput = z.infer<typeof assetRelationshipCreateSchema>;
export type AssetRelationshipUpdateInput = z.infer<typeof assetRelationshipUpdateSchema>;

// ─── PROTECTIVE COVERAGE ─────────────────────────────────

// Source of a coverage entry:
//  - 'EDGE'              — explicit AssetRelationship of type PROTECTS or MONITORS
//                          (counts toward degraded-posture propagation, has a
//                          known relationshipType)
//  - 'IMPLICIT_LOCATION' — a PROTECTIVE / DUAL asset that lives somewhere
//                          inside the threat-target's parent_id subtree, with
//                          no explicit edge yet. Display-only; ignored by
//                          propagateAssetRisk so the §4 bridge stays a hard
//                          invariant.
export const coverageSourceEnum = z.enum(['EDGE', 'IMPLICIT_LOCATION']);

export const protectiveCoverageItemSchema = z.object({
  protectiveAssetId: uuid,
  name: z.string(),
  assetType: assetTypeEnum,
  criticality: z.number().int().min(1).max(5),
  source: coverageSourceEnum,
  relationshipType: protectiveRelationshipEnum.nullable(),
  operationalStatus: operationalStatusEnum,
  degradedSince: z.string().datetime().nullable(),
});

export const protectiveCoverageResponseSchema = z.object({
  targetAssetId: uuid,
  items: z.array(protectiveCoverageItemSchema),
});
