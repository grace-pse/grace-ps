import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  findInviteByToken,
  insertFeedback,
  isInviteValid,
  recordInviteUse,
} from '../../lib/feedback-db.js';
import { notifyOwner } from '../../lib/notify-owner.js';
import { feedbackSubmitSchema, feedbackSubmitResponseSchema } from './schema.js';

const errorSchema = z.object({ error: z.string() });

export default async function feedbackRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.post(
    '/',
    {
      schema: {
        tags: ['feedback'],
        summary: 'Submit reviewer feedback (sandbox-only, invite-gated)',
        body: feedbackSubmitSchema,
        response: { 200: feedbackSubmitResponseSchema, 400: errorSchema, 403: errorSchema },
      },
    },
    async (req, reply) => {
      const inviteToken = (req.headers['x-invite-token'] as string | undefined)?.trim();
      if (!inviteToken) {
        return reply.code(403).send({ error: 'invite token required' });
      }
      const invite = await findInviteByToken(inviteToken);
      if (!invite || !isInviteValid(invite)) {
        return reply.code(403).send({ error: 'invalid or revoked invite' });
      }

      const data = req.body;
      const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;
      const inserted = await insertFeedback({
        inviteId: invite.id,
        message: data.message,
        category: data.category ?? null,
        page: data.page ?? null,
        userEmail: data.userEmail,
        userRole: data.userRole ?? null,
        ip: req.ip,
        userAgent,
      });
      await recordInviteUse(invite.id);

      void notifyOwner(
        `[csmp-sandbox] feedback from ${invite.label}`,
        [
          `Reviewer: ${invite.label}`,
          `Email (form): ${data.userEmail}`,
          `Role: ${data.userRole ?? '(unset)'}`,
          `Page: ${data.page ?? '(unset)'}`,
          `Category: ${data.category ?? '(unset)'}`,
          `IP: ${req.ip}`,
          `Submitted at: ${inserted.createdAt.toISOString()}`,
          '',
          '— Message —',
          data.message,
        ].join('\n'),
      );

      return reply.send({ ok: true as const, id: inserted.id });
    },
  );
}
