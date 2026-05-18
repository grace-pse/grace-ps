/**
 * One-off admin override: force-approve an IN_REVIEW assessment, bypassing the
 * separation-of-duties check that blocks self-approval. Records the override
 * in `reviewNotes` and captures a snapshot so the audit trail is honest.
 *
 * Usage (inside api container):
 *   node dist/admin/approve-assessment.js "<title-substring>"
 */
import { prisma } from '../lib/prisma.js';
import { captureSnapshot } from '../modules/assessments/snapshots.js';

const OVERRIDE_NOTE = 'Manual override approval (separation-of-duties bypassed)';

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node dist/admin/approve-assessment.js "<title-substring>"');
    process.exit(2);
  }

  const matches = await prisma.assessment.findMany({
    where: {
      title: { contains: arg, mode: 'insensitive' },
      reviewStatus: 'IN_REVIEW',
    },
    select: { id: true, title: true, leadAssessorId: true },
  });

  if (matches.length === 0) {
    console.error(`No IN_REVIEW assessment found with title containing "${arg}".`);
    process.exit(3);
  }
  if (matches.length > 1) {
    console.error(`Ambiguous: ${matches.length} IN_REVIEW assessments match "${arg}":`);
    for (const m of matches) console.error(`  ${m.id}  ${m.title}`);
    process.exit(4);
  }

  const target = matches[0]!;
  const now = new Date();

  const updated = await prisma.assessment.update({
    where: { id: target.id },
    data: {
      status: 'APPROVED',
      reviewStatus: 'APPROVED',
      reviewedById: target.leadAssessorId,
      reviewNotes: OVERRIDE_NOTE,
      completedAt: now,
      signedOffAt: now,
    },
    select: {
      id: true, title: true, status: true, reviewStatus: true,
      reviewedById: true, signedOffAt: true, completedAt: true,
    },
  });

  await captureSnapshot({
    assessmentId: target.id,
    capturedById: target.leadAssessorId,
    reason: 'APPROVED',
    note: OVERRIDE_NOTE,
  });

  console.log('Override approval applied:');
  console.log(JSON.stringify(updated, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
