import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Search } from 'lucide-react';
import { Btn2 } from './hifi/Btn2';
import { Pill } from './hifi/Pill';
import { RiskBadge } from './hifi/RiskBadge';
import { clustersApi, assetsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  ASSET_TYPES,
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  CLUSTER_TYPES,
  CRITICALITY_MODES,
  PROPAGATION_MODES,
  criticalityToRiskLevel,
  type AssetCategory,
  type AssetStatus,
  type AssetSummary,
  type AssetType,
  type ClusterCreateInput,
  type ClusterMemberInput,
  type ClusterSummary,
  type ClusterType,
  type CriticalityMode,
  type PropagationMode,
} from '../lib/csmp-types';

type Mode = { kind: 'create' } | { kind: 'edit'; id: string };

interface ClusterFormDrawerProps {
  mode: Mode;
  onClose: () => void;
  onSaved: (c: ClusterSummary) => void;
}

interface MemberRow extends ClusterMemberInput {
  asset: { id: string; name: string; assetType: string; criticality: number };
}

interface FormState {
  name: string;
  description: string;
  clusterType: ClusterType;
  criticalityMode: CriticalityMode;
  statusPropagation: PropagationMode;
  members: MemberRow[];
}

const INITIAL: FormState = {
  name: '',
  description: '',
  clusterType: 'OPERATIONAL',
  criticalityMode: 'HIGHEST',
  statusPropagation: 'CASCADE_UP',
  members: [],
};

