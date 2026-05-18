import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import type { JwtPayload } from '../../lib/jwt.js';
import {
  userRoleEnum,
  userSummarySchema,
  userDetailSchema,
  userCreateSchema,
  userUpdateSchema,
  userRoleChangeSchema,
  userCreateResponseSchema,
  tempPasswordResponseSchema,
  userListResponseSchema,
} from './schema.js';

const uuid = z.string().uuid();
const errorSchema = z.object({ error: z.string() });

function generateTempPassword(): string {
  // 12 chars, URL-safe, ~72 bits of entropy.
  return crypto.randomBytes(9).toString('base64url');
}

function serializeUser(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role as 'ADMIN' | 'LEAD_ASSESSOR' | 'ASSESSOR' | 'REVIEWER' | 'STAKEHOLDER',
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

export default async function userRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // GET / — list users.
  router.get(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('users:manage')],
      schema: {
        tags: ['users'],
        summary: 'List users',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          role: userRoleEnum.optional(),
          active: z.coerce.boolean().optional(),
        }),
        response: { 200: userListResponseSchema, 403: errorSchema },
      },
    },
    async (req) => {
      const { role, active } = req.query;
      const items = await prisma.user.findMany({
        where: {
          ...(role ? { role } : {}),
          ...(active !== undefined ? { isActive: active } : {}),
        },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      });
      return { items: items.map(serializeUser) };
    },
  );

  // GET /:id
  router.get(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('users:manage')],
      schema: {
        tags: ['users'],
        summary: 'Get user detail',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: userDetailSchema, 403: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const user = await prisma.user.findFirst({
        where: { id },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
      });
      if (!user) return reply.code(404).send({ error: 'User not found' });
      return reply.send(serializeUser(user));
    },
  );

  // POST / — create user with a generated temp password.
  router.post(
    '/',
    {
      onRequest: [app.authenticate, requirePermission('users:manage')],
      schema: {
        tags: ['users'],
        summary: 'Invite a new user (returns temp password once)',
        security: [{ bearerAuth: [] }],
        body: userCreateSchema,
        response: {
          201: userCreateResponseSchema,
          403: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      try {
        const created = await prisma.user.create({
          data: {
            email: req.body.email,
            passwordHash,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            role: req.body.role,
          },
          select: {
            id: true, email: true, firstName: true, lastName: true,
            role: true, isActive: true, lastLoginAt: true, createdAt: true,
          },
        });
        req.log.info({ userId: created.id, by: (req.user as JwtPayload).sub }, 'admin_user_created');
        return reply.code(201).send({
          user: serializeUser(created),
          tempPassword,
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.code(409).send({ error: 'A user with that email already exists' });
        }
        throw err;
      }
    },
  );

  // PATCH /:id — update name/email.
  router.patch(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('users:manage')],
      schema: {
        tags: ['users'],
        summary: 'Update user profile',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: userUpdateSchema,
        response: {
          200: userDetailSchema,
          403: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;

      const existing = await prisma.user.findFirst({ where: { id } });
      if (!existing) return reply.code(404).send({ error: 'User not found' });

      try {
        const updated = await prisma.user.update({
          where: { id },
          data: req.body,
          select: {
            id: true, email: true, firstName: true, lastName: true,
            role: true, isActive: true, lastLoginAt: true, createdAt: true,
          },
        });
        return reply.send(serializeUser(updated));
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.code(409).send({ error: 'Email already in use' });
        }
        throw err;
      }
    },
  );

  // POST /:id/role — change role with last-admin guard.
  router.post(
    '/:id/role',
    {
      onRequest: [app.authenticate, requirePermission('users:manage')],
      schema: {
        tags: ['users'],
        summary: 'Change user role',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        body: userRoleChangeSchema,
        response: {
          200: userDetailSchema,
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { role } = req.body;

      try {
        const updated = await prisma.$transaction(async (tx) => {
          const target = await tx.user.findFirst({ where: { id } });
          if (!target) {
            throw Object.assign(new Error('not_found'), { code: 'not_found' });
          }
          if (role === target.role) return target;

          // Last-admin guard: only triggered when demoting the last active ADMIN.
          if (target.role === 'ADMIN' && role !== 'ADMIN' && target.isActive) {
            const activeAdmins = await tx.user.count({
              where: { role: 'ADMIN', isActive: true },
            });
            if (activeAdmins <= 1) {
              throw Object.assign(new Error('last_admin'), { code: 'last_admin' });
            }
          }

          return tx.user.update({
            where: { id },
            data: { role },
          });
        });

        req.log.info({ userId: id, role, by: (req.user as JwtPayload).sub }, 'admin_user_role_changed');
        return reply.send(serializeUser(updated));
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'not_found') return reply.code(404).send({ error: 'User not found' });
        if (code === 'last_admin') {
          return reply.code(400).send({ error: 'Cannot demote the last active admin' });
        }
        throw err;
      }
    },
  );

  // DELETE /:id — soft-deactivate.
  router.delete(
    '/:id',
    {
      onRequest: [app.authenticate, requirePermission('users:manage')],
      schema: {
        tags: ['users'],
        summary: 'Deactivate user (soft-delete)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: {
          200: z.object({ ok: z.literal(true) }),
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const { id } = req.params;

      if (id === sub) {
        return reply.code(400).send({ error: 'You cannot deactivate yourself' });
      }

      try {
        await prisma.$transaction(async (tx) => {
          const target = await tx.user.findFirst({ where: { id } });
          if (!target) throw Object.assign(new Error('not_found'), { code: 'not_found' });
          if (!target.isActive) return;

          if (target.role === 'ADMIN') {
            const activeAdmins = await tx.user.count({
              where: { role: 'ADMIN', isActive: true },
            });
            if (activeAdmins <= 1) {
              throw Object.assign(new Error('last_admin'), { code: 'last_admin' });
            }
          }

          await tx.user.update({ where: { id }, data: { isActive: false } });
        });

        req.log.info({ userId: id, by: sub }, 'admin_user_deactivated');
        return reply.send({ ok: true as const });
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'not_found') return reply.code(404).send({ error: 'User not found' });
        if (code === 'last_admin') {
          return reply.code(400).send({ error: 'Cannot deactivate the last active admin' });
        }
        throw err;
      }
    },
  );

  // POST /:id/reactivate — undo soft-delete.
  router.post(
    '/:id/reactivate',
    {
      onRequest: [app.authenticate, requirePermission('users:manage')],
      schema: {
        tags: ['users'],
        summary: 'Reactivate a deactivated user',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: userDetailSchema, 403: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const target = await prisma.user.findFirst({ where: { id } });
      if (!target) return reply.code(404).send({ error: 'User not found' });

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: true },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
      });
      req.log.info({ userId: id, by: (req.user as JwtPayload).sub }, 'admin_user_reactivated');
      return reply.send(serializeUser(updated));
    },
  );

  // POST /:id/reset-password — issue a temp password.
  router.post(
    '/:id/reset-password',
    {
      onRequest: [app.authenticate, requirePermission('users:manage')],
      schema: {
        tags: ['users'],
        summary: 'Reset a user password (returns temp password once)',
        security: [{ bearerAuth: [] }],
        params: z.object({ id: uuid }),
        response: { 200: tempPasswordResponseSchema, 403: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { sub } = req.user as JwtPayload;
      const { id } = req.params;

      const target = await prisma.user.findFirst({ where: { id } });
      if (!target) return reply.code(404).send({ error: 'User not found' });

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      await prisma.user.update({ where: { id }, data: { passwordHash } });

      req.log.warn({ userId: id, by: sub }, 'admin_reset_password');
      return reply.send({ tempPassword });
    },
  );
}
