// scripts/seed-in-review-assessment.mjs
// Adds a second assessment (IN_REVIEW state) to the existing block-b-smoke
// instance so Block C (review workflow) can be smoke-tested. Idempotent:
// wipes any prior IN_REVIEW row with this title before creating a new one.

import { PrismaClient } from '../server/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();
const ORG_SLUG = 'block-b-smoke';
const TITLE = 'Oslo Office — Quarterly Review Q2';

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`instance ${ORG_SLUG} not found — run seed-approved-assessment.mjs first`);

  const lead = await prisma.user.findFirst({ where: { role: 'LEAD_ASSESSOR' } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!lead || !admin) throw new Error('lead or admin user missing');

  // Wipe prior copy (by title) — lets us rerun the seed cleanly.
  const prior = await prisma.assessment.findFirst({ where: { title: TITLE } });
  if (prior) {
    await prisma.actionPlan.deleteMany({ where: { assessmentId: prior.id } });
    await prisma.threat.deleteMany({ where: { assessmentId: prior.id } });
    await prisma.assessment.delete({ where: { id: prior.id } });
    console.log(`cleaned prior copy ${prior.id}`);
  }

  // Create a second asset hierarchy just for this assessment
  let osloSite = await prisma.asset.findFirst({ where: { name: 'Oslo Office' } });
  if (!osloSite) {
    osloSite = await prisma.asset.create({
      data: {
        name: 'Oslo Office', assetType: 'SITE',
        category: 'TANGIBLE', criticality: 4, status: 'ACTIVE',
        location: { lat: 59.9139, lng: 10.7522, address: 'Storgata 10, Oslo' },
        createdById: admin.id,
        description: 'Nordic sales hub with client-facing demo centre.',
      },
    });
  }
  let osloFloor = await prisma.asset.findFirst({ where: { name: 'Demo floor', parentId: osloSite.id } });
  if (!osloFloor) {
    osloFloor = await prisma.asset.create({
      data: {
        parentId: osloSite.id, name: 'Demo floor', assetType: 'FLOOR',
        category: 'TANGIBLE', criticality: 3, status: 'ACTIVE', createdById: admin.id,
        description: 'Public-access demo area on ground floor.',
      },
    });
  }

  const now = new Date();
  const assessment = await prisma.assessment.create({
    data: {
      assetId: osloSite.id,
      title: TITLE,
      assessmentType: 'SURVEY',
      status: 'REVIEW',
      currentStep: 7,
      leadAssessorId: lead.id,
      reviewStatus: 'IN_REVIEW',
      startedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5),
    },
  });
  console.log(`assessment: ${assessment.id}`);

  // Minimal valid threat set (1 high-priority w/ REDUCE + 1 action plan)
  const threat = await prisma.threat.create({
    data: {
      assessmentId: assessment.id, targetAssetId: osloFloor.id,
      adversaryType: 'ACTIVIST', actionType: 'DISRUPTION',
      adversaryDescription: 'Local activist group protesting supply-chain partnerships.',
      actionDescription: 'Unannounced sit-in on the demo floor during client visits.',
      locationContext: 'Ground-floor demo area, public entrance.',
      facilitatingFactors: 'No badge check past reception; calendar of client visits is semi-public.',
      timeContext: 'Higher likelihood during ESG-related media cycles.',
      likelihoodScore: 4, likelihoodRationale: 'Two near-miss attempts in the past 6 months at similar Nordic sites.',
      impactScore: 3,
      impactRationale: 'Business disruption for a single working day; reputational noise but no data loss.',
      impactBreakdown: { people: 2, property: 1, operations: 4, reputation: 4, financial: 2 },
      irv: 'MODERATE',
      vulnerabilityRating: 'BARELY_ADEQUATE',
      vulnerabilityRationale: 'Reception-only access control; no physical barriers between demo floor and street.',
      riskTreatmentPriority: 'HIGH',
      tearStrategy: 'REDUCE',
      alarpJustification: 'Badge-gated turnstile plus pre-announced visitor escort procedure will bring residual risk to ALARP.',
      complianceTags: ['NIS2_ART_21', 'ASIS_SPC_1'],
    },
  });

  await prisma.actionPlan.create({
    data: {
      assessmentId: assessment.id, threatId: threat.id, riskPriority: 'HIGH',
      actionRequired: 'Install badge-gated turnstile at reception; require escorted visitors on demo floor.',
      responsiblePerson: 'Facilities — Erik Johansen',
      targetDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60),
      status: 'PENDING',
      complianceTags: ['NIS2_ART_21', 'ASIS_SPC_1'],
    },
  });

  console.log('=== IN_REVIEW SEED READY ===');
  console.log(`ASSESSMENT_ID=${assessment.id}`);
  console.log(`Lead: ${lead.email}  password=password123!`);
  console.log('Reviewer: reviewer@block-b.test  password=password123!');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
