import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createInvite,
  listInvites,
  listFeedback,
  revokeInvite,
} from '../../lib/feedback-db.js';
import { inviteCreateSchema, inviteSchema, feedbackRowSchema } from './schema.js';

const errorSchema = z.object({ error: z.string() });

function requireOwnerToken(req: FastifyRequest, reply: FastifyReply): boolean {
  const expected = process.env.OWNER_TOKEN;
  if (!expected) {
    reply.code(503).send({ error: 'OWNER_TOKEN not configured' });
    return false;
  }
  const provided = req.headers['x-admin-token'];
  if (typeof provided !== 'string' || provided !== expected) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

function serializeInvite(i: Awaited<ReturnType<typeof listInvites>>[number]) {
  return {
    id: i.id,
    token: i.token,
    label: i.label,
    email: i.email,
    notes: i.notes,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt ? i.expiresAt.toISOString() : null,
    revokedAt: i.revokedAt ? i.revokedAt.toISOString() : null,
    firstUsedAt: i.firstUsedAt ? i.firstUsedAt.toISOString() : null,
    lastUsedAt: i.lastUsedAt ? i.lastUsedAt.toISOString() : null,
    useCount: i.useCount,
  };
}

export default async function feedbackAdminRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.post(
    '/invites',
    {
      schema: {
        tags: ['admin'],
        body: inviteCreateSchema,
        response: { 201: inviteSchema, 401: errorSchema, 503: errorSchema },
      },
    },
    async (req, reply) => {
      if (!requireOwnerToken(req, reply)) return reply;
      const invite = await createInvite(req.body);
      return reply.code(201).send(serializeInvite(invite));
    },
  );

  router.get(
    '/invites',
    {
      schema: {
        tags: ['admin'],
        response: { 200: z.array(inviteSchema), 401: errorSchema, 503: errorSchema },
      },
    },
    async (req, reply) => {
      if (!requireOwnerToken(req, reply)) return reply;
      const invites = await listInvites();
      return reply.send(invites.map(serializeInvite));
    },
  );

  router.delete(
    '/invites/:id',
    {
      schema: {
        tags: ['admin'],
        params: z.object({ id: z.string().uuid() }),
        response: { 204: z.null(), 401: errorSchema, 503: errorSchema },
      },
    },
    async (req, reply) => {
      if (!requireOwnerToken(req, reply)) return reply;
      await revokeInvite(req.params.id);
      return reply.code(204).send(null);
    },
  );

  router.get(
    '/feedback',
    {
      schema: {
        tags: ['admin'],
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(1000).optional() }),
        response: { 200: z.array(feedbackRowSchema), 401: errorSchema, 503: errorSchema },
      },
    },
    async (req, reply) => {
      if (!requireOwnerToken(req, reply)) return reply;
      const items = await listFeedback(req.query.limit ?? 200);
      return reply.send(
        items.map((f) => ({
          id: f.id,
          createdAt: f.createdAt.toISOString(),
          inviteId: f.inviteId,
          inviteLabel: f.inviteLabel,
          message: f.message,
          category: f.category,
          page: f.page,
          userEmail: f.userEmail,
          userRole: f.userRole,
          ip: f.ip,
          userAgent: f.userAgent,
        })),
      );
    },
  );
}
