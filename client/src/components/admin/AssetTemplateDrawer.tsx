import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { adminTemplatesApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import { downloadJson } from '../../lib/download';
import {
  ASSET_TYPES, ASSET_CATEGORIES,
  type AssetType, type AssetCategory,
  type AdminAssetTemplate, type AdminAssetTemplateCreateInput, type AdminModuleDetail,
} from '../../lib/csmp-types';
import { AttributesJsonEditor } from './AttributesJsonEditor';
import { JunctionEditor } from './JunctionEditor';

type Mode =
  | { kind: 'create'; moduleId: string; locked: boolean }
  | { kind: 'edit'; moduleId: string; assetTemplate: AdminAssetTemplate; locked: boolean };

interface Props {
  mode: Mode;
  module: AdminModuleDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function AssetTemplateDrawer({ mode, module, onClose, onSaved }: Props) {
  const initial = mode.kind === 'edit'
    ? {
        slug: mode.assetTemplate.slug,
        name: mode.assetTemplate.name,
        assetType: mode.assetTemplate.assetType,
        category: mode.assetTemplate.category,
        defaultCriticality: mode.assetTemplate.defaultCriticality,
        description: mode.assetTemplate.description ?? '',
        parentSlug: mode.assetTemplate.parentSlug ?? '',
        tags: mode.assetTemplate.tags.join(', '),
        attributes: mode.assetTemplate.attributes,
      }
    : {
        slug: '',
        name: '',
        assetType: 'EQUIPMENT' as AssetType,
        category: 'TANGIBLE' as AssetCategory,
        defaultCriticality: 3,
        description: '',
        parentSlug: '',
        tags: '',
        attributes: {} as Record<string, unknown>,
      };

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
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const payload: AdminAssetTemplateCreateInput = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        assetType: form.assetType,
        category: form.category,
        defaultCriticality: form.defaultCriticality,
        description: form.description.trim() || null,
        parentSlug: form.parentSlug.trim() || null,
        tags,
        attributes: form.attributes,
      };
      if (isEdit) {
        await adminTemplatesApi.updateAssetTemplate(mode.assetTemplate.id, payload);
      } else {
        await adminTemplatesApi.createAssetTemplate(mode.moduleId, payload);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    if (!isEdit) return;
    const env = await adminTemplatesApi.exportAssetTemplate(mode.assetTemplate.id);
    downloadJson(`${mode.assetTemplate.slug}.asset-template.json`, env);
  }

  // Junction candidates = threat templates in this module
  const threatLinkRows = isEdit
    ? module.assetThreatLinks
        .filter((l) => l.assetTemplateId === mode.assetTemplate.id)
        .map((l) => {
          const t = module.threatTemplates.find((x) => x.id === l.threatTemplateId);
          return {
            targetId: l.threatTemplateId,
            targetLabel: t?.scenarioName ?? '(missing)',
            relevance: l.relevance,
            rationale: l.rationale,
          };
        })
    : [];

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[560px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col"
        role="dialog"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-n-900">
              {isEdit ? 'Edit asset template' : 'New asset template'}
            </h2>
            {locked && (
              <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
                System · read-only
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEdit && (
              <button
                type="button"
                onClick={handleExport}
                className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
                aria-label="Export JSON"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
                maxLength={150}
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
              <Field label="Asset type">
                <select
                  value={form.assetType}
                  onChange={(e) => setForm({ ...form, assetType: e.target.value as AssetType })}
                  disabled={locked}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none disabled:bg-n-50"
                >
                  {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as AssetCategory })}
                  disabled={locked}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none disabled:bg-n-50"
                >
                  {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label={`Default criticality (${form.defaultCriticality})`}>
              <input
                type="range"
                min={1}
                max={5}
                value={form.defaultCriticality}
                onChange={(e) => setForm({ ...form, defaultCriticality: Number(e.target.value) })}
                disabled={locked}
                className="w-full mt-2"
              />
            </Field>
            <Field label="Parent slug (optional)">
              <input
                value={form.parentSlug}
                onChange={(e) => setForm({ ...form, parentSlug: e.target.value })}
                disabled={locked}
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 font-mono focus:border-a-500 focus:outline-none disabled:bg-n-50"
                placeholder="building-main"
                maxLength={150}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                disabled={locked}
                className="w-full min-h-[70px] px-2.5 py-1.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none resize-y disabled:bg-n-50"
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                disabled={locked}
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
              />
            </Field>
            <Field label="Custom attributes">
              <AttributesJsonEditor
                value={form.attributes}
                onChange={(next) => setForm((f) => ({ ...f, attributes: next }))}
              />
            </Field>

            {isEdit && !locked && (
              <JunctionEditor
                title="Linked threats"
                rows={threatLinkRows}
                candidates={module.threatTemplates.map((t) => ({ id: t.id, label: t.scenarioName }))}
                onAttach={async (targetId, relevance, rationale) => {
                  await adminTemplatesApi.upsertAssetThreatLink(mode.assetTemplate.id, targetId, { relevance, rationale });
                  await onSaved();
                }}
                onUpdate={async (targetId, relevance, rationale) => {
                  await adminTemplatesApi.upsertAssetThreatLink(mode.assetTemplate.id, targetId, { relevance, rationale });
                  await onSaved();
                }}
                onDetach={async (targetId) => {
                  await adminTemplatesApi.removeAssetThreatLink(mode.assetTemplate.id, targetId);
                  await onSaved();
                }}
              />
            )}

            {error && (
              <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">{error}</div>
            )}
          </div>
          <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
            <Btn2 type="button" variant="ghost" onClick={onClose}>Cancel</Btn2>
            <Btn2 type="submit" variant="primary" disabled={saving || locked || !form.name.trim() || !form.slug.trim()}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
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

