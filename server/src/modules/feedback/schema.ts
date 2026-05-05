import { z } from 'zod';

export const feedbackSubmitSchema = z.object({
  message: z.string().min(5).max(2000),
  category: z.enum(['bug', 'suggestion', 'praise', 'question', 'other']).optional(),
  page: z.string().max(255).optional(),
  userEmail: z.string().email().max(255),
  userRole: z.string().max(40).optional(),
});

export const feedbackSubmitResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
});

export const inviteCreateSchema = z.object({
  label: z.string().min(2).max(255),
  email: z.string().email().max(255).optional(),
  notes: z.string().max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const inviteSchema = z.object({
  id: z.string().uuid(),
  token: z.string(),
  label: z.string(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  firstUsedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  useCount: z.number().int(),
});

export const feedbackRowSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  inviteId: z.string().uuid().nullable(),
  inviteLabel: z.string().nullable(),
  message: z.string(),
  category: z.string().nullable(),
  page: z.string().nullable(),
  userEmail: z.string(),
  userRole: z.string().nullable(),
  ip: z.string(),
  userAgent: z.string().nullable(),
});
