import type { FastifyRequest, FastifyReply } from 'fastify';

export type Role = 'ADMIN' | 'LEAD_ASSESSOR' | 'ASSESSOR' | 'REVIEWER' | 'STAKEHOLDER';

export type Permission =
  | 'assets:read'
  | 'assets:write'
  | 'assets:delete'
  | 'assessments:read'
  | 'assessments:write'
  | 'assessments:review'
  | 'assessments:approve'
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
  | 'assessments:link_survey'
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

export function hasPermission(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function requirePermission(permission: Permission) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { role?: Role } | undefined;
    if (!user?.role || !hasPermission(user.role, permission)) {
      return reply.code(403).send({ error: 'forbidden', required: permission });
    }
  };
}
