import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { DEMO_ORG_SLUG, DEMO_USER_BY_ROLE } from '../../lib/sandbox.js';
import { findInviteByToken, isInviteValid, recordInviteUse } from '../../lib/feedback-db.js';
import { sandboxLoginAsBodySchema, sandboxAuthResponseSchema } from './schema.js';

const errorSchema = z.object({ error: z.string() });

export default async function sandboxRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.post(
    '/login-as',
    {
      schema: {
        tags: ['sandbox'],
        summary: 'Issue a JWT for one of the seeded demo users (sandbox-only)',
        body: sandboxLoginAsBodySchema,
        response: { 200: sandboxAuthResponseSchema, 403: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { role, invite: inviteToken } = req.body;

      const invite = await findInviteByToken(inviteToken);
      if (!invite || !isInviteValid(invite)) {
        return reply.code(403).send({ error: 'invalid or revoked invite' });
      }

      const email = DEMO_USER_BY_ROLE[role];
      const org = await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } });
      if (!org) return reply.code(404).send({ error: 'demo org not seeded' });
      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: org.id, email } },
      });
      if (!user) return reply.code(404).send({ error: `demo user ${email} not seeded` });
      if (user.role !== role) {
        return reply.code(403).send({ error: 'role mismatch' });
      }

      await recordInviteUse(invite.id);

      req.log.info({ inviteId: invite.id, label: invite.label, role, ip: req.ip }, 'sandbox login-as');

      const token = await reply.jwtSign({
        sub: user.id,
        tenantId: org.id,
        role: user.role,
        email: user.email,
      });

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        organization: { id: org.id, name: org.name, slug: org.slug },
        invite: { id: invite.id, label: invite.label },
      });
    },
  );

  router.post(
    '/verify-invite',
    {
      schema: {
        tags: ['sandbox'],
        summary: 'Check whether an invite token is valid (no JWT issued)',
        body: z.object({ invite: z.string().min(8).max(128) }),
        response: {
          200: z.object({ ok: z.literal(true), label: z.string() }),
          403: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const invite = await findInviteByToken(req.body.invite);
      if (!invite || !isInviteValid(invite)) {
        return reply.code(403).send({ error: 'invalid or revoked invite' });
      }
      return reply.send({ ok: true as const, label: invite.label });
    },
  );
}
