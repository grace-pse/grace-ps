// Idempotent seed wrapper that runs at container startup.
//
// Two passes:
//   1. seed.ts (Nordica demo org + users) — only when DB has no users.
//      Critical for the sandbox reset cycle: after a templated DROP/CREATE
//      the API restarts, but the freshly-templated DB already has its seeded
//      users, so this pass is a no-op (we MUST NOT re-run seed.ts on restart).
//   2. seed-banking-finance.mjs (Banking & Finance template package) —
//      always runs. The script is idempotent (upserts), so re-runs are safe
//      and prod relies on this for template-library content.
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScript(scriptPath, runner) {
  if (!existsSync(scriptPath)) {
    console.log(`[maybe-seed] ${scriptPath} not found — skipping`);
    return 0;
  }
  const args = runner === 'tsx' ? ['tsx', scriptPath] : [scriptPath];
  const cmd = runner === 'tsx' ? 'npx' : 'node';
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

const prisma = new PrismaClient();

try {
  const userCount = await prisma.user.count();
  await prisma.$disconnect();

  if (userCount === 0) {
    console.log('[maybe-seed] empty DB — running seed.ts');
    const code = runScript(join(__dirname, 'seed.ts'), 'tsx');
    if (code !== 0) {
      console.error(`[maybe-seed] seed.ts exited with status ${code}`);
      process.exit(code);
    }
  } else {
    console.log(`[maybe-seed] ${userCount} users already exist — skipping seed.ts`);
  }

  console.log('[maybe-seed] running seed-banking-finance.mjs (idempotent upsert)');
  const code = runScript(join(__dirname, 'seed-banking-finance.mjs'), 'node');
  if (code !== 0) {
    console.error(`[maybe-seed] seed-banking-finance.mjs exited with status ${code}`);
    process.exit(code);
  }

  console.log('[maybe-seed] all seeds complete');
} catch (err) {
  console.error('[maybe-seed] error:', err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
}
