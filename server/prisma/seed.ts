import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Phase 0: no seed content required.
  // Phase 1 will load Banking & Finance template pack here.
  console.log('seed: phase 0 — no-op. Register an org via the API instead.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
