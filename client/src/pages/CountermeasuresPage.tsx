import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, X, BookTemplate } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { CountermeasureTemplatePickerDrawer } from '../components/CountermeasureTemplatePickerDrawer';
import { countermeasuresApi, assetsApi, assessmentsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  SHAPE_CATEGORIES, SHAPE_CATEGORY_LABEL, PPS_FUNCTIONS,
  PROTECTION_DOMAINS, IMPLEMENTATION_STATUSES, VULNERABILITY_RATINGS, TEAR_STRATEGIES,
  type CountermeasureSummary, type CountermeasureCreateInput,
  type CountermeasureTemplateDetail,
  type ShapeCategory, type PpsFunction, type ProtectionDomain, type ImplementationStatus,
  type VulnerabilityRating, type TearStrategy, type AssetSummary, type ThreatSummary,
  type AssessmentSummary,
} from '../lib/csmp-types';

type Modal =
  | { kind: 'none' }
  | { kind: 'create'; seed?: CountermeasureTemplateDetail }
  | { kind: 'edit'; item: CountermeasureSummary };

type Filters = {
  shapeCategory?: ShapeCategory;
  domain?: ProtectionDomain;
  implementationStatus?: ImplementationStatus;
};

const STATUS_VARIANT: Record<ImplementationStatus, 'warn' | 'info' | 'ok' | 'default'> = {
  PROPOSED: 'warn',
  APPROVED: 'info',
  IN_PROGRESS: 'info',
  IMPLEMENTED: 'ok',
  VERIFIED: 'ok',
  DECOMMISSIONED: 'default',
};

