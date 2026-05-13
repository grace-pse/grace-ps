// Seed: SurveyQuestion library + attachments to system AAA templates.
//
// Idempotent: dedupes questions by (prompt, type, evidenceType, isSystem=true)
// and upserts attachment join rows by composite PK. Safe to re-run on every
// container start.
//
// Attachment strategy is BROAD: questions latch onto template *properties*
// (assetType / actionType / shapeCategory / domain / ppsFunctions) rather
// than specific slugs, so any new system template that fits the criteria
// inherits the pack automatically. Operators can refine in the UI later.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Question library ─────────────────────────────────────────────
// Each entry has:
//   prompt, type, evidenceType, defaultWeight, severityMap, options?, hint?
//   attach: rules describing which AAA templates it should link to.
//
// Rule shape: { kind: 'asset'|'threat'|'cm', filter: { ... } }
//   asset filter: { assetTypes: AssetType[] }
//   threat filter: { actionTypes: ActionType[] }
//   cm filter:    { shapeCategories?: ShapeCategory[]; domains?: ProtectionDomain[]; ppsFunctions?: PpsFunction[] }
// All filters are inclusive (any-of). Multiple rules per question are OR-ed.

const YN = { YES: 'ok', PARTIAL: 'warn', NO: 'bad' };
const YN_INVERTED = { YES: 'bad', PARTIAL: 'warn', NO: 'ok' };

