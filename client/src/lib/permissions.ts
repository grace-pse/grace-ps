// Client-side mirror of server/src/lib/rbac.ts — used for UI gating only.
// Server still enforces permissions authoritatively.

import type { Role } from '../stores/auth';

export type Permission =
  | 'assets:read'
  | 'assets:write'
  | 'assets:delete'
  | 'assessments:read'
  | 'assessments:write'
  | 'assessments:review'
  | 'assessments:approve'
  | 'assessments:link_survey'
  | 'countermeasures:read'
  | 'countermeasures:write'
  | 'incidents:read'
  | 'incidents:write'
  | 'templates:read'
  | 'templates:apply'
  | 'templates:manage'
  | 'surveys:read'
  | 'surveys:write'
  | 'surveys:admin'
  | 'surveys:schedule'
  | 'notifications:read'
  | 'users:manage'
  | 'org:manage';

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    'assets:read', 'assets:write', 'assets:delete',
    'assessments:read', 'assessments:write', 'assessments:review', 'assessments:approve', 'assessments:link_survey',
    'countermeasures:read', 'countermeasures:write',
    'incidents:read', 'incidents:write',
    'templates:read', 'templates:apply', 'templates:manage',
    'surveys:read', 'surveys:write', 'surveys:admin', 'surveys:schedule',
    'notifications:read',
    'users:manage', 'org:manage',
  ],
  LEAD_ASSESSOR: [
    'assets:read', 'assets:write',
    'assessments:read', 'assessments:write', 'assessments:review', 'assessments:link_survey',
    'countermeasures:read', 'countermeasures:write',
    'incidents:read', 'incidents:write',
    'templates:read', 'templates:apply',
    'surveys:read', 'surveys:write', 'surveys:schedule',
    'notifications:read',
  ],
  ASSESSOR: [
    'assets:read', 'assets:write',
    'assessments:read', 'assessments:write', 'assessments:link_survey',
    'countermeasures:read', 'countermeasures:write',
    'incidents:read', 'incidents:write',
    'templates:read',
    'surveys:read', 'surveys:write',
    'notifications:read',
  ],
  REVIEWER: [
    'assets:read',
    'assessments:read', 'assessments:review', 'assessments:approve',
    'countermeasures:read',
    'incidents:read',
    'templates:read',
    'surveys:read',
    'notifications:read',
  ],
  STAKEHOLDER: [
    'assets:read',
    'assessments:read',
    'countermeasures:read',
    'incidents:read',
    'templates:read',
    'surveys:read',
    'notifications:read',
  ],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(permission) ?? false;
}
