// P3 — drift detection between two successive SUBMITTED/APPROVED survey
// responses for the same (clusterId, templateId). Pure function,
// no I/O. Caller fetches the rows and template, we classify the change.

import type { SurveyRating } from '@prisma/client';
import type { TemplateContent } from './scoring.js';

export type DiffSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface SurveyDiffEntry {
  questionId: string;
  prompt: string;
  from: unknown;
  to: unknown;
  severity: DiffSeverity;
  reason: string;
}

interface MinimalResponse {
  answers: Record<string, unknown>;
  scorePct: number | null;
  rating: SurveyRating | null;
}

const RATING_ORDER: Record<SurveyRating, number> = {
  STRONG: 4,
  BASELINE: 3,
  BARELY_ADEQUATE: 2,
  INADEQUATE: 1,
};

const SEVERITY_WEIGHT: Record<DiffSeverity, number> = { INFO: 0, WARN: 1, CRITICAL: 2 };

function readRaw(answers: Record<string, unknown>, id: string): unknown {
  const v = answers[id];
  if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    return (v as { value?: unknown }).value;
  }
  return v;
}

function classifyYesNoPartialChange(
  prev: unknown,
  curr: unknown,
  severityMap: Record<string, 'ok' | 'warn' | 'bad'> | undefined,
): DiffSeverity {
  const a = prev == null ? null : String(prev).toUpperCase();
  const b = curr == null ? null : String(curr).toUpperCase();
  const sevPrev = a && severityMap ? severityMap[a] : undefined;
  const sevCurr = b && severityMap ? severityMap[b] : undefined;
  if (sevPrev === 'ok' && sevCurr === 'bad') return 'CRITICAL';
  if (sevPrev === 'ok' && sevCurr === 'warn') return 'WARN';
  if (sevPrev === 'warn' && sevCurr === 'bad') return 'WARN';
  if (sevPrev === 'bad' && (sevCurr === 'ok' || sevCurr === 'warn')) return 'INFO';
  if (sevPrev === 'warn' && sevCurr === 'ok') return 'INFO';
  return 'INFO';
}

function classifyNumberChange(prev: unknown, curr: unknown): DiffSeverity {
  const a = Number(prev);
  const b = Number(curr);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return 'INFO';
  const delta = (b - a) / a;
  if (delta <= -0.5) return 'CRITICAL';
  if (delta <= -0.2) return 'WARN';
  return 'INFO';
}

function classifyGenericChange(prev: unknown, curr: unknown): DiffSeverity {
  if (prev === curr) return 'INFO';
  return 'INFO';
}

export function diffSurveyResponses(
  template: TemplateContent,
  previous: MinimalResponse,
  current: MinimalResponse,
): SurveyDiffEntry[] {
  const entries: SurveyDiffEntry[] = [];

  for (const q of template.questions) {
    const prev = readRaw(previous.answers, q.id);
    const curr = readRaw(current.answers, q.id);
    const prevEmpty = prev == null || prev === '';
    const currEmpty = curr == null || curr === '';
    if (prevEmpty && currEmpty) continue;

    // Structural equality — normalise strings case-insensitively for
    // yes_no_partial so "YES" vs "yes" is a no-change.
    if (q.type === 'yes_no_partial') {
      if (String(prev ?? '').toUpperCase() === String(curr ?? '').toUpperCase()) continue;
    } else if (JSON.stringify(prev) === JSON.stringify(curr)) {
      continue;
    }

    let severity: DiffSeverity = 'INFO';
    let reason = 'answer changed';

    if (q.type === 'yes_no_partial') {
      severity = classifyYesNoPartialChange(prev, curr, q.severityMap);
      reason = `${String(prev ?? '-')} → ${String(curr ?? '-')}`;
    } else if (q.type === 'number') {
      severity = classifyNumberChange(prev, curr);
      reason = `${prev ?? '-'} → ${curr ?? '-'}`;
    } else {
      severity = classifyGenericChange(prev, curr);
      reason = 'answer changed';
    }

    entries.push({
      questionId: q.id,
      prompt: q.prompt,
      from: prev ?? null,
      to: curr ?? null,
      severity,
      reason,
    });
  }

  // Rating-band drop bumps overall at least one WARN (unless we already
  // have a CRITICAL).
  if (previous.rating && current.rating) {
    const prevRank = RATING_ORDER[previous.rating];
    const currRank = RATING_ORDER[current.rating];
    if (currRank < prevRank) {
      const topSeverity = entries.reduce<DiffSeverity>(
        (acc, e) => (SEVERITY_WEIGHT[e.severity] > SEVERITY_WEIGHT[acc] ? e.severity : acc),
        'INFO',
      );
      if (SEVERITY_WEIGHT[topSeverity] < SEVERITY_WEIGHT.WARN) {
        entries.push({
          questionId: '__rating__',
          prompt: 'Overall rating',
          from: previous.rating,
          to: current.rating,
          severity: 'WARN',
          reason: `${previous.rating} → ${current.rating}`,
        });
      }
    }
  }

  return entries;
}

export function topSeverity(entries: SurveyDiffEntry[]): DiffSeverity {
  return entries.reduce<DiffSeverity>(
    (acc, e) => (SEVERITY_WEIGHT[e.severity] > SEVERITY_WEIGHT[acc] ? e.severity : acc),
    'INFO',
  );
}
