import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { adminTemplatesApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import type { AdminModuleDetail, AdminModuleCreateInput } from '../../lib/csmp-types';

type Mode =
  | { kind: 'create'; packageId: string; locked: boolean }
  | { kind: 'edit'; module: AdminModuleDetail; locked: boolean };

interface Props {
  mode: Mode;
  onClose: () => void;
  onSaved: (module: AdminModuleDetail) => void;
}

export function TemplateModuleDrawer({ mode, onClose, onSaved }: Props) {
  const initial = mode.kind === 'edit'
    ? {
        slug: mode.module.slug,
        name: mode.module.name,
        description: mode.module.description ?? '',
        icon: mode.module.icon ?? '',
        sortOrder: mode.module.sortOrder,
      }
    : { slug: '', name: '', description: '', icon: '', sortOrder: 0 };

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode.kind === 'edit';
  const locked = mode.locked;

  useEffect(() => { setForm(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setSaving(true);
    setError(null);
    try {
      const payload: AdminModuleCreateInput = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        icon: form.icon.trim() || null,
        sortOrder: form.sortOrder,
      };
      const saved = isEdit
        ? await adminTemplatesApi.updateModule(mode.module.id, payload)
        : await adminTemplatesApi.createModule(mode.packageId, payload);
      onSaved(saved);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col"
        role="dialog"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-n-900">
              {isEdit ? 'Edit module' : 'New module'}
            </h2>
            {locked && (
              <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
                System · read-only
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
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
                pattern="[a-z0-9][a-z0-9-]*"
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
              <Field label="Icon (lucide name)">
                <input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  disabled={locked}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 font-mono focus:border-a-500 focus:outline-none disabled:bg-n-50"
                  placeholder="shield, building-2…"
                  maxLength={50}
                />
              </Field>
              <Field label="Sort order">
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  disabled={locked}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                disabled={locked}
                className="w-full min-h-[80px] px-2.5 py-1.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none resize-y disabled:bg-n-50"
              />
            </Field>
            {error && (
              <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">{error}</div>
            )}
          </div>
          <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
            <Btn2 type="button" variant="ghost" onClick={onClose}>Cancel</Btn2>
            <Btn2 type="submit" variant="primary" disabled={saving || locked || !form.name.trim() || !form.slug.trim()}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create module'}
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
      <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">{label}</div>
      {children}
    </label>
  );
}
