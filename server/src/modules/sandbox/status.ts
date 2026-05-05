import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { readFile } from 'node:fs/promises';
import { sandboxStatusResponseSchema } from './schema.js';

const RESET_INTERVAL_HOURS = Number(process.env.SANDBOX_RESET_INTERVAL_HOURS ?? 48);
const LAST_RESET_PATH = process.env.SANDBOX_LAST_RESET_PATH ?? '/var/lib/csmp-sandbox/last-reset.txt';

interface CacheEntry {
  expiresAt: number;
  payload: { lastResetAt: Date | null };
}

let cache: CacheEntry | null = null;
const CACHE_MS = 30_000;

async function readLastResetAt(): Promise<Date | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.payload.lastResetAt;
  try {
    const raw = (await readFile(LAST_RESET_PATH, 'utf8')).trim();
    const epochSec = Number(raw);
    if (!Number.isFinite(epochSec) || epochSec <= 0) {
      cache = { expiresAt: Date.now() + CACHE_MS, payload: { lastResetAt: null } };
      return null;
    }
    const d = new Date(epochSec * 1000);
    cache = { expiresAt: Date.now() + CACHE_MS, payload: { lastResetAt: d } };
    return d;
  } catch {
    cache = { expiresAt: Date.now() + CACHE_MS, payload: { lastResetAt: null } };
    return null;
  }
}

export default async function sandboxStatusRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.get(
    '/status',
    {
      schema: {
        tags: ['sandbox'],
        summary: 'Sandbox reset status (public)',
        response: { 200: sandboxStatusResponseSchema },
      },
    },
    async (_req, reply) => {
      const lastResetAt = await readLastResetAt();
      const nextResetAt = lastResetAt
        ? new Date(lastResetAt.getTime() + RESET_INTERVAL_HOURS * 3600_000)
        : null;
      return reply.send({
        sandboxMode: true as const,
        resetIntervalHours: RESET_INTERVAL_HOURS,
        lastResetAt: lastResetAt ? lastResetAt.toISOString() : null,
        nextResetAt: nextResetAt ? nextResetAt.toISOString() : null,
        serverTime: new Date().toISOString(),
      });
    },
  );
}