export function ClusterFormDrawer({ mode, onClose, onSaved }: ClusterFormDrawerProps) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(mode.kind === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [picker, setPicker] = useState(false);
  const [pickerAssets, setPickerAssets] = useState<AssetSummary[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerType, setPickerType] = useState<AssetType | ''>('');
  const [pickerCategory, setPickerCategory] = useState<AssetCategory | ''>('');
  const [pickerStatus, setPickerStatus] = useState<AssetStatus | ''>('');
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (mode.kind === 'edit') {
          const c = await clustersApi.get(mode.id);
          if (cancelled) return;
          setForm({
            name: c.name,
            description: c.description ?? '',
            clusterType: c.clusterType,
            criticalityMode: c.criticalityMode,
            statusPropagation: c.statusPropagation,
            members: c.memberships.map((m) => ({
              assetId: m.assetId,
              roleInCluster: m.roleInCluster,
              isCritical: m.isCritical,
              dependencyWeight: m.dependencyWeight,
              asset: m.asset,
            })),
          });
          setLoading(false);
        }
      } catch (err) {
        setError(await extractError(err));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    if (!picker) return;
    let cancelled = false;
    setPickerLoading(true);
    // pageSize 200 is the server cap; for the bulk-pick UX it covers
    // every realistic filter combo without paging the picker.
    assetsApi
      .list({
        search: pickerSearch || undefined,
        assetType: pickerType || undefined,
        category: pickerCategory || undefined,
        status: pickerStatus || undefined,
        pageSize: 200,
      })
      .then((r) => { if (!cancelled) setPickerAssets(r.items); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setPickerLoading(false); });
    return () => { cancelled = true; };
  }, [picker, pickerSearch, pickerType, pickerCategory, pickerStatus]);

  // Reset filters + selection every time the picker is closed so the
  // next "Add member" click starts fresh instead of inheriting stale
  // checkboxes.
  function closePicker() {
    setPicker(false);
    setPickerSelected(new Set());
    setPickerSearch('');
    setPickerType('');
    setPickerCategory('');
    setPickerStatus('');
  }

  const derivedCriticality = useMemo(() => {
    if (form.criticalityMode === 'CUSTOM' || form.members.length === 0) return null;
    const vals = form.members.map((m) => m.asset.criticality);
    if (form.criticalityMode === 'HIGHEST') return Math.max(...vals);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [form.criticalityMode, form.members]);

  function addMembers(assets: AssetSummary[]) {
    const existing = new Set(form.members.map((m) => m.assetId));
    const fresh = assets.filter((a) => !existing.has(a.id));
    if (fresh.length === 0) return;
    setForm({
      ...form,
      members: [
        ...form.members,
        ...fresh.map((a) => ({
          assetId: a.id,
          roleInCluster: null,
          isCritical: false,
          dependencyWeight: 0.5,
          asset: { id: a.id, name: a.name, assetType: a.assetType, criticality: a.criticality },
        })),
      ],
    });
  }

  function toggleSelected(id: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeMember(id: string) {
    setForm({ ...form, members: form.members.filter((m) => m.assetId !== id) });
  }

  function updateMember(id: string, patch: Partial<ClusterMemberInput>) {
    setForm({
      ...form,
      members: form.members.map((m) => (m.assetId === id ? { ...m, ...patch } : m)),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: ClusterCreateInput = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        clusterType: form.clusterType,
        criticalityMode: form.criticalityMode,
        statusPropagation: form.statusPropagation,
        members: form.members.map((m) => ({
          assetId: m.assetId,
          roleInCluster: m.roleInCluster,
          isCritical: m.isCritical,
          dependencyWeight: m.dependencyWeight,
        })),
      };
      const saved =
        mode.kind === 'create'
          ? await clustersApi.create(payload)
          : await clustersApi.update(mode.id, payload);
      onSaved(saved);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const title = mode.kind === 'edit' ? 'Edit cluster' : 'New cluster';

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[680px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col"
        role="dialog"
        aria-labelledby="cluster-drawer-title"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150 shrink-0">
          <h2 id="cluster-drawer-title" className="text-[15px] font-semibold text-n-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[12.5px] text-n-500">Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <Field label="Name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
                  placeholder="Data center operations"
                  maxLength={255}
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Type">
                  <select
                    value={form.clusterType}
                    onChange={(e) => setForm({ ...form, clusterType: e.target.value as ClusterType })}
                    className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                  >
                    {CLUSTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Criticality mode">
                  <select
                    value={form.criticalityMode}
                    onChange={(e) => setForm({ ...form, criticalityMode: e.target.value as CriticalityMode })}
                    className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                  >
                    {CRITICALITY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Propagation">
                  <select
                    value={form.statusPropagation}
                    onChange={(e) => setForm({ ...form, statusPropagation: e.target.value as PropagationMode })}
                    className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                  >
                    {PROPAGATION_MODES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full min-h-[70px] px-2.5 py-1.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none resize-y"
                />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                      Members ({form.members.length})
                    </span>
                    {derivedCriticality != null && (
                      <span className="text-[11px] text-n-600 mt-0.5 block">
                        Derived criticality: <span className="font-mono font-semibold text-n-800">{derivedCriticality}</span>{' '}
                        <span className="text-n-400">({form.criticalityMode.toLowerCase()})</span>
                      </span>
                    )}
                  </div>
                  <Btn2
                    type="button"
                    variant="secondary"
                    leading={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setPicker(true)}
                  >
                    Add member
                  </Btn2>
                </div>

                {form.members.length === 0 ? (
                  <div className="text-center py-6 text-[12px] text-n-500 border border-dashed border-n-200 rounded-r2">
                    No members yet. Add at least one asset.
                  </div>
                ) : (
                  <div className="border border-n-150 rounded-r2 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] border-b border-n-150 bg-n-50">
                          <th className="text-left px-3 py-1.5 font-medium">Asset</th>
                          <th className="text-left px-2 py-1.5 font-medium">Role</th>
                          <th className="text-left px-2 py-1.5 font-medium">Weight</th>
                          <th className="text-center px-2 py-1.5 font-medium">Crit</th>
                          <th className="w-7" />
                        </tr>
                      </thead>
                      <tbody>
                        {form.members.map((m) => (
                          <tr key={m.assetId} className="border-b border-n-100 last:border-b-0">
                            <td className="px-3 py-1.5">
                              <div className="text-[12.5px] font-medium text-n-900">{m.asset.name}</div>
                              <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{m.asset.assetType}</div>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={m.roleInCluster ?? ''}
                                onChange={(e) => updateMember(m.assetId, { roleInCluster: e.target.value || null })}
                                placeholder="e.g. primary"
                                className="w-full h-7 px-2 text-[12px] border border-n-200 rounded-r1 focus:border-a-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step={0.1}
                                min={0}
                                max={1}
                                value={m.dependencyWeight}
                                onChange={(e) => updateMember(m.assetId, { dependencyWeight: Number(e.target.value) })}
                                className="w-20 h-7 px-2 text-[12px] font-mono border border-n-200 rounded-r1 focus:border-a-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <label className="flex items-center justify-center gap-1 text-[11px] text-n-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={m.isCritical}
                                  onChange={(e) => updateMember(m.assetId, { isCritical: e.target.checked })}
                                />
                                <span className="font-mono">{m.asset.criticality}</span>
                              </label>
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => removeMember(m.assetId)}
                                className="w-6 h-6 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1"
                                aria-label="Remove member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
              <Btn2 type="button" variant="ghost" onClick={onClose}>Cancel</Btn2>
              <Btn2 type="submit" variant="primary" disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : mode.kind === 'edit' ? 'Save changes' : 'Create cluster'}
              </Btn2>
            </footer>
          </form>
        )}

        {picker && (() => {
          const existingIds = new Set(form.members.map((m) => m.assetId));
          // Selectable = visible rows that aren't already members.
          const selectableVisible = pickerAssets.filter((a) => !existingIds.has(a.id));
          const allVisibleSelected =
            selectableVisible.length > 0
            && selectableVisible.every((a) => pickerSelected.has(a.id));
          const someVisibleSelected =
            !allVisibleSelected
            && selectableVisible.some((a) => pickerSelected.has(a.id));
          const filtersActive =
            !!pickerSearch || !!pickerType || !!pickerCategory || !!pickerStatus;

          function toggleAllVisible() {
            setPickerSelected((prev) => {
              const next = new Set(prev);
              if (allVisibleSelected) {
                for (const a of selectableVisible) next.delete(a.id);
              } else {
                for (const a of selectableVisible) next.add(a.id);
              }
              return next;
            });
          }

          function commitBulkAdd() {
            const toAdd = pickerAssets.filter((a) => pickerSelected.has(a.id));
            addMembers(toAdd);
            closePicker();
          }

          return (
            <div className="absolute inset-0 bg-white flex flex-col z-10">
              <header className="flex items-center justify-between px-5 py-3 border-b border-n-150 shrink-0">
                <div>
                  <h3 className="text-[14px] font-semibold text-n-900">Add member assets</h3>
                  <div className="text-[11px] text-n-500 mt-0.5">
                    Filter, then check the assets you want to add.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePicker}
                  className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
                  aria-label="Close picker"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <div className="px-5 py-3 border-b border-n-150 shrink-0 space-y-2">
                <label className="relative block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-n-400" />
                  <input
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search by name, description, or tag…"
                    className="w-full h-8 pl-8 pr-2.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
                    autoFocus
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <PickerSelect
                    value={pickerType}
                    onChange={(v) => setPickerType(v as AssetType | '')}
                    placeholder="All types"
                    options={ASSET_TYPES}
                  />
                  <PickerSelect
                    value={pickerCategory}
                    onChange={(v) => setPickerCategory(v as AssetCategory | '')}
                    placeholder="All categories"
                    options={ASSET_CATEGORIES}
                  />
                  <PickerSelect
                    value={pickerStatus}
                    onChange={(v) => setPickerStatus(v as AssetStatus | '')}
                    placeholder="All statuses"
                    options={ASSET_STATUSES}
                  />
                  {filtersActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickerSearch('');
                        setPickerType('');
                        setPickerCategory('');
                        setPickerStatus('');
                      }}
                      className="text-[11.5px] text-n-600 hover:text-n-900 underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div className="px-5 py-2 border-b border-n-150 shrink-0 flex items-center gap-3 bg-n-50/60">
                <label className="inline-flex items-center gap-2 text-[12px] text-n-700">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected;
                    }}
                    onChange={toggleAllVisible}
                    disabled={selectableVisible.length === 0}
                  />
                  <span>
                    {allVisibleSelected
                      ? `All ${selectableVisible.length} selected`
                      : someVisibleSelected
                        ? 'Select all visible'
                        : `Select all visible (${selectableVisible.length})`}
                  </span>
                </label>
                <span className="text-[11.5px] text-n-500 ml-auto">
                  {pickerLoading
                    ? 'Loading…'
                    : `${pickerAssets.length} match${pickerAssets.length === 1 ? '' : 'es'}`}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {pickerAssets.length === 0 ? (
                  <div className="p-8 text-center text-[12.5px] text-n-500">
                    {pickerLoading ? 'Loading…' : 'No assets match the current filters.'}
                  </div>
                ) : (
                  <ul className="divide-y divide-n-100">
                    {pickerAssets.map((a) => {
                      const already = existingIds.has(a.id);
                      const checked = pickerSelected.has(a.id);
                      return (
                        <li key={a.id}>
                          <label
                            className={[
                              'flex items-center gap-3 px-5 py-2.5 transition-colors cursor-pointer',
                              already ? 'opacity-50 cursor-not-allowed' : 'hover:bg-n-75',
                              checked && !already ? 'bg-a-50/40' : '',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={already}
                              onChange={() => toggleSelected(a.id)}
                              className="shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-medium text-n-900 truncate">{a.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Pill variant="outline">{a.assetType}</Pill>
                                <Pill variant="default">{a.category}</Pill>
                                <Pill variant="default">{a.status}</Pill>
                                {already && <Pill variant="accent">already a member</Pill>}
                              </div>
                            </div>
                            <RiskBadge level={criticalityToRiskLevel(a.criticality)} value={a.criticality} />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <footer className="border-t border-n-150 px-5 py-3 flex items-center gap-2 shrink-0">
                <span className="text-[12px] text-n-600">
                  {pickerSelected.size === 0
                    ? 'Pick at least one asset.'
                    : `${pickerSelected.size} selected`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Btn2 type="button" variant="ghost" onClick={closePicker}>Cancel</Btn2>
                  <Btn2
                    type="button"
                    variant="primary"
                    leading={<Plus className="w-3.5 h-3.5" />}
                    disabled={pickerSelected.size === 0}
                    onClick={commitBulkAdd}
                  >
                    Add {pickerSelected.size > 0 ? pickerSelected.size : ''} member{pickerSelected.size === 1 ? '' : 's'}
                  </Btn2>
                </div>
              </footer>
            </div>
          );
        })()}
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function PickerSelect<T extends string>({
  value, onChange, placeholder, options,
}: {
  value: T | '';
  onChange: (v: string) => void;
  placeholder: string;
  options: readonly T[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
