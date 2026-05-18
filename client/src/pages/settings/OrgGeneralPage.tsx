import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '../../components/hifi/Card';
import { Btn2 } from '../../components/hifi/Btn2';
import { Pill } from '../../components/hifi/Pill';
import { orgSettingsApi, orgApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { OrgSummary } from '../../lib/csmp-types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function OrgGeneralPage() {
  const refreshAuth = useAuthStore((s) => s.refresh);

  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await orgSettingsApi.get();
        if (cancelled) return;
        setOrg(res.organization);
        setName(res.organization.name);
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dirty = org !== null && name.trim() !== org.name && name.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await orgApi.patch({ name: name.trim() });
      setOrg((o) => (o ? { ...o, name: updated.name } : o));
      setSaved(true);
      // Refresh the auth store so the sidebar reflects the new name.
      void refreshAuth();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-[12.5px] text-n-500">Loading organization…</div>;
  }
  if (!org) {
    return (
      <div className="text-[12.5px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
        {error ?? 'Organization not available.'}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-[16px] font-semibold text-n-900">Organization</h2>
      <p className="text-[12.5px] text-n-600 mt-1 mb-4">
        Profile details for your GRACE workspace.
      </p>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Display name" value={name} onChange={setName} disabled={saving} />
          <ReadOnlyRow label="Slug" value={org.slug} note="Slug is permanent." />
          <ReadOnlyRow
            label="Subscription"
            value={<Pill variant="accent">{org.subscriptionTier}</Pill>}
          />
          <ReadOnlyRow label="Active members" value={String(org.memberCount)} />
          <ReadOnlyRow label="Created" value={formatDate(org.createdAt)} />

          {error && (
            <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            {!dirty && saved && <Pill variant="ok">Saved</Pill>}
            <Btn2 type="submit" disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Btn2>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">{props.label}</div>
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        className="w-full h-8 px-2.5 border border-n-200 rounded-r2 text-[12.5px] bg-white focus:border-a-400 focus:ring-2 focus:ring-a-100 outline-none transition disabled:bg-n-50"
      />
    </label>
  );
}

function ReadOnlyRow({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">{label}</div>
      <div className="text-[12.5px] text-n-800">{value}</div>
      {note && <div className="text-[10.5px] text-n-500 mt-0.5">{note}</div>}
    </div>
  );
}
