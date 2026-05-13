// scripts/seed-approved-assessment.mjs
// One-shot test helper: spins up a full APPROVED assessment so we can smoke-test
// the PDF report endpoint (Block B). Safe to re-run (clears the tenant first).
//
// Run from repo root: node scripts/seed-approved-assessment.mjs
// Requires server/.env to be populated (DATABASE_URL).

import { PrismaClient } from '../server/node_modules/@prisma/client/index.js';
import bcrypt from '../server/node_modules/bcryptjs/index.js';

const prisma = new PrismaClient();
const TENANT_SLUG = 'block-b-smoke';

async function main() {
  // Wipe any prior test tenant
  const existing = await prisma.organization.findUnique({ where: { slug: TENANT_SLUG } });
  if (existing) {
    console.log(`cleaning existing tenant ${existing.id}`);
    await prisma.actionPlan.deleteMany({ where: { assessment: { tenantId: existing.id } } });
    await prisma.threat.deleteMany({ where: { assessment: { tenantId: existing.id } } });
    await prisma.assessment.deleteMany({ where: { tenantId: existing.id } });
    await prisma.assetRelationship.deleteMany({ where: { tenantId: existing.id } });
    await prisma.assetClusterMembership.deleteMany({
      where: { cluster: { tenantId: existing.id } },
    });
    await prisma.assetCluster.deleteMany({ where: { tenantId: existing.id } });
    await prisma.asset.deleteMany({ where: { tenantId: existing.id } });
    await prisma.user.deleteMany({ where: { tenantId: existing.id } });
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  const org = await prisma.organization.create({
    data: { name: 'Block B Smoke Tenant', slug: TENANT_SLUG, subscriptionTier: 'FREE' },
  });
  console.log(`org: ${org.id}`);

  const pwdHash = await bcrypt.hash('password123!', 10);
  const admin = await prisma.user.create({
    data: {
      tenantId: org.id, email: 'admin@block-b.test',
      passwordHash: pwdHash, firstName: 'Anna', lastName: 'Admin', role: 'ADMIN',
    },
  });
  const lead = await prisma.user.create({
    data: {
      tenantId: org.id, email: 'lead@block-b.test',
      passwordHash: pwdHash, firstName: 'Lukas', lastName: 'LeadAssessor', role: 'LEAD_ASSESSOR',
    },
  });
  const reviewer = await prisma.user.create({
    data: {
      tenantId: org.id, email: 'reviewer@block-b.test',
      passwordHash: pwdHash, firstName: 'Rita', lastName: 'Reviewer', role: 'REVIEWER',
    },
  });
  console.log(`users: admin=${admin.id} lead=${lead.id} reviewer=${reviewer.id}`);

  const site = await prisma.asset.create({
    data: {
      tenantId: org.id, name: 'Warsaw HQ Campus', assetType: 'SITE',
      category: 'TANGIBLE', criticality: 5, status: 'ACTIVE',
      location: { lat: 52.2297, lng: 21.0122, address: 'ul. Marszalkowska 1, Warszawa' },
      createdById: admin.id,
      description: 'Primary logistics HQ with 24/7 ops, data centre and executive offices.',
    },
  });
  const building = await prisma.asset.create({
    data: {
      tenantId: org.id, parentId: site.id, name: 'Building A — Data Centre', assetType: 'BUILDING',
      category: 'TANGIBLE', criticality: 5, status: 'ACTIVE',
      createdById: admin.id,
      description: 'Tier 3 data centre hosting core ERP and WMS platforms.',
    },
  });
  const server = await prisma.asset.create({
    data: {
      tenantId: org.id, parentId: building.id, name: 'Core ERP cluster', assetType: 'EQUIPMENT',
      category: 'TANGIBLE', criticality: 5, status: 'ACTIVE',
      createdById: admin.id,
      description: 'HA cluster running the ERP — business-critical.',
    },
  });

  // Assessment — approved, fully scored
  const now = new Date();
  const assessment = await prisma.assessment.create({
    data: {
      tenantId: org.id,
      assetId: site.id,
      title: 'Warsaw HQ — Full SRA 2026 Q2',
      assessmentType: 'FULL_SRA',
      status: 'APPROVED',
      currentStep: 7,
      leadAssessorId: lead.id,
      reviewStatus: 'APPROVED',
      reviewedById: reviewer.id,
      reviewNotes: 'Scope and scoring are consistent. TEAR rationales are well supported. Approved.',
      startedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      completedAt: now,
      nextReviewDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365),
    },
  });
  console.log(`assessment: ${assessment.id}`);

  // Two threats
  const threatCrim = await prisma.threat.create({
    data: {
      assessmentId: assessment.id, targetAssetId: building.id,
      adversaryType: 'CRIMINAL', actionType: 'INTRUSION',
      adversaryDescription: 'Organised property crime ring, previously active in Warsaw industrial parks.',
      actionDescription: 'Forced entry through a perimeter service door after hours to steal high-value equipment.',
      locationContext: 'Rear delivery bay, unmanned 22:00–06:00, obscured by loading ramp wall.',
      facilitatingFactors: 'Public schedule of deliveries leaks via supplier portal; door lock is mechanical only.',
      timeContext: 'Higher risk on Friday nights and during long public holidays.',
      likelihoodScore: 4, likelihoodRationale: 'Two reconnaissance incidents in the last 18 months; matches regional MO.',
      impactScore: 5,
      impactRationale: 'Loss of the ERP cluster would halt EU warehouse ops within 4h; financial impact ~€2.5M/day.',
      impactBreakdown: { people: 2, property: 5, operations: 5, reputation: 4, financial: 5 },
      irv: 'HIGH',
      vulnerabilityRating: 'BARELY_ADEQUATE',
      vulnerabilityRationale: 'Mechanical lock + 2-hour guard response; CCTV covers exterior but not the ramp blind spot.',
      riskTreatmentPriority: 'HIGHEST',
      tearStrategy: 'REDUCE',
      alarpJustification: 'Residual risk above tolerance; additional control layers (access badge + motion-triggered floodlights + 24/7 guard post) will bring it to ALARP within Q3.',
      complianceTags: ['NIS2_ART_21', 'ISO_31000', 'CER'],
    },
  });
  const threatIns = await prisma.threat.create({
    data: {
      assessmentId: assessment.id, targetAssetId: server.id,
      adversaryType: 'INSIDER', actionType: 'ESPIONAGE',
      adversaryDescription: 'Disgruntled privileged user with domain-admin rights.',
      actionDescription: 'Exfiltration of customer master data via USB or cloud-sync tool.',
      locationContext: 'Data-centre ops room, M-F office hours.',
      facilitatingFactors: 'No DLP on workstations; USB ports enabled; shared admin accounts still in use.',
      timeContext: 'Greatest risk during employee notice periods.',
      likelihoodScore: 3, likelihoodRationale: 'Low base rate, but recent turnover in ops team and two near-miss policy breaches.',
      impactScore: 4,
      impactRationale: 'Customer data breach triggers GDPR + NIS2 incident reporting and reputational impact.',
      impactBreakdown: { people: 1, property: 1, operations: 3, reputation: 5, financial: 4 },
      irv: 'MODERATE',
      vulnerabilityRating: 'INADEQUATE',
      vulnerabilityRationale: 'No DLP, no USB lockdown, shared credentials; controls lag behind ISO 27001 Annex A baseline.',
      riskTreatmentPriority: 'HIGH',
      tearStrategy: 'REDUCE',
      alarpJustification: 'DLP roll-out + named admin accounts + USB policy will reach ALARP by end of Q4.',
      complianceTags: ['NIS2_ART_23', 'ISO_31000'],
    },
  });
  console.log(`threats: ${threatCrim.id}, ${threatIns.id}`);

  await prisma.actionPlan.createMany({
    data: [
      {
        assessmentId: assessment.id, threatId: threatCrim.id, riskPriority: 'HIGHEST',
        actionRequired: 'Install motion-triggered LED floodlights covering the delivery ramp blind spot.',
        responsiblePerson: 'Facilities Lead — Kamila Nowak',
        targetDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 45),
        status: 'IN_PROGRESS',
        complianceTags: ['NIS2_ART_21', 'CER'],
      },
      {
        assessmentId: assessment.id, threatId: threatCrim.id, riskPriority: 'HIGHEST',
        actionRequired: 'Upgrade rear service door to electronic access with audit trail and 24/7 guard coverage for midnight-06:00 window.',
        responsiblePerson: 'Head of Security — Tomas Kowalski',
        targetDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90),
        status: 'PENDING',
        complianceTags: ['NIS2_ART_21', 'ISO_31000', 'CER'],
      },
      {
        assessmentId: assessment.id, threatId: threatIns.id, riskPriority: 'HIGH',
        actionRequired: 'Deploy endpoint DLP across ops workstations; enforce named-admin policy; disable USB mass storage by default.',
        responsiblePerson: 'CISO — Marta Lewandowska',
        targetDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 120),
        status: 'PENDING',
        complianceTags: ['NIS2_ART_23'],
      },
    ],
  });
  console.log(`action plans: 3`);

  console.log('\n=== TEST DATA READY ===');
  console.log(`ASSESSMENT_ID=${assessment.id}`);
  console.log(`LEAD_EMAIL=lead@block-b.test  password=password123!`);
  console.log(`REVIEWER_EMAIL=reviewer@block-b.test  password=password123!`);
  console.log(`ADMIN_EMAIL=admin@block-b.test  password=password123!`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
