import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { adminTemplatesApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import { downloadJson } from '../../lib/download';
import {
  ADVERSARY_TYPES, ACTION_TYPES, ASSET_TYPES,
  type AdversaryType, type ActionType,
  type AdminThreatTemplate, type AdminThreatTemplateCreateInput, type AdminModuleDetail,
} from '../../lib/csmp-types';
import { AttributesJsonEditor } from './AttributesJsonEditor';
import { JunctionEditor } from './JunctionEditor';

type Mode =
  | { kind: 'create'; moduleId: string; locked: boolean }
  | { kind: 'edit'; moduleId: string; threatTemplate: AdminThreatTemplate; locked: boolean };

interface Props {
  mode: Mode;
  module: AdminModuleDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ThreatTemplateDrawer({ mode, module, onClose, onSaved }: Props) {
  const initial = mode.kind === 'edit'
    ? {
        slug: mode.threatTemplate.slug,
        scenarioName: mode.threatTemplate.scenarioName,
        adversaryType: mode.threatTemplate.adversaryType,
        actionType: mode.threatTemplate.actionType,
        typicalActions: mode.threatTemplate.typicalActions.join(', '),
        targetAssetTypes: mode.threatTemplate.targetAssetTypes,
        indicators: mode.threatTemplate.indicators.join(', '),
        suggestedLikelihood: mode.threatTemplate.suggestedLikelihood,
        csmpUnitReference: mode.threatTemplate.csmpUnitReference ?? '',
        attributes: mode.threatTemplate.attributes,
      }
    : {
        slug: '',
        scenarioName: '',
        adversaryType: 'CRIMINAL' as AdversaryType,
        actionType: 'THEFT' as ActionType,
        typicalActions: '',
        targetAssetTypes: [] as string[],
        indicators: '',
        suggestedLikelihood: null as number | null,
        csmpUnitReference: '',
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
      const payload: AdminThreatTemplateCreateInput = {
        slug: form.slug.trim(),
        scenarioName: form.scenarioName.trim(),
        adversaryType: form.adversaryType,
        actionType: form.actionType,
        typicalActions: form.typicalActions.split(',').map((t) => t.trim()).filter(Boolean),
        targetAssetTypes: form.targetAssetTypes,
        indicators: form.indicators.split(',').map((t) => t.trim()).filter(Boolean),
        suggestedLikelihood: form.suggestedLikelihood,
        csmpUnitReference: form.csmpUnitReference.trim() || null,
        attributes: form.attributes,
      };
      if (isEdit) {
        await adminTemplatesApi.updateThreatTemplate(mode.threatTemplate.id, payload);
      } else {
        await adminTemplatesApi.createThreatTemplate(mode.moduleId, payload);
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
    const env = await adminTemplatesApi.exportThreatTemplate(mode.threatTemplate.id);
    downloadJson(`${mode.threatTemplate.slug}.threat-template.json`, env);
  }

  function toggleAssetType(t: string) {
    setForm((f) => ({
      ...f,
      targetAssetTypes: f.targetAssetTypes.includes(t)
        ? f.targetAssetTypes.filter((x) => x !== t)
        : [...f.targetAssetTypes, t],
    }));
  }

  const cmLinkRows = isEdit
    ? module.threatCountermeasureLinks
        .filter((l) => l.threatTemplateId === mode.threatTemplate.id)
        .map((l) => {
          const c = module.countermeasureTemplates.find((x) => x.id === l.countermeasureTemplateId);
          return {
            targetId: l.countermeasureTemplateId,
            targetLabel: c?.name ?? '(missing)',
            relevance: l.relevance,
            rationale: l.rationale,
          };
        })
    : [];

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 h-full w-full max-w-[560px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col" role="dialog">
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-n-900">
              {isEdit ? 'Edit threat template' : 'New threat template'}
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
            <Field label="Scenario name">
              <input
                required
                value={form.scenarioName}
                onChange={(e) => setForm({ ...form, scenarioName: e.target.value })}
                disabled={locked}
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                maxLength={255}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adversary type">
                <select
                  value={form.adversaryType}
                  onChange={(e) => setForm({ ...form, adversaryType: e.target.value as AdversaryType })}
                  disabled={locked}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none disabled:bg-n-50"
                >
                  {ADVERSARY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Action type">
                <select
                  value={form.actionType}
                  onChange={(e) => setForm({ ...form, actionType: e.target.value as ActionType })}
                  disabled={locked}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none disabled:bg-n-50"
                >
                  {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Target asset types">
              <div className="flex flex-wrap gap-1">
                {ASSET_TYPES.map((t) => {
                  const on = form.targetAssetTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleAssetType(t)}
                      disabled={locked}
                      className={[
                        'h-7 px-2 text-[10.5px] font-mono rounded-r2 border',
                        on ? 'bg-a-500 text-white border-a-500' : 'bg-white text-n-700 border-n-200 hover:bg-n-75',
                      ].join(' ')}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Typical actions (comma-separated)">
              <input
                value={form.typicalActions}
                onChange={(e) => setForm({ ...form, typicalActions: e.target.value })}
                disabled={locked}
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
              />
            </Field>
            <Field label="Indicators (comma-separated)">
              <input
                value={form.indicators}
                onChange={(e) => setForm({ ...form, indicators: e.target.value })}
                disabled={locked}
                className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Suggested likelihood (1-5)">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.suggestedLikelihood ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    suggestedLikelihood: e.target.value === '' ? null : Number(e.target.value),
                  })}
                  disabled={locked}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                />
              </Field>
              <Field label="CSMP unit reference">
                <input
                  value={form.csmpUnitReference}
                  onChange={(e) => setForm({ ...form, csmpUnitReference: e.target.value })}
                  disabled={locked}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 font-mono focus:border-a-500 focus:outline-none disabled:bg-n-50"
                  maxLength={50}
                />
              </Field>
            </div>
            <Field label="Custom attributes">
              <AttributesJsonEditor
                value={form.attributes}
                onChange={(next) => setForm((f) => ({ ...f, attributes: next }))}
              />
            </Field>

            {isEdit && !locked && (
              <JunctionEditor
                title="Linked countermeasures"
                rows={cmLinkRows}
                candidates={module.countermeasureTemplates.map((c) => ({ id: c.id, label: c.name }))}
                onAttach={async (targetId, relevance, rationale) => {
                  await adminTemplatesApi.upsertThreatCountermeasureLink(mode.threatTemplate.id, targetId, { relevance, rationale });
                  await onSaved();
                }}
                onUpdate={async (targetId, relevance, rationale) => {
                  await adminTemplatesApi.upsertThreatCountermeasureLink(mode.threatTemplate.id, targetId, { relevance, rationale });
                  await onSaved();
                }}
                onDetach={async (targetId) => {
                  await adminTemplatesApi.removeThreatCountermeasureLink(mode.threatTemplate.id, targetId);
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
            <Btn2 type="submit" variant="primary" disabled={saving || locked || !form.scenarioName.trim() || !form.slug.trim()}>
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
