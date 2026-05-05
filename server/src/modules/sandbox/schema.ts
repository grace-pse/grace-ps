import { z } from 'zod';

export const sandboxLoginAsBodySchema = z.object({
  role: z.enum(['ADMIN', 'LEAD_ASSESSOR', 'ASSESSOR', 'REVIEWER', 'STAKEHOLDER']),
  invite: z.string().min(8).max(128),
});

export const sandboxAuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.string(),
  }),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  invite: z.object({
    id: z.string(),
    label: z.string(),
  }),
});

export const sandboxStatusResponseSchema = z.object({
  sandboxMode: z.literal(true),
  resetIntervalHours: z.number(),
  lastResetAt: z.string().nullable(),
  nextResetAt: z.string().nullable(),
  serverTime: z.string(),
});
