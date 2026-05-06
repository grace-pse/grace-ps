import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
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
import countermeasureRoutes from './modules/countermeasures/routes.js';
import threatRoutes from './modules/threats/routes.js';
import templateRoutes from './modules/templates/routes.js';
import templateAdminRoutes from './modules/templates/admin-routes.js';
import templateQuestionRoutes from './modules/templates/admin-question-routes.js';
import assessmentRoutes from './modules/assessments/routes.js';
import actionPlanRoutes from './modules/assessments/action-plans.js';
import recommendationRoutes from './modules/assessments/recommendations.js';
import snapshotsRoutes from './modules/assessments/snapshots.js';
import summaryRoutes from './modules/assessments/summary.js';
import reportRoutes from './modules/assessments/report.js';
import surveyTemplateRoutes from './modules/surveys/templates.js';
import surveyResponseRoutes from './modules/surveys/routes.js';
import surveyScheduleRoutes from './modules/surveys/schedule-routes.js';
import surveyQuestionRoutes from './modules/surveys/questions.js';
import clusterSurveyScopeRoutes from './modules/surveys/scopes.js';
import assessmentSurveyLinkRoutes from './modules/surveys/link.js';
import adminSurveyConfigRoutes from './modules/admin/survey-config.js';
import notificationRoutes from './modules/notifications/routes.js';
import orgSettingsRoutes from './modules/org-settings/routes.js';
import sandboxRoutes from './modules/sandbox/routes.js';
import sandboxStatusRoutes from './modules/sandbox/status.js';
import feedbackRoutes from './modules/feedback/routes.js';
import feedbackAdminRoutes from './modules/feedback/admin-routes.js';
import { startSurveyScheduler, stopSurveyScheduler } from './modules/surveys/scheduler.js';
import { prisma } from './lib/prisma.js';
import { isSandbox } from './lib/sandbox.js';
import { registerSandboxGuards } from './plugins/sandbox-guards.js';
import { ensureFeedbackSchema, closeFeedbackPool } from './lib/feedback-db.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const SANDBOX = isSandbox();

const app = Fastify({
  logger:
    NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
      : true,
  trustProxy: true,
  bodyLimit: SANDBOX ? 64 * 1024 : 1024 * 1024,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

const corsOrigins =
  process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ?? true;

await app.register(cors, { origin: corsOrigins, credentials: true });
await app.register(rateLimit, { max: SANDBOX ? 120 : 300, timeWindow: '1 minute' });

if (SANDBOX) {
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });
  registerSandboxGuards(app);
  app.log.info('SANDBOX_MODE active — guards/helmet enabled, register/users/swagger disabled');
}

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-me-32-chars-minimum!!',
  sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? (SANDBOX ? '30m' : '7d') },
});

app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});

if (!SANDBOX) {
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
}

await app.register(async (api) => {
  await api.register(healthRoutes);
  await api.register(authRoutes, { prefix: '/auth' });
  if (!SANDBOX) {
    await api.register(userRoutes, { prefix: '/users' });
  }
  if (SANDBOX) {
    await api.register(sandboxRoutes, { prefix: '/sandbox' });
    await api.register(sandboxStatusRoutes, { prefix: '/sandbox' });
    await api.register(feedbackRoutes, { prefix: '/feedback' });
  }
  await api.register(assetRoutes, { prefix: '/assets' });
  await api.register(clusterRoutes, { prefix: '/clusters' });
  await api.register(countermeasureRoutes, { prefix: '/countermeasures' });
  await api.register(threatRoutes, { prefix: '/threats' });
  await api.register(templateRoutes, { prefix: '/templates' });
  await api.register(templateAdminRoutes);
  await api.register(templateQuestionRoutes);
  await api.register(assessmentRoutes, { prefix: '/assessments' });
  await api.register(reportRoutes, { prefix: '/assessments' });
  await api.register(snapshotsRoutes, { prefix: '/assessments' });
  await api.register(summaryRoutes, { prefix: '/assessments' });
  await api.register(assessmentSurveyLinkRoutes, { prefix: '/assessments' });
  await api.register(actionPlanRoutes);
  await api.register(recommendationRoutes);
  await api.register(surveyTemplateRoutes, { prefix: '/survey-templates' });
  await api.register(surveyResponseRoutes, { prefix: '/surveys' });
  await api.register(surveyScheduleRoutes, { prefix: '/survey-schedules' });
  await api.register(surveyQuestionRoutes, { prefix: '/survey-questions' });
  await api.register(clusterSurveyScopeRoutes, { prefix: '/cluster-survey-scopes' });
  await api.register(adminSurveyConfigRoutes, { prefix: '/admin/surveys' });
  await api.register(notificationRoutes, { prefix: '/notifications' });
  await api.register(orgSettingsRoutes, { prefix: '/org' });
}, { prefix: '/api' });

if (SANDBOX) {
  await app.register(feedbackAdminRoutes, { prefix: '/admin' });
}

app.addHook('onReady', async () => {
  if (SANDBOX) {
    try {
      await ensureFeedbackSchema();
      app.log.info('feedback DB schema ready');
    } catch (err) {
      app.log.error({ err }, 'failed to ensure feedback DB schema');
    }
  }
  startSurveyScheduler(app.log);
});

app.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  const status = (err as { statusCode?: number }).statusCode ?? 500;
  const message = status >= 500 ? 'Internal server error' : err.message;
  reply.code(status).send({ error: message });
});

const shutdown = async () => {
  app.log.info('shutting down');
  stopSurveyScheduler();
  await app.close();
  await prisma.$disconnect();
  if (SANDBOX) await closeFeedbackPool().catch(() => undefined);
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
