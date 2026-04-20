import { z } from 'zod';
import { assetSummarySchema } from '../assets/schema.js';

export const clusterTypeEnum = z.enum(['OPERATIONAL', 'SPATIAL', 'LOGICAL', 'TEMPORAL']);
export const criticalityModeEnum = z.enum(['HIGHEST', 'AVERAGE', 'CUSTOM']);
export const propagationModeEnum = z.enum([
  'CASCADE_DOWN', 'CASCADE_UP', 'BIDIRECTIONAL', 'NONE',
]);

const uuid = z.string().uuid();

export const clusterMembershipInputSchema = z.object({
  assetId: uuid,
  roleInCluster: z.string().max(100).nullable().optional(),
  isCritical: z.boolean().default(false),
  dependencyWeight: z.number().min(0).max(1).default(0.5),
});

export const clusterMembershipSchema = z.object({
  assetId: uuid,
  asset: z.object({
    id: uuid,
    name: z.string(),
    assetType: z.string(),
    criticality: z.number().int(),
  }),
  roleInCluster: z.string().nullable(),
  isCritical: z.boolean(),
  dependencyWeight: z.number(),
});

export const clusterSummarySchema = z.object({
  id: uuid,
  name: z.string(),
  description: z.string().nullable(),
  clusterType: clusterTypeEnum,
  criticalityMode: criticalityModeEnum,
  statusPropagation: propagationModeEnum,
  memberCount: z.number().int(),
  derivedCriticality: z.number().int().nullable(),
  updatedAt: z.string().datetime(),
});

export const clusterDetailSchema = clusterSummarySchema.extend({
  memberships: z.array(clusterMembershipSchema),
  assets: z.array(assetSummarySchema),
});

export const clusterCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().nullable().optional(),
  clusterType: clusterTypeEnum,
  criticalityMode: criticalityModeEnum.default('HIGHEST'),
  statusPropagation: propagationModeEnum.default('CASCADE_UP'),
  members: z.array(clusterMembershipInputSchema).default([]),
});

export const clusterUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  clusterType: clusterTypeEnum.optional(),
  criticalityMode: criticalityModeEnum.optional(),
  statusPropagation: propagationModeEnum.optional(),
  members: z.array(clusterMembershipInputSchema).optional(),
});

export const clusterListResponseSchema = z.object({
  items: z.array(clusterSummarySchema),
  total: z.number().int(),
});
