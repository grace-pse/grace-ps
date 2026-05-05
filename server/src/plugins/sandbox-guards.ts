import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { SANDBOX_ROW_CAPS, type SandboxCappedModel } from '../lib/sandbox.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const PRIVATE_IP_RE =
  /^(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|::1|fe80:|fc00:|fd00:)/i;

function urlReachesPrivateNetwork(value: string): boolean {
  try {
    const u = new URL(value);
    return PRIVATE_IP_RE.test(u.hostname) || u.hostname === 'localhost';
  } catch {
    return false;
  }
}

function findPrivateUrl(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const stack: unknown[] = [body];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    if (typeof cur === 'string') {
      if (/^https?:\/\//i.test(cur) && urlReachesPrivateNetwork(cur)) return cur;
      continue;
    }
    if (Array.isArray(cur)) {
      stack.push(...cur);
      continue;
    }
    if (typeof cur === 'object') {
      stack.push(...Object.values(cur as Record<string, unknown>));
    }
  }
  return null;
}

interface BucketState {
  count: number;
  resetAt: number;
}

function makeBucket(maxPerWindow: number, windowMs: number) {
  const buckets = new Map<string, BucketState>();
  return function check(req: FastifyRequest, reply: FastifyReply): boolean {
    const now = Date.now();
    const key = req.ip;
    const b = buckets.get(key);
    if (!b || b.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (b.count >= maxPerWindow) {
      const retryAfter = Math.ceil((b.resetAt - now) / 1000);
      reply.header('Retry-After', String(retryAfter));
      reply.code(429).send({ error: 'rate limit exceeded', retryAfter });
      return false;
    }
    b.count += 1;
    return true;
  };
}

const PATH_TO_MODEL: Array<[RegExp, SandboxCappedModel, string]> = [
  [/^\/api\/assets(?:\/|$|\?)/, 'Asset', 'asset'],
  [/^\/api\/assessments(?:\/|$|\?)/, 'Assessment', 'assessment'],
  [/^\/api\/clusters(?:\/|$|\?)/, 'AssetCluster', 'assetCluster'],
  [/^\/api\/countermeasures(?:\/|$|\?)/, 'Countermeasure', 'countermeasure'],
];

export function registerSandboxGuards(app: FastifyInstance): void {
  const checkWrite = makeBucket(30, 60_000);
  const checkLogin = makeBucket(10, 60_000);

  app.addHook('onRequest', async (req, reply) => {
    if (
      req.method === 'POST' &&
      (req.url.startsWith('/api/auth/login') || req.url.startsWith('/api/sandbox/login-as'))
    ) {
      if (!checkLogin(req, reply)) return reply;
      return;
    }
    if (WRITE_METHODS.has(req.method) && req.url.startsWith('/api/')) {
      if (!checkWrite(req, reply)) return reply;
    }
  });

  app.addHook('preValidation', async (req, reply) => {
    if (!WRITE_METHODS.has(req.method)) return;
    const offending = findPrivateUrl(req.body);
    if (offending) {
      return reply.code(400).send({ error: 'private network URLs are not allowed in sandbox' });
    }
  });

  app.addHook('preHandler', async (req, reply) => {
    if (req.method !== 'POST') return;
    for (const [re, model, accessor] of PATH_TO_MODEL) {
      if (!re.test(req.url)) continue;
      const cap = SANDBOX_ROW_CAPS[model];
      const tenantId = (req.user as { tenantId?: string } | undefined)?.tenantId;
      if (!tenantId) return;
      const accessorFn = (prisma as unknown as Record<string, { count: (args: unknown) => Promise<number> } | undefined>)[
        accessor
      ];
      if (!accessorFn) return;
      const count = await accessorFn.count({ where: { tenantId } });
      if (count >= cap) {
        return reply.code(429).send({
          error: `sandbox row cap reached for ${model} (${cap})`,
        });
      }
      return;
    }
  });
}
