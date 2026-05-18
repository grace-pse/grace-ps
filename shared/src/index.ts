export type Role = 'ADMIN' | 'LEAD_ASSESSOR' | 'ASSESSOR' | 'REVIEWER' | 'STAKEHOLDER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  organization: Organization;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  db: 'ok' | 'down';
  uptime: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  organizationSlug: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ApiError {
  error: string;
}

// Compliance framework tags (app-layer enum — stored as TEXT[] in DB so we
// can extend the list without a schema migration).
export type ComplianceTag =
  | 'ISO_31000'
  | 'NIS2_ART_21'
  | 'NIS2_ART_23'
  | 'CER'
  | 'ASIS_SPC_1'
  | 'ISO_28000';

export const COMPLIANCE_TAGS: readonly ComplianceTag[] = [
  'ISO_31000',
  'NIS2_ART_21',
  'NIS2_ART_23',
  'CER',
  'ASIS_SPC_1',
  'ISO_28000',
] as const;

export const COMPLIANCE_TAG_LABEL: Record<ComplianceTag, string> = {
  ISO_31000: 'ISO 31000',
  NIS2_ART_21: 'NIS2 Art. 21',
  NIS2_ART_23: 'NIS2 Art. 23',
  CER: 'CER Directive',
  ASIS_SPC_1: 'ASIS SPC.1',
  ISO_28000: 'ISO 28000',
};

export function isComplianceTag(v: unknown): v is ComplianceTag {
  return typeof v === 'string' && (COMPLIANCE_TAGS as readonly string[]).includes(v);
}

export type RiskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';

export interface Recommendation {
  id: string;
  assessmentId: string;
  ref: string;
  priority: RiskPriority;
  title: string;
  body: string;
  owner: string | null;
  horizon: string | null;
  cost: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationInput {
  ref?: string;
  priority: RiskPriority;
  title: string;
  body: string;
  owner?: string | null;
  horizon?: string | null;
  cost?: string | null;
  sortOrder?: number;
}

export * from './templates/export.js';
