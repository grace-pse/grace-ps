import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { adminTemplatesApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import { downloadJson } from '../../lib/download';
import {
  SHAPE_CATEGORIES, PPS_FUNCTIONS, PROTECTION_DOMAINS,
  TEAR_STRATEGIES, VULNERABILITY_RATINGS,
  type ShapeCategory, type PpsFunction, type ProtectionDomain,
  type TearStrategy, type VulnerabilityRating,
  type AdminCountermeasureTemplate, type AdminCountermeasureTemplateCreateInput,
} from '../../lib/csmp-types';
import { AttributesJsonEditor } from './AttributesJsonEditor';

type Mode =
  | { kind: 'create'; moduleId: string; locked: boolean }
  | { kind: 'edit'; moduleId: string; cmTemplate: AdminCountermeasureTemplate; locked: boolean };

interface Props {
  mode: Mode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function CountermeasureTemplateDrawer({ mode, onClose, onSaved }: Props) {
  const initial = mode.kind === 'edit'
    ? {
        slug: mode.cmTemplate.slug,
        name: mode.cmTemplate.name,
        description: mode.cmTemplate.description ?? '',
        shapeCategory: mode.cmTemplate.shapeCategory,
        ppsFunctions: mode.cmTemplate.ppsFunctions,
        domain: mode.cmTemplate.domain,
        defaultTearStrategy: mode.cmTemplate.defaultTearStrategy,
        defaultEffectiveness: mode.cmTemplate.defaultEffectiveness,
        typicalCostEstimate: mode.cmTemplate.typicalCostEstimate,
        typicalAnnualCost: mode.cmTemplate.typicalAnnualCost,
        tags: mode.cmTemplate.tags.join(', '),
        csmpUnitReference: mode.cmTemplate.csmpUnitReference ?? '',
        attributes: mode.cmTemplate.attributes,
      }
    : {
        slug: '',
        name: '',
        description: '',
        shapeCategory: 'EQUIPMENT' as ShapeCategory,
        ppsFunctions: [] as PpsFunction[],
        domain: 'PERIMETER' as ProtectionDomain,
        defaultTearStrategy: null as TearStrategy | null,
        defaultEffectiveness: null as VulnerabilityRating | null,
        typicalCostEstimate: null as number | null,
        typicalAnnualCost: null as number | null,
        tags: '',
        csmpUnitReference: '',
        attributes: {} as Record<string, unknown>,
      };

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode.kind === 'edit';
  const locked = mode.locked;

  useEffect(() => { setForm(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode]);

  function togglePps(fn: PpsFunction) {
    setForm((f) => ({
      ...f,
      ppsFunctions: f.ppsFunctions.includes(fn)
        ? f.ppsFunctions.filter((x) => x !== fn)
        : [...f.ppsFunctions, fn],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setSaving(true);
    setError(null);
    try {
      const payload: AdminCountermeasureTemplateCreateInput = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        shapeCategory: form.shapeCategory,
        ppsFunctions: form.ppsFunctions,
        domain: form.domain,
        defaultTearStrategy: form.defaultTearStrategy,
        defaultEffectiveness: form.defaultEffectiveness,
        typicalCostEstimate: form.typicalCostEstimate,
        typicalAnnualCost: form.typicalAnnualCost,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        csmpUnitReference: form.csmpUnitReference.trim() || null,
        attributes: form.attributes,
      };
      if (isEdit) {
        await adminTemplatesApi.updateCountermeasureTemplate(mode.cmTemplate.id, payload);
      } else {
        await adminTemplatesApi.createCountermeasureTemplate(mode.moduleId, payload);
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
    const env = await adminTemplatesApi.exportCountermeasureTemplate(mode.cmTemplate.id);
    downloadJson(`${mode.cmTemplate.slug}.countermeasure-template.json`, env);
  }

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 h-full w-full max-w-[560px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col" role="dialog">
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-n-900">
              {isEdit ? 'Edit countermeasure template' : 'New countermeasure template'}
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
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                disabled={locked}
                className="w-full min-h-[70px] px-2.5 py-1.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none resize-y disabled:bg-n-50"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shape category">
                <select
                  value={form.shapeCategory}
                  onChange={(e) => setForm({ ...form, shapeCategory: e.target.value as ShapeCategory })}
                  disabled={locked}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none disabled:bg-n-50"
                >
                  {SHAPE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Protection domain">
                <select
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value as ProtectionDomain })}
                  disabled={locked}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none disabled:bg-n-50"
                >
                  {PROTECTION_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <Field label="PPS functions">
              <div className="flex flex-wrap gap-1">
                {PPS_FUNCTIONS.map((fn) => {
                  const on = form.ppsFunctions.includes(fn);
                  return (
                    <button
                      key={fn}
                      type="button"
                      onClick={() => togglePps(fn)}
                      disabled={locked}
                      className={[
                        'h-7 px-2 text-[11px] font-mono rounded-r2 border',
                        on ? 'bg-a-500 text-white border-a-500' : 'bg-white text-n-700 border-n-200 hover:bg-n-75',
                      ].join(' ')}
                    >
                      {fn}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default TEAR strategy">
                <select
                  value={form.defaultTearStrategy ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    defaultTearStrategy: (e.target.value || null) as TearStrategy | null,
                  })}
                  disabled={locked}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none disabled:bg-n-50"
                >
                  <option value="">—</option>
                  {TEAR_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Default effectiveness">
                <select
                  value={form.defaultEffectiveness ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    defaultEffectiveness: (e.target.value || null) as VulnerabilityRating | null,
                  })}
                  disabled={locked}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none disabled:bg-n-50"
                >
                  <option value="">—</option>
                  {VULNERABILITY_RATINGS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Typical cost estimate">
                <input
                  type="number"
                  step="0.01"
                  value={form.typicalCostEstimate ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    typicalCostEstimate: e.target.value === '' ? null : Number(e.target.value),
                  })}
                  disabled={locked}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                />
              </Field>
              <Field label="Typical annual cost">
                <input
                  type="number"
                  step="0.01"
                  value={form.typicalAnnualCost ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    typicalAnnualCost: e.target.value === '' ? null : Number(e.target.value),
                  })}
                  disabled={locked}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none disabled:bg-n-50"
                />
              </Field>
            </div>
            <Field label="Tags (comma-separated)">
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
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
                maxLength={64}
              />
            </Field>
            <Field label="Custom attributes">
              <AttributesJsonEditor
                value={form.attributes}
                onChange={(next) => setForm((f) => ({ ...f, attributes: next }))}
              />
            </Field>

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
