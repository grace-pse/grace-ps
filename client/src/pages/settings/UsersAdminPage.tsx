import { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, KeyRound, UserMinus, UserPlus, Copy, Check } from 'lucide-react';
import { Card } from '../../components/hifi/Card';
import { Btn2 } from '../../components/hifi/Btn2';
import { Pill } from '../../components/hifi/Pill';
import { Avatar } from '../../components/hifi/Avatar';
import { UserInviteDrawer } from './UserInviteDrawer';
import { usersApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import { useAuthStore, type Role } from '../../stores/auth';
import type { UserSummary } from '../../lib/csmp-types';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN',         label: 'Admin' },
  { value: 'LEAD_ASSESSOR', label: 'Lead assessor' },
  { value: 'ASSESSOR',      label: 'Assessor' },
  { value: 'REVIEWER',      label: 'Reviewer' },
  { value: 'STAKEHOLDER',   label: 'Stakeholder' },
];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  LEAD_ASSESSOR: 'Lead',
  ASSESSOR: 'Assessor',
  REVIEWER: 'Reviewer',
  STAKEHOLDER: 'Stakeholder',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function UsersAdminPage() {
  const me = useAuthStore((s) => s.user);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserSummary | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.list();
      setUsers(res.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && !u.isActive) return false;
      if (statusFilter === 'INACTIVE' && u.isActive) return false;
      if (q) {
        const hay = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  async function handleRoleChange(u: UserSummary, next: Role) {
    if (next === u.role) return;
    if (!window.confirm(`Change ${u.firstName} ${u.lastName}'s role from ${u.role} to ${next}?`)) return;
    try {
      await usersApi.changeRole(u.id, next);
      void refresh();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleDeactivate(u: UserSummary) {
    if (!window.confirm(`Deactivate ${u.firstName} ${u.lastName}? They will no longer be able to sign in.`)) return;
    try {
      await usersApi.deactivate(u.id);
      void refresh();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleReactivate(u: UserSummary) {
    try {
      await usersApi.reactivate(u.id);
      void refresh();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleResetPassword(u: UserSummary) {
    if (!window.confirm(`Issue a temporary password for ${u.firstName} ${u.lastName}? Their current password will stop working.`)) return;
    try {
      const res = await usersApi.resetPassword(u.id);
      setResetTarget(u);
      setResetPassword(res.tempPassword);
      setResetCopied(false);
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function copyResetPassword() {
    if (!resetPassword) return;
    try {
      await navigator.clipboard.writeText(resetPassword);
      setResetCopied(true);
      setTimeout(() => setResetCopied(false), 2000);
    } catch {/* noop */}
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-n-900">Users</h2>
          <p className="text-[12.5px] text-n-600 mt-1">
            Invite, deactivate, and change roles for users in your organization.
          </p>
        </div>
        <Btn2 leading={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setInviteOpen(true)}>
          Invite user
        </Btn2>
      </div>

      <Card className="p-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-n-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="h-8 w-[260px] pl-7 pr-2 border border-n-200 rounded-r2 text-[12.5px]"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')}
            className="h-8 px-2 border border-n-200 rounded-r2 text-[12.5px] bg-white"
          >
            <option value="ALL">All roles</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="h-8 px-2 border border-n-200 rounded-r2 text-[12.5px] bg-white"
          >
            <option value="ALL">Any status</option>
            <option value="ACTIVE">Active only</option>
            <option value="INACTIVE">Inactive only</option>
          </select>
          <span className="ml-auto text-[11px] text-n-500">
            {loading ? 'Loading…' : `${filtered.length} of ${users.length} users`}
          </span>
        </div>
      </Card>

      {error && (
        <div className="mb-3 text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-n-50 border-b border-n-150 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
            <tr>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Last login</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isMe = me?.id === u.id;
              return (
                <tr key={u.id} className="border-b border-n-100 last:border-b-0 hover:bg-n-50/40">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={`${u.firstName} ${u.lastName}`} size="sm" />
                      <div>
                        <div className="text-[12.5px] text-n-900 font-medium">
                          {u.firstName} {u.lastName}
                          {isMe && <span className="ml-2 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">you</span>}
                        </div>
                        <div className="text-[11px] text-n-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {isMe ? (
                      <span className="text-[12px] font-mono text-n-700">{ROLE_LABEL[u.role]}</span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                        className="h-7 px-1.5 border border-n-200 rounded-r1 text-[11.5px] bg-white"
                        disabled={!u.isActive}
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11.5px] text-n-700">{formatDate(u.lastLoginAt)}</td>
                  <td className="px-3 py-2">
                    {u.isActive
                      ? <Pill variant="ok">active</Pill>
                      : <Pill variant="default">inactive</Pill>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.isActive && (
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u)}
                          className="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-n-700 border border-n-200 rounded-r1 hover:bg-n-50"
                          title="Reset password (issues a temporary password)"
                        >
                          <KeyRound className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                      {!isMe && (u.isActive ? (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(u)}
                          className="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-bad border border-bad/30 rounded-r1 hover:bg-bad-bg"
                          title="Deactivate user"
                        >
                          <UserMinus className="w-3 h-3" />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(u)}
                          className="inline-flex items-center gap-1 h-7 px-2 text-[11px] text-ok border border-ok/30 rounded-r1 hover:bg-ok-bg"
                          title="Reactivate user"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reactivate
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[12px] text-n-500">
                  No users match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <UserInviteDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={() => { void refresh(); }}
      />

      {resetPassword && resetTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="bg-white rounded-r3 shadow-sh3 max-w-md w-full p-5">
            <div className="text-[14px] font-semibold text-n-900">Temporary password issued</div>
            <div className="text-[12px] text-n-600 mt-1">
              For <strong>{resetTarget.firstName} {resetTarget.lastName}</strong>. Share with them — it
              will not be shown again. Their previous password no longer works.
            </div>
            <div className="bg-n-75 border border-n-200 rounded-r2 p-3 flex items-center gap-2 mt-3">
              <code className="flex-1 text-[14px] font-mono text-n-900 break-all">{resetPassword}</code>
              <button
                type="button"
                onClick={copyResetPassword}
                className="inline-flex items-center gap-1 h-7 px-2 text-[11.5px] bg-a-500 text-white rounded-r1 hover:bg-a-600"
              >
                {resetCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {resetCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <Btn2 onClick={() => { setResetPassword(null); setResetTarget(null); }}>Done</Btn2>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
