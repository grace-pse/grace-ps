import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import authRoutes from './modules/auth/routes.js';
import healthRoutes from './modules/health/routes.js';
import userRoutes from './modules/users/routes.js';
import assetRoutes from './modules/assets/routes.js';
import clusterRoutes from './modules/clusters/routes.js';
import templateRoutes from './modules/templates/routes.js';
import assessmentRoutes from './modules/assessments/routes.js';
import actionPlanRoutes from './modules/assessments/action-plans.js';
import { prisma } from './lib/prisma.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const app = Fastify({
  logger:
    NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
      : true,
  trustProxy: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

const corsOrigins =
  process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ?? true;

await app.register(cors, { origin: corsOrigins, credentials: true });
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-me-32-chars-minimum!!',
  sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
});

app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});

await app.register(swagger, {
  openapi: {
    info: { title: 'CSMP Risk Manager API', version: '0.1.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  transform: jsonSchemaTransform,
});
await app.register(swaggerUi, { routePrefix: '/api/docs' });

await app.register(async (api) => {
  await api.register(healthRoutes);
  await api.register(authRoutes, { prefix: '/auth' });
  await api.register(userRoutes, { prefix: '/users' });
  await api.register(assetRoutes, { prefix: '/assets' });
  await api.register(clusterRoutes, { prefix: '/clusters' });
  await api.register(templateRoutes, { prefix: '/templates' });
  await api.register(assessmentRoutes, { prefix: '/assessments' });
  await api.register(actionPlanRoutes);
}, { prefix: '/api' });

app.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  const status = (err as { statusCode?: number }).statusCode ?? 500;
  const message = status >= 500 ? 'Internal server error' : err.message;
  reply.code(status).send({ error: message });
});

const shutdown = async () => {
  app.log.info('shutting down');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