const QUESTIONS = [
  // ─── ASSET-LEVEL: baseline / compliance ─────────────────────────
  {
    prompt: 'Is the asset’s primary entrance manned or supervised during operating hours?',
    type: 'yes_no_partial',
    evidenceType: 'PHYSICAL',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Asset baseline',
    attach: [{ kind: 'asset', filter: { assetTypes: ['SITE', 'BUILDING'] } }],
  },
  {
    prompt: 'Are intrusion-resistant locks installed on all external doors of this asset?',
    type: 'yes_no_partial',
    evidenceType: 'PHYSICAL',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Asset baseline',
    attach: [{ kind: 'asset', filter: { assetTypes: ['BUILDING', 'FLOOR', 'ROOM'] } }],
  },
  {
    prompt: 'Is access to this asset logged and reviewable for the past 90 days?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 3,
    severityMap: YN,
    category: 'Asset baseline',
    attach: [{ kind: 'asset', filter: { assetTypes: ['BUILDING', 'FLOOR', 'ROOM', 'ZONE', 'EQUIPMENT'] } }],
  },
  {
    prompt: 'Is the asset enclosed by a continuous, unbroken physical perimeter?',
    type: 'yes_no_partial',
    evidenceType: 'PHYSICAL',
    defaultWeight: 5,
    severityMap: YN,
    category: 'Asset baseline',
    attach: [{ kind: 'asset', filter: { assetTypes: ['SITE', 'BUILDING', 'ZONE'] } }],
  },
  {
    prompt: 'Is the asset’s emergency egress route clearly marked and unobstructed?',
    type: 'yes_no_partial',
    evidenceType: 'PHYSICAL',
    defaultWeight: 3,
    severityMap: YN,
    category: 'Life safety',
    attach: [{ kind: 'asset', filter: { assetTypes: ['BUILDING', 'FLOOR', 'ROOM'] } }],
  },
  {
    prompt: 'Are personnel handling this asset background-checked and screened?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Personnel',
    attach: [{ kind: 'asset', filter: { assetTypes: ['PERSON', 'INFORMATION', 'IP'] } }],
  },

  // ─── THREAT-LEVEL: likelihood evidence ──────────────────────────
  {
    prompt: 'Has hostile reconnaissance or surveillance been observed in the last 6 months?',
    type: 'yes_no_partial',
    evidenceType: 'PHYSICAL',
    defaultWeight: 4,
    severityMap: YN_INVERTED,
    category: 'Threat intel',
    attach: [{ kind: 'threat', filter: { actionTypes: ['INTRUSION', 'THEFT', 'ESPIONAGE', 'SABOTAGE'] } }],
  },
  {
    prompt: 'Are there current credible threat indicators against this asset class in the local region?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 4,
    severityMap: YN_INVERTED,
    category: 'Threat intel',
    attach: [{ kind: 'threat', filter: { actionTypes: ['INTRUSION', 'THEFT', 'DAMAGE', 'ESPIONAGE', 'SABOTAGE', 'ASSAULT', 'BOMB', 'ARSON'] } }],
  },
  {
    prompt: 'Number of reported incidents matching this threat in the trailing 12 months.',
    type: 'number',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 3,
    severityMap: { BELOW_30: 'ok', '30_TO_60': 'warn', ABOVE_60: 'bad' },
    category: 'Threat intel',
    hint: 'Counted across this site and immediate neighbourhood; ok < 30, warn 30–60, bad > 60.',
    attach: [{ kind: 'threat', filter: { actionTypes: ['THEFT', 'INTRUSION', 'ASSAULT', 'FRAUD', 'CYBER'] } }],
  },
  {
    prompt: 'Are external geopolitical / activist conditions elevating this threat at present?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 3,
    severityMap: YN_INVERTED,
    category: 'Threat intel',
    attach: [{ kind: 'threat', filter: { actionTypes: ['BOMB', 'ARSON', 'SABOTAGE', 'ASSAULT'] } }],
  },
  {
    prompt: 'Has an insider-threat indicator been raised against personnel with access?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 4,
    severityMap: YN_INVERTED,
    category: 'Threat intel',
    attach: [{ kind: 'threat', filter: { actionTypes: ['THEFT', 'ESPIONAGE', 'SABOTAGE', 'FRAUD'] } }],
  },

  // ─── COUNTERMEASURE-LEVEL: control verification ─────────────────
  // EQUIPMENT (alarms, locks, cameras, sensors): cert + maintenance + photo
  {
    prompt: 'Is a current conformity certificate (e.g. EN/UL) on file for this countermeasure?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 5,
    severityMap: YN,
    category: 'Compliance',
    attach: [{ kind: 'cm', filter: { shapeCategories: ['EQUIPMENT', 'ARCHITECTURAL'] } }],
  },
  {
    prompt: 'Was the most recent preventive maintenance performed within the last 6 months?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Maintenance',
    attach: [{ kind: 'cm', filter: { shapeCategories: ['EQUIPMENT'] } }],
  },
  {
    prompt: 'Is there photographic or physical evidence that the countermeasure is installed and operating?',
    type: 'yes_no_partial',
    evidenceType: 'PHYSICAL',
    defaultWeight: 3,
    severityMap: YN,
    category: 'Verification',
    attach: [{ kind: 'cm', filter: { shapeCategories: ['EQUIPMENT', 'ARCHITECTURAL'] } }],
  },
  {
    prompt: 'Is the countermeasure free of visible damage, tampering, or wear that would degrade its function?',
    type: 'yes_no_partial',
    evidenceType: 'PHYSICAL',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Verification',
    attach: [{ kind: 'cm', filter: { shapeCategories: ['EQUIPMENT', 'ARCHITECTURAL'] } }],
  },
  // PROCEDURAL: documentation + review cadence
  {
    prompt: 'Is this procedure documented in the current security operations manual?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Procedure',
    attach: [{ kind: 'cm', filter: { shapeCategories: ['PROCEDURAL', 'SECURITY_PROGRAMME'] } }],
  },
  {
    prompt: 'Has this procedure been formally reviewed and re-signed within the last 12 months?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 3,
    severityMap: YN,
    category: 'Procedure',
    attach: [{ kind: 'cm', filter: { shapeCategories: ['PROCEDURAL', 'SECURITY_PROGRAMME'] } }],
  },
  // HUMAN: training + qualification
  {
    prompt: 'Have all personnel performing this control received refresher training in the last 12 months?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Personnel',
    attach: [{ kind: 'cm', filter: { shapeCategories: ['HUMAN'] } }],
  },
  {
    prompt: 'Are all personnel performing this control formally licensed/qualified for the role?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 5,
    severityMap: YN,
    category: 'Personnel',
    attach: [{ kind: 'cm', filter: { shapeCategories: ['HUMAN'] } }],
  },
  // DETECT-function CMs: sensor coverage + monitoring
  {
    prompt: 'Is the detection sensor’s coverage area free of dead zones (verified by walk-test)?',
    type: 'yes_no_partial',
    evidenceType: 'PHYSICAL',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Detection',
    attach: [{ kind: 'cm', filter: { ppsFunctions: ['DETECT'] } }],
  },
  {
    prompt: 'Is the alarm signal monitored by an attended station 24/7?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 5,
    severityMap: YN,
    category: 'Detection',
    attach: [{ kind: 'cm', filter: { ppsFunctions: ['DETECT'] } }],
  },
  // SURVEILLANCE-domain CMs: streaming + retention
  {
    prompt: 'Are all cameras streaming live to the VMS with no offline channels?',
    type: 'yes_no_partial',
    evidenceType: 'REMOTE_TECH',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Surveillance',
    attach: [{ kind: 'cm', filter: { domains: ['SURVEILLANCE'] } }],
  },
  {
    prompt: 'Recording-retention period in days currently configured.',
    type: 'number',
    evidenceType: 'REMOTE_TECH',
    defaultWeight: 3,
    severityMap: { BELOW_30: 'bad', '30_TO_60': 'warn', ABOVE_60: 'ok' },
    category: 'Surveillance',
    hint: 'ok ≥ 60 days (typical regulatory minimum), warn 30–60, bad < 30.',
    attach: [{ kind: 'cm', filter: { domains: ['SURVEILLANCE'] } }],
  },
  // ACCESS-domain CMs: badge audit
  {
    prompt: 'Has a badge / access-list audit been completed within the last quarter?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Access control',
    attach: [{ kind: 'cm', filter: { domains: ['ACCESS'] } }],
  },
  // RECOVER-function CMs: backup test
  {
    prompt: 'Has the recovery / backup process been successfully tested in the last quarter?',
    type: 'yes_no_partial',
    evidenceType: 'DOC_REVIEW',
    defaultWeight: 4,
    severityMap: YN,
    category: 'Recovery',
    attach: [{ kind: 'cm', filter: { ppsFunctions: ['RECOVER'] } }],
  },
];

