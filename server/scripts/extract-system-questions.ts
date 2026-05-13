// One-off migration script: walks every system SurveyTemplate (tenantId=NULL),
// extracts questions out of the embedded JSON `schema` field, dedupes by
// (prompt, type, evidenceType), and inserts them as standalone SurveyQuestion
// rows in the library so admins can attach them to AAA templates.
//
// Idempotent: re-runs skip questions whose (prompt, type, evidenceType, isSystem=true)
// triplet already exists.
//
// Usage:
//   pnpm tsx scripts/extract-system-questions.ts          # dry-run
//   pnpm tsx scripts/extract-system-questions.ts --apply  # writes

import { prisma } from '../src/lib/prisma.js';
import { surveyTemplateContentSchema } from '../src/modules/surveys/schema.js';

interface ExtractedQuestion {
  prompt: string;
  type: 'yes_no_partial' | 'number' | 'text' | 'select';
  category: string | null;
  hint: string | null;
  options: string[] | null;
  severityMap: Record<string, 'ok' | 'warn' | 'bad'> | null;
  evidenceType: 'PHYSICAL' | 'REMOTE_TECH' | 'DOC_REVIEW' | 'HYBRID' | 'CUSTOM';
  defaultWeight: number;
}

function dedupeKey(q: ExtractedQuestion): string {
  return `${q.prompt}|${q.type}|${q.evidenceType}`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '─── APPLY mode ───' : '─── DRY RUN (use --apply to write) ───');

  const templates = await prisma.surveyTemplate.findMany({
    where: { tenantId: null },
  });
  console.log(`Found ${templates.length} system templates`);

  const extracted = new Map<string, ExtractedQuestion>();

  for (const t of templates) {
    const parsed = surveyTemplateContentSchema.safeParse(t.schema);
    if (!parsed.success) {
      console.warn(`  ⚠ template ${t.name} has invalid schema; skipping`);
      continue;
    }
    for (const q of parsed.data.questions) {
      const ext: ExtractedQuestion = {
        prompt: q.prompt,
        type: q.type,
        category: q.category ?? null,
        hint: q.hint ?? null,
        options: q.options ?? null,
        severityMap: q.severityMap ?? null,
        evidenceType: t.surveyType,
        defaultWeight: q.weight ?? 1,
      };
      const key = dedupeKey(ext);
      if (!extracted.has(key)) {
        extracted.set(key, ext);
      }
    }
  }
  console.log(`Extracted ${extracted.size} unique questions`);

  let created = 0;
  let skipped = 0;
  for (const q of extracted.values()) {
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
    if (existing) {
      skipped += 1;
      continue;
    }
    if (!apply) {
      console.log(`  + would create: [${q.evidenceType}] ${q.prompt.slice(0, 60)}…`);
      created += 1;
      continue;
    }
    await prisma.surveyQuestion.create({
      data: {
        tenantId: null,
        isSystem: true,
        prompt: q.prompt,
        category: q.category,
        hint: q.hint,
        type: q.type,
        options: q.options ?? undefined,
        severityMap: q.severityMap ?? undefined,
        evidenceType: q.evidenceType,
        defaultWeight: q.defaultWeight,
      },
    });
    created += 1;
  }

  console.log('');
  console.log(`Created: ${created}`);
  console.log(`Skipped (already in library): ${skipped}`);
  await prisma.$disconnect();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
