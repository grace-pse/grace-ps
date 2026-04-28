import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { Card } from '../../components/hifi/Card';
import { Pill } from '../../components/hifi/Pill';
import {
  ROLE_PERMISSION_MATRIX,
  ALL_PERMISSIONS,
  ALL_ROLES,
  type Permission,
} from '../../lib/permissions';
import type { Role } from '../../stores/auth';

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  LEAD_ASSESSOR: 'Lead',
  ASSESSOR: 'Assessor',
  REVIEWER: 'Reviewer',
  STAKEHOLDER: 'Stakeholder',
};

function groupPermissions(perms: Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {};
  for (const p of perms) {
    const [resource] = p.split(':');
    (groups[resource] ??= []).push(p);
  }
  return groups;
}

export function RolesPage() {
  const grouped = groupPermissions(ALL_PERMISSIONS);

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-[16px] font-semibold text-n-900">Roles &amp; permissions</h2>
          <p className="text-[12.5px] text-n-600 mt-1">
            Read-only matrix of the {ALL_PERMISSIONS.length} permissions across the {ALL_ROLES.length} fixed roles.
          </p>
        </div>
        <Pill variant="info">Custom roles coming in Phase 3</Pill>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-n-50 border-b border-n-150">
            <tr>
              <th className="text-left px-3 py-2 font-mono uppercase text-[10px] tracking-[0.4px] text-n-500">
                Permission
              </th>
              {ALL_ROLES.map((r) => (
                <th
                  key={r}
                  className="px-3 py-2 font-mono uppercase text-[10px] tracking-[0.4px] text-n-500 text-center"
                >
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([group, perms]) => (
              <Fragment key={`g-${group}`}>
                <tr className="bg-n-75/50 border-t border-n-100">
                  <td colSpan={1 + ALL_ROLES.length} className="px-3 py-1 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                    {group}
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p} className="border-t border-n-100">
                    <td className="px-3 py-1.5 font-mono text-n-800">{p}</td>
                    {ALL_ROLES.map((r) => {
                      const has = ROLE_PERMISSION_MATRIX[r].includes(p);
                      return (
                        <td key={r} className="text-center py-1.5">
                          {has ? (
                            <Check className="inline-block w-3.5 h-3.5 text-a-700" />
                          ) : (
                            <span className="text-n-300">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
