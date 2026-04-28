// P3 — notifications inbox. List (paginated), unread-count, mark-read
// (single or all).

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';

const errorSchema = z.object({ error: z.string() });
const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

const notificationSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  severity: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  payload: z.unknown().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().min(0),
});

function serialize(n: {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    kind: n.kind,
    severity: n.severity,
    title: n.title,
    body: n.body,
    payload: (n.payload ?? null) as unknown,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export default async function notificationRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('notifications:read')],
      schema: {
        tags: ['notifications'],
        summary: 'List notifications for the current user (plus tenant-wide)',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(20),
          unreadOnly: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => v === true || v === 'true'),
        }),
        response: { 200: notificationListSchema },
      },
    },
    async (req) => {
      const { sub: userId, tenantId } = req.user as JwtPayload;
      const { limit, unreadOnly } = req.query;

      const where = {
        tenantId,
        OR: [{ userId }, { userId: null }],
        ...(unreadOnly ? { readAt: null } : {}),
      };

      const [rows, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.notification.count({
          where: { tenantId, OR: [{ userId }, { userId: null }], readAt: null },
        }),
      ]);

      return { items: rows.map(serialize), unreadCount };
    },
  );

  router.get(
    '/unread-count',
    {
      onRequest: [app.authenticate, requirePermission('notifications:read')],
      schema: {
        tags: ['notifications'],
        summary: 'Unread notification count for the bell badge',
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ unreadCount: z.number().int().min(0) }) },
      },
    },
    async (req) => {
      const { sub: userId, tenantId } = req.user as JwtPayload;
      const unreadCount = await prisma.notification.count({
        where: { tenantId, OR: [{ userId }, { userId: null }], readAt: null },
      });
      return { unreadCount };
    },
  );

  router.post(
    '/:id/read',
    {
      onRequest: [app.authenticate, requirePermission('notifications:read')],
      schema: {
        tags: ['notifications'],
        summary: 'Mark a single notification as read',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: notificationSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub: userId, tenantId } = req.user as JwtPayload;
      const existing = await prisma.notification.findFirst({
        where: { id: req.params.id, tenantId, OR: [{ userId }, { userId: null }] },
      });
      if (!existing) return reply.code(404).send({ error: 'Notification not found' });
      const updated = await prisma.notification.update({
        where: { id: existing.id },
        data: { readAt: existing.readAt ?? new Date() },
      });
      return serialize(updated);
    },
  );

  router.post(
    '/mark-all-read',
    {
      onRequest: [app.authenticate, requirePermission('notifications:read')],
      schema: {
        tags: ['notifications'],
        summary: 'Mark all unread notifications for the current user as read',
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ updated: z.number().int().min(0) }) },
      },
    },
    async (req) => {
      const { sub: userId, tenantId } = req.user as JwtPayload;
      const result = await prisma.notification.updateMany({
        where: { tenantId, OR: [{ userId }, { userId: null }], readAt: null },
        data: { readAt: new Date() },
      });
      return { updated: result.count };
    },
  );
}
