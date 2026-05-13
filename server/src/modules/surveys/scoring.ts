// Survey scoring — uniform weighted score → SurveyRating band.
//
// Each question in the template carries a `weight` (1–5) and a `severityMap`
// that translates the given answer into one of { ok, warn, bad }. The score
// is the sum of per-question points divided by the theoretical max:
//   ok = weight, warn = weight * 0.5, bad = 0
// The resulting 0–100 percentage is bucketed into the SurveyRating enum.

import type { z } from 'zod';
import { surveyTemplateContentSchema } from './schema.js';

type SurveyRating = 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE';
type Severity = 'ok' | 'warn' | 'bad';

export type TemplateContent = z.infer<typeof surveyTemplateContentSchema>;

const NUMERIC_BAND_KEYS = ['BELOW_30', '30_TO_60', 'ABOVE_60'] as const;

function classifyAnswer(
  question: TemplateContent['questions'][number],
  raw: unknown,
): Severity | null {
  if (raw == null || raw === '') return null;
  if (!question.severityMap) return null;

  const coerce = String(raw).toUpperCase();

  if (question.type === 'yes_no_partial') {
    const key = coerce === 'YES' || coerce === 'NO' || coerce === 'PARTIAL' ? coerce : null;
    if (!key) return null;
    const sev = question.severityMap[key];
    return sev ?? null;
  }

  if (question.type === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const key = n < 30 ? 'BELOW_30' : n <= 60 ? '30_TO_60' : 'ABOVE_60';
    if (!NUMERIC_BAND_KEYS.includes(key as (typeof NUMERIC_BAND_KEYS)[number])) return null;
    return question.severityMap[key] ?? null;
  }

  // text / select: accept a direct match in severityMap keys
  return question.severityMap[coerce] ?? null;
}

function severityPoints(sev: Severity, weight: number): number {
  if (sev === 'ok') return weight;
  if (sev === 'warn') return weight * 0.5;
  return 0;
}

function percentToRating(pct: number): SurveyRating {
  if (pct >= 80) return 'STRONG';
  if (pct >= 60) return 'BASELINE';
  if (pct >= 40) return 'BARELY_ADEQUATE';
  return 'INADEQUATE';
}

export interface ScoreResult {
  scorePct: number | null;
  rating: SurveyRating | null;
  answeredCount: number;
  totalQuestions: number;
}

export function scoreSurveyResponse(
  template: TemplateContent,
  answers: Record<string, unknown>,
): ScoreResult {
  let earned = 0;
  let possible = 0;
  let answered = 0;
  for (const q of template.questions) {
    const weight = q.weight ?? 1;
    possible += weight;
    const raw =
      typeof answers[q.id] === 'object' && answers[q.id] !== null
        ? (answers[q.id] as { value?: unknown }).value
        : answers[q.id];
    const sev = classifyAnswer(q, raw);
    if (sev != null) {
      answered += 1;
      earned += severityPoints(sev, weight);
    }
  }
  if (answered === 0 || possible === 0) {
    return { scorePct: null, rating: null, answeredCount: 0, totalQuestions: template.questions.length };
  }
  const pct = (earned / possible) * 100;
  return {
    scorePct: Math.round(pct * 100) / 100,
    rating: percentToRating(pct),
    answeredCount: answered,
    totalQuestions: template.questions.length,
  };
}
