import { useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { useAuthStore, type Role } from '../../stores/auth';
import { useSandboxStore } from '../../stores/sandbox';
import { extractError } from '../../lib/api';

const ROLES: Array<{ value: Role; label: string; hint: string }> = [
  { value: 'ADMIN', label: 'Admin', hint: 'full access — owner / SecOps lead' },
  { value: 'LEAD_ASSESSOR', label: 'Lead assessor', hint: 'plan + review assessments' },
  { value: 'ASSESSOR', label: 'Assessor', hint: 'run assessments' },
  { value: 'REVIEWER', label: 'Reviewer', hint: 'approve / reject only' },
  { value: 'STAKEHOLDER', label: 'Stakeholder', hint: 'read-only viewer' },
];

export function RoleSwitcher() {
  const currentRole = useAuthStore((s) => s.user?.role);
  const switchRole = useSandboxStore((s) => s.switchRole);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(role: Role) {
    if (busy || role === currentRole) {
      setOpen(false);
      return;
    }
    setBusy(role);
    setError(null);
    try {
      await switchRole(role);
      // Hard reload guarantees all cached data is refetched under the new role.
      // The new JWT is already in the auth store and will be sent on next load.
      window.location.assign('/');
    } catch (err) {
      setError(await extractError(err));
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 h-7 rounded-r1 text-[11.5px] font-medium text-n-700 hover:bg-n-100"
        title="Switch demo role"
      >
        <Users className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{currentRole ?? 'Role'}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-8 z-40 w-72 bg-white border border-n-150 rounded-r2 shadow-sh3 overflow-hidden">
            <div className="px-3 py-2 border-b border-n-150 bg-n-50">
              <div className="text-[10.5px] font-mono uppercase tracking-[0.6px] text-a-600">
                Demo role switcher
              </div>
              <p className="text-[10.5px] text-n-500 mt-0.5">
                Reissues a JWT for the matching seeded user. RBAC is enforced
                server-side.
              </p>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {ROLES.map((r) => (
                <li key={r.value}>
                  <button
                    type="button"
                    onClick={() => handlePick(r.value)}
                    disabled={busy !== null}
                    className={[
                      'w-full text-left px-3 py-2 hover:bg-n-50 disabled:opacity-50 flex items-start gap-2',
                      currentRole === r.value ? 'bg-a-50' : '',
                    ].join(' ')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-n-900">
                        {r.label}
                        {currentRole === r.value ? (
                          <span className="ml-1.5 text-[10px] font-mono uppercase tracking-[0.6px] text-a-600">
                            current
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-n-500 truncate">{r.hint}</div>
                    </div>
                    {busy === r.value ? (
                      <span className="text-[10px] text-n-500 font-mono">…</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            {error ? (
              <div className="px-3 py-2 text-[11px] text-bad bg-bad/10 border-t border-bad/20">
                {error}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
