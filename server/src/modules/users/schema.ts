import { z } from 'zod';

export const userRoleEnum = z.enum([
  'ADMIN',
  'LEAD_ASSESSOR',
  'ASSESSOR',
  'REVIEWER',
  'STAKEHOLDER',
]);

export const userSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: userRoleEnum,
  isActive: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});

export const userDetailSchema = userSummarySchema;

export const userCreateSchema = z.object({
  email: z.string().email().max(255),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: userRoleEnum,
});

export const userUpdateSchema = z.object({
  email: z.string().email().max(255).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export const userRoleChangeSchema = z.object({
  role: userRoleEnum,
});

export const userCreateResponseSchema = z.object({
  user: userDetailSchema,
  tempPassword: z.string(),
});

export const tempPasswordResponseSchema = z.object({
  tempPassword: z.string(),
});

export const userListResponseSchema = z.object({
  items: z.array(userSummarySchema),
});
