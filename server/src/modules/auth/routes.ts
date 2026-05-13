import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import {
  registerSchema,
  loginSchema,
  authResponseSchema,
  meResponseSchema,
} from './schema.js';

const errorSchema = z.object({ error: z.string() });

export default async function authRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.post(
    '/register',
    {
      schema: {
        tags: ['auth'],
        summary: 'Register org + admin user',
        body: registerSchema,
        response: { 201: authResponseSchema, 409: errorSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const data = req.body;

      const existing = await prisma.organization.findUnique({
        where: { slug: data.organizationSlug },
      });
      if (existing) {
        return reply.code(409).send({ error: 'Organization slug already taken' });
      }

      const passwordHash = await bcrypt.hash(data.password, 12);

      const { org, user } = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: data.organizationName, slug: data.organizationSlug },
        });
        const user = await tx.user.create({
          data: {
            tenantId: org.id,
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            role: 'ADMIN',
          },
        });
        return { org, user };
      });

      const token = await reply.jwtSign({
        sub: user.id,
        tenantId: org.id,
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
        summary: 'Log in with org slug + email + password',
        body: loginSchema,
        response: { 200: authResponseSchema, 401: errorSchema },
      },
    },
    async (req, reply) => {
      const { email, password, organizationSlug } = req.body;

      const org = await prisma.organization.findUnique({
        where: { slug: organizationSlug },
      });
      if (!org || !org.isActive) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: org.id, email } },
      });
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
      });
    },
  );

  router.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Current user + organization',
        security: [{ bearerAuth: [] }],
        response: { 200: meResponseSchema, 401: errorSchema, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const jwt = req.user as { sub: string };
      const user = await prisma.user.findUnique({
        where: { id: jwt.sub },
        include: { organization: true },
      });
      if (!user) return reply.code(404).send({ error: 'User not found' });

      return reply.send({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
        },
      });
    },
  );
}