// ─── Upsert helper ────────────────────────────────────────────────
async function upsertQuestion(q) {
  const existing = await prisma.surveyQuestion.findFirst({
    where: {
      tenantId: null,
      isSystem: true,
      prompt: q.prompt,
      type: q.type,
      evidenceType: q.evidenceType,
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.surveyQuestion.create({
    data: {
      tenantId: null,
      isSystem: true,
      prompt: q.prompt,
      category: q.category ?? null,
      hint: q.hint ?? null,
      type: q.type,
      options: q.options ?? undefined,
      severityMap: q.severityMap ?? undefined,
      evidenceType: q.evidenceType,
      defaultWeight: q.defaultWeight,
      isActive: true,
    },
    select: { id: true },
  });
  return created.id;
}

async function findAssetTemplateIds(filter) {
  return (await prisma.assetTemplate.findMany({
    where: { assetType: { in: filter.assetTypes } },
    select: { id: true },
  })).map((r) => r.id);
}

async function findThreatTemplateIds(filter) {
  return (await prisma.threatTemplate.findMany({
    where: { actionType: { in: filter.actionTypes } },
    select: { id: true },
  })).map((r) => r.id);
}

async function findCmTemplateIds(filter) {
  const orClauses = [];
  if (filter.shapeCategories?.length) orClauses.push({ shapeCategory: { in: filter.shapeCategories } });
  if (filter.domains?.length) orClauses.push({ domain: { in: filter.domains } });
  if (filter.ppsFunctions?.length) orClauses.push({ ppsFunctions: { hasSome: filter.ppsFunctions } });
  if (orClauses.length === 0) return [];
  return (await prisma.countermeasureTemplate.findMany({
    where: { OR: orClauses },
    select: { id: true },
  })).map((r) => r.id);
}

async function attach(questionId, rules) {
  let attached = 0;
  for (const rule of rules) {
    if (rule.kind === 'asset') {
      const ids = await findAssetTemplateIds(rule.filter);
      for (const id of ids) {
        await prisma.assetTemplateQuestion.upsert({
          where: { assetTemplateId_questionId: { assetTemplateId: id, questionId } },
          create: { assetTemplateId: id, questionId, sortOrder: 0 },
          update: {},
        });
        attached += 1;
      }
    } else if (rule.kind === 'threat') {
      const ids = await findThreatTemplateIds(rule.filter);
      for (const id of ids) {
        await prisma.threatTemplateQuestion.upsert({
          where: { threatTemplateId_questionId: { threatTemplateId: id, questionId } },
          create: { threatTemplateId: id, questionId, sortOrder: 0 },
          update: {},
        });
        attached += 1;
      }
    } else if (rule.kind === 'cm') {
      const ids = await findCmTemplateIds(rule.filter);
      for (const id of ids) {
        await prisma.countermeasureTemplateQuestion.upsert({
          where: { countermeasureTemplateId_questionId: { countermeasureTemplateId: id, questionId } },
          create: { countermeasureTemplateId: id, questionId, sortOrder: 0 },
          update: {},
        });
        attached += 1;
      }
    }
  }
  return attached;
}

async function main() {
  let createdOrFound = 0;
  let totalAttachments = 0;
  for (const q of QUESTIONS) {
    const id = await upsertQuestion(q);
    createdOrFound += 1;
    const n = await attach(id, q.attach);
    totalAttachments += n;
  }
  console.log(`[seed-survey-questions] ${createdOrFound} questions in library, ${totalAttachments} template attachments`);
  await prisma.$disconnect();
}

void main().catch(async (err) => {
  console.error('[seed-survey-questions] failed:', err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
