// Idempotent seed wrapper that runs at container startup.
//
// Order (FK + dependency-aware):
//   1. seed-survey-questions.mjs — always (idempotent global question library).
//      Must run BEFORE seed.ts because the Nordica demo survey scopes
//      reference these system questions by prompt.
//   2. seed.ts (Nordica demo org + users) — only when DB has no users.
//      Critical for the sandbox reset cycle: after a templated DROP/CREATE
//      the API restarts, but the freshly-templated DB already has its seeded
//      users, so this pass is a no-op (we MUST NOT re-run seed.ts on restart).
//   3. seed-banking-finance.mjs (Banking & Finance template package) —
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

  // Step 1 — global question library FIRST so seed.ts can reference questions
  // by prompt when creating tenant-scoped survey scopes.
  console.log('[maybe-seed] running seed-survey-questions.mjs (idempotent upsert)');
  const sqCode = runScript(join(__dirname, 'seed-survey-questions.mjs'), 'node');
  if (sqCode !== 0) {
    console.error(`[maybe-seed] seed-survey-questions.mjs exited with status ${sqCode}`);
    process.exit(sqCode);
  }

  // Step 2 — tenant seed (Nordica demo) only on empty DB.
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

  // Step 3 — Banking & Finance template package (global, idempotent).
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
