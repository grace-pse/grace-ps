import { useEffect, useState } from 'react';
import { X, ChevronRight, ArrowLeft, Plus } from 'lucide-react';
import { Btn2 } from './hifi/Btn2';
import { Pill } from './hifi/Pill';
import {
  ASSET_TYPES, ASSET_CATEGORIES, ASSET_STATUSES,
  ASSET_ROLES, ASSET_ROLE_LABEL, ASSET_ROLE_DESCRIPTION,
  OPERATIONAL_STATUSES, OPERATIONAL_STATUS_LABEL,
  type AssetSummary, type AssetType, type AssetCategory, type AssetStatus,
  type AssetRole, type OperationalStatus,
  type AssetCreateInput, type AssetUpdateInput,
} from '../lib/csmp-types';
import { assetsApi, templatesApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';

type Mode =
  | { kind: 'create'; template?: { id: string; name: string }; parentId?: string }
  | { kind: 'edit'; id: string };

interface AssetFormDrawerProps {
  mode: Mode;
  onClose: () => void;
  onSaved: (asset: AssetSummary) => void;
  availableParents: AssetSummary[];
  // Optional: when present, the children list in edit mode renders each
  // child as a button that calls this — host page swaps the drawer over
  // to that child without closing.
  onEditAsset?: (id: string) => void;
  // Optional: when present, the children section shows an "Add child"
  // button. The host opens a create drawer with this asset as the
  // parent and routes the user back here on save.
  onAddChild?: () => void;
  // When the drawer was opened by drilling into a child from another
  // asset's drawer, the host passes onBack so the user can return. The
  // backLabel (parent name) is shown next to the chevron.
  onBack?: () => void;
  backLabel?: string;
}

interface FormState {
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  status: AssetStatus;
  assetRole: AssetRole;
  operationalStatus: OperationalStatus;
  criticality: number;
  description: string;
  parentId: string;
  tags: string;
  sourceTemplateId: string | null;
}

const INITIAL: FormState = {
  name: '',
  assetType: 'EQUIPMENT',
  category: 'TANGIBLE',
  status: 'ACTIVE',
  assetRole: 'PROTECTED',
  operationalStatus: 'OPERATIONAL',
  criticality: 3,
  description: '',
  parentId: '',
  tags: '',
  sourceTemplateId: null,
};

export function AssetFormDrawer({
  mode, onClose, onSaved, availableParents, onEditAsset, onAddChild, onBack, backLabel,
}: AssetFormDrawerProps) {
  const [form, setForm] = useState<FormState>(() => (
    mode.kind === 'create' && mode.parentId
      ? { ...INITIAL, parentId: mode.parentId }
      : INITIAL
  ));
  const [loading, setLoading] = useState(mode.kind === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [children, setChildren] = useState<AssetSummary[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (mode.kind === 'edit') {
          const a = await assetsApi.get(mode.id);
          if (cancelled) return;
          setForm({
            name: a.name,
            assetType: a.assetType,
            category: a.category,
            status: a.status,
            assetRole: a.assetRole,
            operationalStatus: a.operationalStatus,
            criticality: a.criticality,
            description: a.description ?? '',
            parentId: a.parentId ?? '',
            tags: a.tags.join(', '),
            sourceTemplateId: a.sourceTemplateId,
          });
          setChildren(a.children);
          setLoading(false);
        } else if (mode.template) {
          const tpl = await templatesApi.getAssetTemplate(mode.template.id);
          if (cancelled) return;
          setForm({
            name: tpl.name,
            assetType: tpl.assetType,
            category: tpl.category,
            status: 'ACTIVE',
            assetRole: 'PROTECTED',
            operationalStatus: 'OPERATIONAL',
            criticality: tpl.defaultCriticality,
            description: tpl.description ?? '',
            parentId: mode.parentId ?? '',
            tags: tpl.tags.join(', '),
            sourceTemplateId: tpl.id,
          });
          setTemplateName(tpl.name);
        }
      } catch (err) {
        setError(await extractError(err));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: AssetCreateInput | AssetUpdateInput = {
        name: form.name.trim(),
        assetType: form.assetType,
        category: form.category,
        status: form.status,
        assetRole: form.assetRole,
        operationalStatus: form.operationalStatus,
        criticality: form.criticality,
        description: form.description.trim() || null,
        parentId: form.parentId || null,
        tags,
        sourceTemplateId: form.sourceTemplateId,
      };
      const saved =
        mode.kind === 'create'
          ? await assetsApi.create(payload as AssetCreateInput)
          : await assetsApi.update(mode.id, payload);
      onSaved(saved);
      // When the drawer is kept open (nested edit via Back chain), show
      // a brief Saved flash so the user knows the click landed.
      if (onBack) {
        setJustSaved(true);
        window.setTimeout(() => setJustSaved(false), 1800);
      }
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const isEdit = mode.kind === 'edit';
  const title = isEdit ? 'Edit asset' : templateName ? `New asset from "${templateName}"` : 'New asset';

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col"
        role="dialog"
        aria-labelledby="asset-drawer-title"
      >
        <header className="flex flex-col px-5 py-3 border-b border-n-150 shrink-0 gap-1.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="self-start inline-flex items-center gap-1 text-[11.5px] text-n-600 hover:text-a-700 -ml-1 px-1 py-0.5 rounded-r1 hover:bg-n-100 max-w-full"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Back{backLabel ? ` to ${backLabel}` : ''}</span>
            </button>
          )}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 id="asset-drawer-title" className="text-[15px] font-semibold text-n-900 truncate">{title}</h2>
              {mode.kind === 'create' && (
                <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
                  {mode.template ? 'From template' : 'Blank'}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1 shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
                  placeholder="Main server room"
                  maxLength={255}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select
                    value={form.assetType}
                    onChange={(e) => setForm({ ...form, assetType: e.target.value as AssetType })}
                    className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                  >
                    {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as AssetCategory })}
                    className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                  >
                    {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}
                    className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                  >
                    {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label={`Criticality (${form.criticality})`}>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={form.criticality}
                    onChange={(e) => setForm({ ...form, criticality: Number(e.target.value) })}
                    className="w-full mt-2"
                  />
                </Field>
              </div>

              <Field label="Asset role">
                <div className="grid grid-cols-3 gap-1.5">
                  {ASSET_ROLES.map((role) => {
                    const active = form.assetRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setForm({ ...form, assetRole: role })}
                        className={
                          'h-9 text-[12px] rounded-r2 border transition-colors ' +
                          (active
                            ? 'bg-a-50 border-a-500 text-a-800 font-medium'
                            : 'bg-white border-n-200 text-n-700 hover:bg-n-50')
                        }
                      >
                        {ASSET_ROLE_LABEL[role]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-n-500 mt-1.5">
                  {ASSET_ROLE_DESCRIPTION[form.assetRole]}
                </p>
              </Field>

              {(form.assetRole === 'PROTECTIVE' || form.assetRole === 'DUAL') && (
                <Field label="Operational status">
                  <select
                    value={form.operationalStatus}
                    onChange={(e) => setForm({ ...form, operationalStatus: e.target.value as OperationalStatus })}
                    className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                  >
                    {OPERATIONAL_STATUSES.map((s) => (
                      <option key={s} value={s}>{OPERATIONAL_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-n-500 mt-1.5">
                    Drives the Step 6 protective-coverage panel and the degraded-posture banner. Non-OPERATIONAL flips a flag on every asset this one protects via PROTECTS / MONITORS edges.
                  </p>
                </Field>
              )}

              <Field label="Parent asset (optional)">
                <select
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="w-full h-9 px-2 text-[13px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                >
                  <option value="">— none —</option>
                  {availableParents
                    .filter((p) => !isEdit || p.id !== mode.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.assetType})</option>
                    ))}
                </select>
              </Field>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full min-h-[80px] px-2.5 py-1.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none resize-y"
                />
              </Field>

              <Field label="Tags (comma-separated)">
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
                  placeholder="perimeter, datacenter"
                />
                {form.tags && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {form.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <Pill key={t} variant="outline">{t}</Pill>
                    ))}
                  </div>
                )}
              </Field>

              {isEdit && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                      Children ({children.length})
                    </div>
                    {onAddChild && (
                      <button
                        type="button"
                        onClick={onAddChild}
                        className="inline-flex items-center gap-1 text-[11px] text-a-700 hover:text-a-800 hover:bg-a-50 rounded-r1 px-1.5 py-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        Add child
                      </button>
                    )}
                  </div>
                  {children.length > 0 ? (
                    <div className="border border-n-150 rounded-r2 divide-y divide-n-100 overflow-hidden bg-white">
                      {children.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onEditAsset?.(c.id)}
                          disabled={!onEditAsset}
                          className="w-full text-left px-3 py-2 hover:bg-n-50 disabled:hover:bg-white disabled:cursor-default flex items-center gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] text-n-900 font-medium truncate">{c.name}</div>
                            <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-0.5">
                              {c.assetType} · {c.category} · crit {c.criticality}
                              {c.childCount > 0 ? ` · ${c.childCount} child${c.childCount === 1 ? '' : 'ren'}` : ''}
                            </div>
                          </div>
                          {onEditAsset && (
                            <ChevronRight className="w-3.5 h-3.5 text-n-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11.5px] text-n-500 border border-dashed border-n-200 rounded-r2 px-3 py-2.5 bg-n-50/40">
                      No children yet.
                    </div>
                  )}
                </div>
              )}

              {form.sourceTemplateId && (
                <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
                  Linked to template
                </div>
              )}

              {error && (
                <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <footer className="border-t border-n-150 px-5 py-3 flex items-center gap-2 shrink-0">
              {justSaved && (
                <span className="text-[11.5px] text-ok font-medium" role="status">
                  Saved ✓
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Btn2 type="button" variant="ghost" onClick={onClose}>Cancel</Btn2>
                <Btn2 type="submit" variant="primary" disabled={saving || !form.name.trim()}>
                  {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create asset'}
                </Btn2>
              </div>
            </footer>
          </form>
        )}
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
