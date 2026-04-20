import type { IrvBand, RiskPriority, VulnerabilityRating, ActionStatus, AssessmentStatus, ReviewStatus } from './csmp-types';
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
