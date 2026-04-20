import { z } from 'zod';

export const assetTypeEnum = z.enum([
  'SITE', 'BUILDING', 'FLOOR', 'ROOM', 'ZONE',
  'EQUIPMENT', 'VEHICLE', 'PERSON', 'INFORMATION',
  'IP', 'PROCESS', 'REPUTATION', 'CONTINUITY',
]);
export const assetCategoryEnum = z.enum(['TANGIBLE', 'INTANGIBLE']);
export const assetStatusEnum = z.enum(['ACTIVE', 'DECOMMISSIONED', 'UNDER_REVIEW', 'COMPROMISED']);

const uuid = z.string().uuid();

export const assetSummarySchema = z.object({
  id: uuid,
  name: z.string(),
  assetType: assetTypeEnum,
  category: assetCategoryEnum,
  criticality: z.number().int().min(1).max(5),
  status: assetStatusEnum,
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
  parentId: uuid.nullable(),
  location: z.record(z.unknown()).nullable(),
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
  parentId: uuid.nullable().optional(),
  location: z.record(z.unknown()).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).default([]),
  sourceTemplateId: uuid.nullable().optional(),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export const assetListQuerySchema = z.object({
  search: z.string().optional(),
  assetType: assetTypeEnum.optional(),
  category: assetCategoryEnum.optional(),
  status: assetStatusEnum.optional(),
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
  'COMMUNICATES_WITH', 'ADJACENT_TO', 'SUPPLIES',
]);
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

export const assetGraphNodeSchema = z.object({
  id: uuid,
  name: z.string(),
  assetType: assetTypeEnum,
  category: assetCategoryEnum,
  criticality: z.number().int().min(1).max(5),
  status: assetStatusEnum,
  parentId: uuid.nullable(),
});

export const assetGraphResponseSchema = z.object({
  nodes: z.array(assetGraphNodeSchema),
  edges: z.array(assetRelationshipSchema),
});

export type AssetRelationshipCreateInput = z.infer<typeof assetRelationshipCreateSchema>;
