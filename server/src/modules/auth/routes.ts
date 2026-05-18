import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { getInstanceOrg, invalidateInstanceOrg } from '../../lib/instance-org.js';
import type { JwtPayload } from '../../lib/jwt.js';
import {
  registerSchema,
  loginSchema,
  authResponseSchema,
  meResponseSchema,
} from './schema.js';

const errorSchema = z.object({ error: z.string() });

export default async function authRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  // Bootstrap the singleton Organization + first ADMIN user. Succeeds only
  // when the instance has zero users; returns 410 once bootstrapped.
  router.post(
    '/register',
    {
      schema: {
        tags: ['auth'],
        summary: 'Bootstrap instance (first-run only)',
        body: registerSchema,
        response: { 201: authResponseSchema, 410: errorSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const data = req.body;

      const userCount = await prisma.user.count();
      if (userCount > 0) {
        return reply
          .code(410)
          .send({ error: 'Instance already bootstrapped' });
      }

      const passwordHash = await bcrypt.hash(data.password, 12);

      const { org, user } = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: data.organizationName, slug: data.organizationSlug },
        });
        const user = await tx.user.create({
          data: {
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            role: 'ADMIN',
          },
        });
        return { org, user };
      });

      invalidateInstanceOrg();

      const token = await reply.jwtSign({
        sub: user.id,
        role: user.role,
        email: user.email,
      });

      return reply.code(201).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        organization: { id: org.id, name: org.name, slug: org.slug },
      });
    },
  );

  router.post(
    '/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Log in with email + password',
        body: loginSchema,
        response: { 200: authResponseSchema, 401: errorSchema },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const org = await getInstanceOrg();

      const token = await reply.jwtSign({
        sub: user.id,
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
      });
    },
  );

  router.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Current user + instance organization',
        security: [{ bearerAuth: [] }],
        response: { 200: meResponseSchema, 401: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const jwt = req.user as JwtPayload;
      const user = await prisma.user.findUnique({ where: { id: jwt.sub } });
      if (!user) return reply.code(404).send({ error: 'User not found' });

      const org = await getInstanceOrg();

      return reply.send({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: { id: org.id, name: org.name, slug: org.slug },
      });
    },
  );
}
