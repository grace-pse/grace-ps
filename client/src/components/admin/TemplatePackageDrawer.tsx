import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { adminTemplatesApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import { COMPLIANCE_TAGS } from '../../lib/csmp-types';
import type {
  AdminPackageWithTree, AdminPackageCreateInput,
} from '../../lib/csmp-types';

type Mode = { kind: 'create' } | { kind: 'edit'; pkg: AdminPackageWithTree };

interface Props {
  mode: Mode;
  onClose: () => void;
  onSaved: (pkg: AdminPackageWithTree) => void;
}

export function TemplatePackageDrawer({ mode, onClose, onSaved }: Props) {
  const initial = mode.kind === 'edit'
    ? {
        slug: mode.pkg.slug,
        name: mode.pkg.name,
        industry: mode.pkg.industry ?? '',
        version: mode.pkg.version,
        regionScope: mode.pkg.regionScope ?? '',
        description: mode.pkg.description ?? '',
        complianceRefs: mode.pkg.complianceRefs,
      }
    : {
        slug: '',
        name: '',
        industry: '',
        version: '1.0.0',
        regionScope: '',
        description: '',
        complianceRefs: [] as string[],
      };

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode.kind === 'edit';
  const locked = isEdit && mode.pkg.isSystem;

  useEffect(() => { setForm(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setSaving(true);
    setError(null);
    try {
      const payload: AdminPackageCreateInput = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        industry: form.industry.trim() || null,
        version: form.version.trim() || '1.0.0',
        regionScope: form.regionScope.trim() || null,
        description: form.description.trim() || null,
        complianceRefs: form.complianceRefs,
      };
      const saved = isEdit
        ? await adminTemplatesApi.updatePackage(mode.pkg.id, payload)
        : await adminTemplatesApi.createPackage(payload);
      onSaved(saved);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      complianceRefs: f.complianceRefs.includes(tag)
        ? f.complianceRefs.filter((t) => t !== tag)
        : [...f.complianceRefs, tag],
    }));
  }

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col"
        role="dialog"
        aria-labelledby="pkg-drawer-title"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150 shrink-0">
          <div>
            <h2 id="pkg-drawer-title" className="text-[15px] font-semibold text-n-900">
              {isEdit ? 'Edit package' : 'New package'}
            </h2>
            {locked && (
              <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
                System · read-only (fork to edit)
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <Field label="Slug">
              <input
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                disabled={isEdit || locked}
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 font-mono focus:border-a-500 focus:outline-none disabled:bg-n-50"
                placeholder="acme-datacenter"
                pattern="[a-z0-9][a-z0-9-]*"
                title="lower-kebab-case"
                maxLength={100}
              />
            </Field>
            <Field label="Name">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={locked}
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                maxLength={255}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Version">
                <input
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  disabled={locked}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 font-mono focus:border-a-500 focus:outline-none disabled:bg-n-50"
                  maxLength={20}
                />
              </Field>
              <Field label="Industry">
                <input
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  disabled={locked}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                  placeholder="Financial services"
                  maxLength={100}
                />
              </Field>
            </div>
            <Field label="Region scope">
              <input
                value={form.regionScope}
                onChange={(e) => setForm({ ...form, regionScope: e.target.value })}
                disabled={locked}
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                placeholder="EU, NA, APAC…"
                maxLength={100}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                disabled={locked}
                className="w-full min-h-[80px] px-2.5 py-1.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none resize-y disabled:bg-n-50"
              />
            </Field>
            <Field label="Compliance references">
              <div className="flex flex-wrap gap-1.5">
                {COMPLIANCE_TAGS.map((tag) => {
                  const on = form.complianceRefs.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      disabled={locked}
                      className={[
                        'h-7 px-2.5 text-[11.5px] rounded-r2 border',
                        on ? 'bg-a-500 text-white border-a-500' : 'bg-white text-n-700 border-n-200 hover:bg-n-75',
                      ].join(' ')}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </Field>
            {error && (
              <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
                {error}
              </div>
            )}
          </div>
          <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
            <Btn2 type="button" variant="ghost" onClick={onClose}>Cancel</Btn2>
            <Btn2 type="submit" variant="primary" disabled={saving || locked || !form.name.trim() || !form.slug.trim()}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create package'}
            </Btn2>
          </footer>
        </form>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
