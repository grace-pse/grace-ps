import type { IrvBand, RiskPriority, VulnerabilityRating, TearStrategy, ActionStatus, AssessmentStatus, ReviewStatus } from './csmp-types';
import type { RiskLevel } from '../components/hifi/RiskBadge';

export const IRV_TO_LEVEL: Record<IrvBand, RiskLevel> = {
  NEGLIGIBLE: 'Negligible',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  EXTREME: 'Extreme',
};

export const PRIORITY_TO_LEVEL: Record<RiskPriority, RiskLevel> = {
  LOW: 'Low',
  MEDIUM: 'Moderate',
  HIGH: 'High',
  HIGHEST: 'Extreme',
};

export const VULN_LABEL: Record<VulnerabilityRating, string> = {
  STRONG: 'Strong',
  BASELINE: 'Baseline',
  BARELY_ADEQUATE: 'Barely adequate',
  INADEQUATE: 'Inadequate',
};

export const TEAR_LABEL: Record<TearStrategy, string> = {
  TRANSFER: 'Transfer',
  ELIMINATE: 'Eliminate',
  ACCEPT: 'Accept',
  REDUCE: 'Reduce',
};

export const TEAR_BLURB: Record<TearStrategy, string> = {
  TRANSFER: 'Shift the risk to a third party (insurance, outsourcing, shared liability).',
  ELIMINATE: 'Remove the asset, activity, or exposure so the threat no longer applies.',
  ACCEPT: 'Tolerate the residual risk; document ALARP rationale for leadership.',
  REDUCE: 'Apply controls to lower likelihood, impact, or vulnerability — drive the action plan.',
};

export const ACTION_STATUS_VARIANT: Record<ActionStatus, 'ok' | 'warn' | 'bad' | 'info' | 'default'> = {
  PENDING: 'default',
  IN_PROGRESS: 'info',
  COMPLETED: 'ok',
  OVERDUE: 'bad',
  CANCELLED: 'default',
};

export const REVIEW_STATUS_VARIANT: Record<ReviewStatus, 'ok' | 'warn' | 'bad' | 'info' | 'default'> = {
  PENDING: 'default',
  IN_REVIEW: 'info',
  APPROVED: 'ok',
  REJECTED: 'bad',
  REVISION_REQUESTED: 'warn',
};

export function statusLabel(s: AssessmentStatus): string {
  if (s === 'DRAFT' || s === 'REVIEW' || s === 'APPROVED' || s === 'ARCHIVED') {
    return s.charAt(0) + s.slice(1).toLowerCase();
  }
  return `Step ${s.match(/\d/)?.[0] ?? '?'}`;
}

export const STEP_LABELS: readonly string[] = [
  'Scope',
  'Threats',
  'Likelihood',
  'Impact',
  'IRV',
  'Vulnerability',
  'Treatment',
];

export const STEP_KICKERS: readonly string[] = [
  'Identify & scope',
  "3 A's · DBT",
  '1–5 scale',
  '5 dimensions',
  'IRV · Matrix 1',
  'Controls',
  'TEAR · priority',
];
