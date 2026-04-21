import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const uuid = z.string().uuid();

type JwtPayload = { sub: string; tenantId: string; role: string };

const userRoleEnum = z.enum(['ADMIN', 'LEAD_ASSESSOR', 'ASSESSOR', 'REVIEWER', 'STAKEHOLDER']);

const userSummarySchema = z.object({
  id: uuid,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: userRoleEnum,
  isActive: z.boolean(),
});

export default async function userRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'List users in current org',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          role: userRoleEnum.optional(),
          active: z.coerce.boolean().optional(),
        }),
        response: { 200: z.object({ items: z.array(userSummarySchema) }) },
      },
    },
    async (req) => {
      const { tenantId } = req.user as JwtPayload;
      const { role, active } = req.query;
      const items = await prisma.user.findMany({
        where: {
          tenantId,
          ...(role ? { role } : {}),
          ...(active !== undefined ? { isActive: active } : {}),
        },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      });
      return { items };
    },
  );
}
