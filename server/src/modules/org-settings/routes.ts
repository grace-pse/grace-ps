import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { getInstanceOrg, invalidateInstanceOrg } from '../../lib/instance-org.js';
import {
  orgSettingsResponseSchema,
  orgSettingsPatchBodySchema,
  orgSettingsPatchResponseSchema,
  orgPatchBodySchema,
  orgPatchResponseSchema,
  appearanceSchema,
} from './schema.js';

const errorSchema = z.object({ error: z.string() });

export default async function orgSettingsRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // GET /api/org/settings — readable by any authenticated user so the appearance
  // resolver works for STAKEHOLDER/REVIEWER too.
  router.get(
    '/settings',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['org'],
        summary: 'Read organization settings (appearance + summary)',
        security: [{ bearerAuth: [] }],
        response: { 200: orgSettingsResponseSchema, 401: errorSchema, 404: errorSchema },
      },
    },
    async (_req, reply) => {
      const org = await getInstanceOrg();
      const memberCount = await prisma.user.count({ where: { isActive: true } });

      const settings = (org.settings as Record<string, unknown> | null) ?? {};
      const rawAppearance = settings.appearance;
      const parsed = appearanceSchema.safeParse(rawAppearance);

      return reply.send({
        appearance: parsed.success ? parsed.data : null,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          subscriptionTier: org.subscriptionTier,
          isActive: org.isActive,
          createdAt: org.createdAt.toISOString(),
          memberCount,
        },
      });
    },
  );

  // PATCH /api/org/settings — write the full appearance blob.
  router.patch(
    '/settings',
    {
      onRequest: [app.authenticate, requirePermission('org:manage')],
      schema: {
        tags: ['org'],
        summary: 'Update instance appearance settings',
        security: [{ bearerAuth: [] }],
        body: orgSettingsPatchBodySchema,
        response: {
          200: orgSettingsPatchResponseSchema,
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { appearance } = req.body;

      const org = await getInstanceOrg();
      // Read-modify-write to preserve any unrelated keys living in `settings`.
      const existing = (org.settings as Record<string, unknown> | null) ?? {};
      const next = { ...existing, appearance };

      await prisma.organization.update({
        where: { id: org.id },
        data: { settings: next },
      });
      invalidateInstanceOrg();

      return reply.send({ appearance });
    },
  );

  // PATCH /api/org — rename the instance (slug stays immutable).
  router.patch(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('org:manage')],
      schema: {
        tags: ['org'],
        summary: 'Update instance profile',
        security: [{ bearerAuth: [] }],
        body: orgPatchBodySchema,
        response: { 200: orgPatchResponseSchema, 403: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { name } = req.body;

      const instance = await getInstanceOrg();
      const org = await prisma.organization.update({
        where: { id: instance.id },
        data: { name },
      });
      invalidateInstanceOrg();

      return reply.send({
        id: org.id,
        name: org.name,
        slug: org.slug,
        subscriptionTier: org.subscriptionTier,
        isActive: org.isActive,
      });
    },
  );
}