export function CountermeasuresPage() {
  const [items, setItems] = useState<CountermeasureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>({ kind: 'none' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await countermeasuresApi.list(filters);
      setItems(res.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(c: CountermeasureSummary) {
    if (!window.confirm(`Delete countermeasure "${c.name}"?`)) return;
    try {
      await countermeasuresApi.remove(c.id);
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  function handleSaved() {
    setModal({ kind: 'none' });
    void load();
  }

  return (
    <>
      <Topbar
        breadcrumbs={<span>Catalog / Countermeasures</span>}
        title="Countermeasures"
        subtitle={`${items.length} total · SHAPE + PPS + ALARP`}
        actions={
          <div className="flex items-center gap-2">
            <Btn2
              variant="ghost"
              leading={<BookTemplate className="w-3.5 h-3.5" />}
              onClick={() => setPickerOpen(true)}
            >
              From template
            </Btn2>
            <Btn2
              variant="primary"
              leading={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setModal({ kind: 'create' })}
            >
              New countermeasure
            </Btn2>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
          <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 bg-white border border-n-150 rounded-r3 shadow-sh1 p-3">
          <FilterSelect
            label="SHAPE"
            value={filters.shapeCategory ?? ''}
            options={SHAPE_CATEGORIES.map((s) => ({ value: s, label: SHAPE_CATEGORY_LABEL[s] }))}
            onChange={(v) => setFilters((f) => ({ ...f, shapeCategory: (v as ShapeCategory) || undefined }))}
          />
          <FilterSelect
            label="Domain"
            value={filters.domain ?? ''}
            options={PROTECTION_DOMAINS.map((s) => ({ value: s, label: s }))}
            onChange={(v) => setFilters((f) => ({ ...f, domain: (v as ProtectionDomain) || undefined }))}
          />
          <FilterSelect
            label="Status"
            value={filters.implementationStatus ?? ''}
            options={IMPLEMENTATION_STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            onChange={(v) => setFilters((f) => ({ ...f, implementationStatus: (v as ImplementationStatus) || undefined }))}
          />
          {(filters.shapeCategory || filters.domain || filters.implementationStatus) && (
            <button
              type="button"
              onClick={() => setFilters({})}
              className="text-[11.5px] text-n-500 hover:text-n-800 underline ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <div className="text-[13px] font-medium text-n-800 mb-1">No countermeasures</div>
            <div className="text-[12px] text-n-500 mb-4">
              Log SHAPE-classified controls with PPS functions, cost and ALARP rationale.
            </div>
            <Btn2
              variant="primary"
              leading={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setModal({ kind: 'create' })}
            >
              Add countermeasure
            </Btn2>
          </div>
        ) : (
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead className="bg-n-50 text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">SHAPE</th>
                  <th className="text-left px-4 py-2">PPS</th>
                  <th className="text-left px-4 py-2">Domain</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Assigned</th>
                  <th className="text-right px-4 py-2 w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t border-n-100 hover:bg-n-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-n-900">{c.name}</div>
                      {c.tearStrategy && (
                        <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-0.5">
                          TEAR · {c.tearStrategy}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill variant="accent">{SHAPE_CATEGORY_LABEL[c.shapeCategory]}</Pill>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.ppsFunctions.map((p) => (
                          <Pill key={p} variant="outline">{p}</Pill>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-n-700">{c.domain}</td>
                    <td className="px-4 py-2.5">
                      <Pill variant={STATUS_VARIANT[c.implementationStatus]}>
                        {c.implementationStatus.replace('_', ' ')}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5 text-[11.5px] text-n-600">
                      {c.assignedToAssetName && <div>Asset: {c.assignedToAssetName}</div>}
                      {c.assignedToThreatTitle && <div>Threat: {c.assignedToThreatTitle}</div>}
                      {!c.assignedToAssetName && !c.assignedToThreatTitle && (
                        <span className="text-n-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setModal({ kind: 'edit', item: c })}
                          className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 hover:text-n-800 rounded-r1"
                          aria-label={`Edit ${c.name}`}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                          aria-label={`Delete ${c.name}`}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.kind !== 'none' && (
        <CountermeasureModal
          mode={modal}
          onClose={() => setModal({ kind: 'none' })}
          onSaved={handleSaved}
        />
      )}

      {pickerOpen && (
        <CountermeasureTemplatePickerDrawer
          onClose={() => setPickerOpen(false)}
          onPick={(tpl) => {
            setPickerOpen(false);
            setModal({ kind: 'create', seed: tpl });
          }}
        />
      )}
    </>
  );
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11.5px] text-n-700">
      <span className="font-mono uppercase text-[10px] text-n-500 tracking-[0.4px]">{label}</span>
      <select
        className="h-7 border border-n-200 rounded-r1 px-2 text-[12px] bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ── Modal ──────────────────────────────────────────────────

type ThreatWithAssessment = ThreatSummary & { assessmentTitle?: string };

function CountermeasureModal({
  mode, onClose, onSaved,
}: {
  mode: { kind: 'create'; seed?: CountermeasureTemplateDetail } | { kind: 'edit'; item: CountermeasureSummary };
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = mode.kind === 'edit' ? mode.item : null;
  const seed = mode.kind === 'create' ? mode.seed : undefined;

  const [form, setForm] = useState<CountermeasureCreateInput>(() => ({
    name: editing?.name ?? seed?.name ?? '',
    description: seed?.description ?? '',
    shapeCategory: editing?.shapeCategory ?? seed?.shapeCategory ?? 'EQUIPMENT',
    ppsFunctions: editing?.ppsFunctions ?? seed?.ppsFunctions ?? ['DETER'],
    domain: editing?.domain ?? seed?.domain ?? 'PERIMETER',
    implementationStatus: editing?.implementationStatus ?? 'PROPOSED',
    effectivenessRating: editing?.effectivenessRating ?? seed?.defaultEffectiveness ?? null,
    tearStrategy: editing?.tearStrategy ?? seed?.defaultTearStrategy ?? null,
    costEstimate: editing?.costEstimate ?? seed?.typicalCostEstimate ?? null,
    annualCost: editing?.annualCost ?? seed?.typicalAnnualCost ?? null,
    assignedToAssetId: editing?.assignedToAssetId ?? null,
    assignedToThreatId: editing?.assignedToThreatId ?? null,
    alarpJustification: '',
    sourceTemplateId: seed?.id ?? null,
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [threats, setThreats] = useState<ThreatWithAssessment[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [a, aList] = await Promise.all([
          assetsApi.list({ pageSize: 500 }),
          assessmentsApi.list({ pageSize: 100 }),
        ]);
        setAssets(a.items);
        const assessmentItems: AssessmentSummary[] = aList.items;
        const allThreats: ThreatWithAssessment[] = [];
        for (const asm of assessmentItems) {
          try {
            const detail = await assessmentsApi.get(asm.id);
            detail.threats.forEach((t) => allThreats.push({ ...t, assessmentTitle: asm.title }));
          } catch { /* ignore individual fetch failures */ }
        }
        setThreats(allThreats);
      } catch {
        /* ignore — asset/threat pickers just show empty */
      }
    })();
    if (editing) {
      void countermeasuresApi.get(editing.id).then((d) => {
        setForm((f) => ({
          ...f,
          description: d.description ?? '',
          alarpJustification: d.alarpJustification ?? '',
        }));
      });
    }
  }, [editing]);

  const canSave = form.name.trim().length > 0 && (form.ppsFunctions?.length ?? 0) > 0;

  const threatLabel = useMemo(() => {
    if (!form.assignedToThreatId) return '';
    const t = threats.find((x) => x.id === form.assignedToThreatId);
    if (!t) return form.assignedToThreatId;
    return `${t.adversaryType} · ${t.actionType}${t.targetAssetName ? ` → ${t.targetAssetName}` : ''}${t.assessmentTitle ? ` · ${t.assessmentTitle}` : ''}`;
  }, [threats, form.assignedToThreatId]);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const payload: CountermeasureCreateInput = {
        ...form,
        description: form.description?.trim() || null,
        alarpJustification: form.alarpJustification?.trim() || null,
      };
      if (mode.kind === 'create') {
        await countermeasuresApi.create(payload);
      } else {
        await countermeasuresApi.update(mode.item.id, payload);
      }
      onSaved();
    } catch (e) {
      setErr(await extractError(e));
    } finally {
      setSaving(false);
    }
  }

  function togglePps(p: PpsFunction) {
    setForm((f) => {
      const set = new Set(f.ppsFunctions);
      if (set.has(p)) set.delete(p); else set.add(p);
      return { ...f, ppsFunctions: Array.from(set) };
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-r3 shadow-sh3 w-full max-w-[720px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-n-150">
          <div className="text-[14px] font-semibold text-n-900">
            {mode.kind === 'edit'
              ? `Edit · ${mode.item.name}`
              : seed
                ? `New countermeasure · from "${seed.name}"`
                : 'New countermeasure'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {err && (
            <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
              {err}
            </div>
          )}

          <Field label="Name *">
            <input
              className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="Description">
            <textarea
              className="w-full border border-n-200 rounded-r1 px-2 py-1.5 text-[12.5px] min-h-[60px]"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SHAPE category *">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={form.shapeCategory}
                onChange={(e) => setForm({ ...form, shapeCategory: e.target.value as ShapeCategory })}
              >
                {SHAPE_CATEGORIES.map((s) => (
                  <option key={s} value={s}>{SHAPE_CATEGORY_LABEL[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Protection domain *">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value as ProtectionDomain })}
              >
                {PROTECTION_DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="PPS functions *">
            <div className="flex flex-wrap gap-1.5">
              {PPS_FUNCTIONS.map((p) => {
                const active = form.ppsFunctions.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePps(p)}
                    className={[
                      'text-[11px] font-medium rounded-r1 px-2 h-6 border',
                      active
                        ? 'bg-a-50 text-a-700 border-a-200'
                        : 'bg-white text-n-700 border-n-200 hover:bg-n-75',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Status">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={form.implementationStatus ?? 'PROPOSED'}
                onChange={(e) => setForm({ ...form, implementationStatus: e.target.value as ImplementationStatus })}
              >
                {IMPLEMENTATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Effectiveness">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={form.effectivenessRating ?? ''}
                onChange={(e) => setForm({ ...form, effectivenessRating: (e.target.value as VulnerabilityRating) || null })}
              >
                <option value="">—</option>
                {VULNERABILITY_RATINGS.map((r) => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="TEAR strategy">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={form.tearStrategy ?? ''}
                onChange={(e) => setForm({ ...form, tearStrategy: (e.target.value as TearStrategy) || null })}
              >
                <option value="">—</option>
                {TEAR_STRATEGIES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost estimate (one-off)">
              <input
                type="number"
                step="100"
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
                value={form.costEstimate ?? ''}
                onChange={(e) => setForm({ ...form, costEstimate: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Annual cost">
              <input
                type="number"
                step="100"
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px]"
                value={form.annualCost ?? ''}
                onChange={(e) => setForm({ ...form, annualCost: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Assigned to asset">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={form.assignedToAssetId ?? ''}
                onChange={(e) => setForm({ ...form, assignedToAssetId: e.target.value || null })}
              >
                <option value="">—</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Assigned to threat">
              <select
                className="w-full border border-n-200 rounded-r1 h-8 px-2 text-[12.5px] bg-white"
                value={form.assignedToThreatId ?? ''}
                onChange={(e) => setForm({ ...form, assignedToThreatId: e.target.value || null })}
                title={threatLabel}
              >
                <option value="">—</option>
                {threats.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.adversaryType} · {t.actionType}
                    {t.targetAssetName ? ` → ${t.targetAssetName}` : ''}
                    {t.assessmentTitle ? ` · ${t.assessmentTitle}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="ALARP justification">
            <textarea
              className="w-full border border-n-200 rounded-r1 px-2 py-1.5 text-[12.5px] min-h-[60px]"
              placeholder="Why this countermeasure reduces risk As Low As Reasonably Practicable…"
              value={form.alarpJustification ?? ''}
              onChange={(e) => setForm({ ...form, alarpJustification: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-n-150 px-5 py-3">
          <Btn2 variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn2>
          <Btn2 variant="primary" onClick={submit} disabled={!canSave || saving}>
            {saving ? 'Saving…' : mode.kind === 'create' ? 'Create' : 'Save'}
          </Btn2>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">{label}</div>
      {children}
    </label>
  );
}
