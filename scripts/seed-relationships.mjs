// scripts/seed-relationships.mjs
// Seeds a handful of AssetRelationship rows for the block-b-smoke tenant
// so the /relationships graph page has explicit edges to render.
// Idempotent: wipes prior rows for this tenant before inserting.

import { PrismaClient } from '../server/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();
const TENANT_SLUG = 'block-b-smoke';

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: TENANT_SLUG } });
  if (!org) throw new Error(`tenant ${TENANT_SLUG} not found — run seed-approved-assessment.mjs first`);

  const assets = await prisma.asset.findMany({
    where: { tenantId: org.id },
    select: { id: true, name: true, assetType: true },
  });
  const byName = new Map(assets.map((a) => [a.name, a]));
  const byType = (t) => assets.filter((a) => a.assetType === t);

  await prisma.assetRelationship.deleteMany({ where: { tenantId: org.id } });

  const edges = [];

  // 1. Every SITE "supplies" something — link each site to a floor under another site (or any equipment).
  const sites = byType('SITE');
  const floors = byType('FLOOR');
  if (sites.length >= 2 && floors.length >= 1) {
    edges.push({
      sourceAssetId: sites[0].id, targetAssetId: floors[0].id,
      relationshipType: 'SUPPLIES', direction: 'UNIDIRECTIONAL', impactPropagation: true,
      description: 'Backup power feed to demo floor.',
    });
  }

  // 2. Equipment DEPENDS_ON building (takes first building).
  const equipment = byType('EQUIPMENT');
  const buildings = byType('BUILDING');
  if (equipment[0] && buildings[0]) {
    edges.push({
      sourceAssetId: equipment[0].id, targetAssetId: buildings[0].id,
      relationshipType: 'DEPENDS_ON', direction: 'UNIDIRECTIONAL', impactPropagation: true,
      description: 'Equipment relies on building HVAC + power.',
    });
  }

  // 3. ADJACENT_TO between two floors if available.
  if (floors.length >= 2) {
    edges.push({
      sourceAssetId: floors[0].id, targetAssetId: floors[1].id,
      relationshipType: 'ADJACENT_TO', direction: 'BIDIRECTIONAL', impactPropagation: false,
      description: 'Physically adjacent floors on the same campus.',
    });
  }

  // 4. PROTECTS: any countermeasure-ish asset → building. Use any TANGIBLE EQUIPMENT if present.
  const protectorSrc = equipment.find((e) => e.id !== equipment[0]?.id) ?? byName.get('Demo floor');
  if (protectorSrc && buildings[0]) {
    edges.push({
      sourceAssetId: protectorSrc.id, targetAssetId: buildings[0].id,
      relationshipType: 'PROTECTS', direction: 'UNIDIRECTIONAL', impactPropagation: false,
      description: 'Access-control system protects the building.',
    });
  }

  // 5. COMMUNICATES_WITH between two sites if available.
  if (sites.length >= 2) {
    edges.push({
      sourceAssetId: sites[0].id, targetAssetId: sites[1].id,
      relationshipType: 'COMMUNICATES_WITH', direction: 'BIDIRECTIONAL', impactPropagation: false,
      description: 'Site-to-site encrypted VPN link.',
    });
  }

  let created = 0;
  for (const e of edges) {
    await prisma.assetRelationship.create({ data: { tenantId: org.id, ...e } });
    created++;
  }

  console.log(`=== RELATIONSHIPS SEED ===`);
  console.log(`tenant=${TENANT_SLUG}  assets=${assets.length}  created=${created}`);
  for (const e of edges) {
    const s = assets.find((a) => a.id === e.sourceAssetId).name;
    const t = assets.find((a) => a.id === e.targetAssetId).name;
    console.log(`  ${s}  --(${e.relationshipType})-->  ${t}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
