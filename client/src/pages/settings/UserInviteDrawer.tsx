import { useState, type FormEvent } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { Btn2 } from '../../components/hifi/Btn2';
import { usersApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import type { Role } from '../../stores/auth';

interface UserInviteDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN',         label: 'Admin' },
  { value: 'LEAD_ASSESSOR', label: 'Lead assessor' },
  { value: 'ASSESSOR',      label: 'Assessor' },
  { value: 'REVIEWER',      label: 'Reviewer' },
  { value: 'STAKEHOLDER',   label: 'Stakeholder' },
];

export function UserInviteDrawer({ open, onClose, onCreated }: UserInviteDrawerProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>('ASSESSOR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setEmail(''); setFirstName(''); setLastName(''); setRole('ASSESSOR');
    setError(null); setTempPassword(null); setCopied(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await usersApi.create({ email, firstName, lastName, role });
      setTempPassword(res.tempPassword);
      onCreated();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* noop */}
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={() => { reset(); onClose(); }} />
      <div className="w-[420px] bg-white shadow-sh3 flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-n-150">
          <div className="text-[14px] font-semibold text-n-900">Invite user</div>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="w-7 h-7 grid place-items-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tempPassword ? (
            <div>
              <div className="text-[12.5px] text-n-700 mb-1">User created. Share this temporary password — it will <strong>not</strong> be shown again.</div>
              <div className="bg-n-75 border border-n-200 rounded-r2 p-3 flex items-center gap-2">
                <code className="flex-1 text-[14px] font-mono text-n-900 break-all">{tempPassword}</code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="inline-flex items-center gap-1 h-7 px-2 text-[11.5px] bg-a-500 text-white rounded-r1 hover:bg-a-600"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <Btn2 variant="secondary" onClick={() => { reset(); }}>
                  Invite another
                </Btn2>
                <Btn2 onClick={() => { reset(); onClose(); }}>Done</Btn2>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Email" value={email} onChange={setEmail} type="email" required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" value={firstName} onChange={setFirstName} required />
                <Field label="Last name" value={lastName} onChange={setLastName} required />
              </div>
              <label className="block">
                <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">Role</div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full h-8 px-2.5 border border-n-200 rounded-r2 text-[12.5px] bg-white"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              {error && (
                <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">{error}</div>
              )}

              <div className="text-[11px] text-n-500">
                The server generates a temporary password. Email/SMTP integration is not yet wired —
                you must share the password manually.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Btn2 type="button" variant="secondary" onClick={() => { reset(); onClose(); }}>
                  Cancel
                </Btn2>
                <Btn2 type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create user'}
                </Btn2>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">{props.label}</div>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required={props.required}
        className="w-full h-8 px-2.5 border border-n-200 rounded-r2 text-[12.5px] bg-white focus:border-a-400 focus:ring-2 focus:ring-a-100 outline-none transition"
      />
    </label>
  );
}
