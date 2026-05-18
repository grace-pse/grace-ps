import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  db: z.enum(['ok', 'down']),
  uptime: z.number(),
});

export default async function healthRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/healthz',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness + DB check',
        response: { 200: healthResponseSchema },
      },
    },
    async () => {
      let db: 'ok' | 'down' = 'ok';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        db = 'down';
      }
      return {
        status: 'ok' as const,
        version: process.env.npm_package_version ?? '0.1.0',
        db,
        uptime: process.uptime(),
      };
    },
  );
}
