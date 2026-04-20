// Seed script: Banking & Finance template package.
// Plain ESM JS — run inside the api runner container with:
//   node /app/prisma/seed-banking-finance.mjs
// Idempotent: upserts package, modules, asset templates, threat templates,
// and curated asset<->threat correlations.

import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, 'banking_finance_seed.json');

const PACKAGE = {
  slug: 'banking-finance',
  name: 'Banking & Finance',
  industry: 'Financial Services',
  version: '1.0.0',
  regionScope: 'Global',
  description:
    'Comprehensive physical-security content pack for retail and commercial banks ' +
    'covering HQ, branches, back-office operations, cash logistics (CIT + vault), ' +
    'ATM estate, data centers, and executive protection. Aligned with CSMP 3-A ' +
    'methodology, FFIEC / NIST CSF 2.0, ISO 27001 Annex A.11, UL 687 vault ratings, ' +
    'TIA-942 data-center tiering, BSIA CVIT and ASIS guidelines.',
  complianceRefs: [
    'FFIEC', 'NIST CSF 2.0', 'ISO 27001 Annex A.11', 'PCI-DSS',
    'UL 687', 'TIA-942', 'BSIA CVIT', 'ASIS PAP',
  ],
};

const prisma = new PrismaClient();

async function main() {
  const modules = JSON.parse(await readFile(SEED_FILE, 'utf-8'));
  console.log(`Loaded ${modules.length} modules from ${SEED_FILE}`);

  const pkg = await prisma.templatePackage.upsert({
    where: { slug: PACKAGE.slug },
    update: {
      name: PACKAGE.name,
      industry: PACKAGE.industry,
      version: PACKAGE.version,
      regionScope: PACKAGE.regionScope,
      description: PACKAGE.description,
      complianceRefs: PACKAGE.complianceRefs,
      isSystem: true,
    },
    create: { ...PACKAGE, isSystem: true },
  });

  let totalAssets = 0;
  let totalThreats = 0;
  let totalCorrelations = 0;

  for (const mod of modules) {
    const m = await prisma.templateModule.upsert({
      where: { packageId_slug: { packageId: pkg.id, slug: mod.slug } },
      update: {
        name: mod.name,
        description: mod.description ?? null,
        icon: mod.icon ?? null,
        sortOrder: mod.sortOrder ?? 0,
      },
      create: {
        packageId: pkg.id,
        slug: mod.slug,
        name: mod.name,
        description: mod.description ?? null,
        icon: mod.icon ?? null,
        sortOrder: mod.sortOrder ?? 0,
      },
    });

    const assetIdBySlug = new Map();
    const threatIdBySlug = new Map();

    for (const asset of mod.assets ?? []) {
      const saved = await prisma.assetTemplate.upsert({
        where: { moduleId_slug: { moduleId: m.id, slug: asset.slug } },
        update: {
          name: asset.name,
          assetType: asset.assetType,
          category: asset.category,
          description: asset.description ?? null,
          defaultCriticality: asset.defaultCriticality ?? 3,
          parentSlug: asset.parentSlug ?? null,
          tags: asset.tags ?? [],
          attributes: asset.metadata ?? {},
        },
        create: {
          moduleId: m.id,
          slug: asset.slug,
          name: asset.name,
          assetType: asset.assetType,
          category: asset.category,
          description: asset.description ?? null,
          defaultCriticality: asset.defaultCriticality ?? 3,
          parentSlug: asset.parentSlug ?? null,
          tags: asset.tags ?? [],
          attributes: asset.metadata ?? {},
        },
      });
      assetIdBySlug.set(asset.slug, saved.id);
      totalAssets++;
    }

    for (const threat of mod.threats ?? []) {
      const saved = await prisma.threatTemplate.upsert({
        where: { moduleId_slug: { moduleId: m.id, slug: threat.slug } },
        update: {
          scenarioName: threat.scenarioName,
          adversaryType: threat.adversaryType,
          actionType: threat.actionType,
          adversaryProfile: threat.adversaryProfile ?? {},
          typicalActions: threat.typicalActions ?? [],
          targetAssetTypes: threat.targetAssetTypes ?? [],
          indicators: threat.indicators ?? [],
          recommendedCountermeasures: threat.recommendedCountermeasures ?? null,
          suggestedLikelihood: threat.suggestedLikelihood ?? null,
          csmpUnitReference: threat.csmpUnitReference ?? null,
        },
        create: {
          moduleId: m.id,
          slug: threat.slug,
          scenarioName: threat.scenarioName,
          adversaryType: threat.adversaryType,
          actionType: threat.actionType,
          adversaryProfile: threat.adversaryProfile ?? {},
          typicalActions: threat.typicalActions ?? [],
          targetAssetTypes: threat.targetAssetTypes ?? [],
          indicators: threat.indicators ?? [],
          recommendedCountermeasures: threat.recommendedCountermeasures ?? null,
          suggestedLikelihood: threat.suggestedLikelihood ?? null,
          csmpUnitReference: threat.csmpUnitReference ?? null,
        },
      });
      threatIdBySlug.set(threat.slug, saved.id);
      totalThreats++;
    }

    for (const asset of mod.assets ?? []) {
      const assetId = assetIdBySlug.get(asset.slug);
      if (!assetId) continue;
      await prisma.assetTemplateThreat.deleteMany({
        where: { assetTemplateId: assetId },
      });
      for (const rec of asset.recommendedThreats ?? []) {
        const threatId = threatIdBySlug.get(rec.slug);
        if (!threatId) {
          console.warn(`  WARN ${mod.slug}/${asset.slug}: unknown threat ${rec.slug} — skipped`);
          continue;
        }
        const relevance = ['HIGH', 'MEDIUM', 'LOW'].includes(rec.relevance) ? rec.relevance : 'MEDIUM';
        await prisma.assetTemplateThreat.create({
          data: {
            assetTemplateId: assetId,
            threatTemplateId: threatId,
            relevance,
            rationale: rec.rationale ?? null,
          },
        });
        totalCorrelations++;
      }
    }

    console.log(`  ✓ ${mod.name} (${(mod.assets ?? []).length} assets, ${(mod.threats ?? []).length} threats)`);
  }

  console.log(
    `\nSeeded '${PACKAGE.name}': ${modules.length} modules, ${totalAssets} assets, ` +
    `${totalThreats} threats, ${totalCorrelations} correlations`,
  );
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
