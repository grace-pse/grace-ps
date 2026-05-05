import type { Role } from './rbac.js';

export function isSandbox(): boolean {
  return process.env.SANDBOX_MODE === 'true';
}

export const DEMO_USER_BY_ROLE: Record<Role, string> = {
  ADMIN: 'admin@nordica.demo',
  LEAD_ASSESSOR: 'lead@nordica.demo',
  ASSESSOR: 'assessor@nordica.demo',
  REVIEWER: 'reviewer@nordica.demo',
  STAKEHOLDER: 'stakeholder@nordica.demo',
};

export const DEMO_ORG_SLUG = 'nordica';

export const SANDBOX_ROW_CAPS = {
  Asset: 500,
  Assessment: 50,
  AssetCluster: 50,
  Countermeasure: 200,
  ActionPlan: 200,
  Threat: 500,
  SurveyResponse: 200,
} as const;

export type SandboxCappedModel = keyof typeof SANDBOX_ROW_CAPS;
