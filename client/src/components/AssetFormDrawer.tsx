import { useEffect, useMemo, useState } from 'react';
import { X, ChevronRight, ArrowLeft, ArrowRight, ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { Btn2 } from './hifi/Btn2';
import { Pill } from './hifi/Pill';
import {
  ASSET_TYPES, ASSET_CATEGORIES, ASSET_STATUSES,
  ASSET_ROLES, ASSET_ROLE_LABEL, ASSET_ROLE_DESCRIPTION,
  OPERATIONAL_STATUSES, OPERATIONAL_STATUS_LABEL,
  RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_LABEL,
  type AssetSummary, type AssetType, type AssetCategory, type AssetStatus,
  type AssetRole, type OperationalStatus,
  type AssetCreateInput, type AssetUpdateInput,
  type AssetRelationshipSummary, type RelationshipType, type RelDirection,
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

  // Relationships UI — list incoming + outgoing edges for this asset
  // (edit mode only) and let the user add / remove them inline so they
  // don't have to go to RelationshipsPage to draw a coverage edge.
  const [relationships, setRelationships] = useState<AssetRelationshipSummary[]>([]);
  const [allAssets, setAllAssets] = useState<Array<{ id: string; name: string; assetType: AssetType }>>([]);
  const [relAdd, setRelAdd] = useState<{
    open: boolean;
    otherAssetId: string;
    type: RelationshipType;
    direction: 'OUTGOING' | 'INCOMING' | 'BIDIRECTIONAL';
  } | null>(null);

  // Create-time UX: when adding a PROTECTIVE / DUAL asset under a parent,
  // default to also creating a PROTECTS edge to the parent on save. The §4
  // bridge invariant lives on edges, not on parent_id; auto-creating the
  // edge means topology and coverage stay aligned for the common case.
  const [autoLinkProtects, setAutoLinkProtects] = useState(true);

  async function handleAddRelationship() {
    if (mode.kind !== 'edit' || !relAdd || !relAdd.otherAssetId) return;
    const otherId = relAdd.otherAssetId;
    if (otherId === mode.id) return;
    try {
      // "Direction" in the inline form maps to source/target choice:
      //   OUTGOING       — this asset is the source (e.g. CCTV PROTECTS Lobby)
      //   INCOMING       — the other asset is the source
      //   BIDIRECTIONAL  — symmetric edge with direction='BIDIRECTIONAL'
      const sourceId = relAdd.direction === 'INCOMING' ? otherId : mode.id;
      const targetId = relAdd.direction === 'INCOMING' ? mode.id : otherId;
      const direction: RelDirection =
        relAdd.direction === 'BIDIRECTIONAL' ? 'BIDIRECTIONAL' : 'UNIDIRECTIONAL';
      await assetsApi.createRelationship({
        sourceAssetId: sourceId,
        targetAssetId: targetId,
        relationshipType: relAdd.type,
        direction,
      });
      setRelAdd(null);
      await reloadRelationships(mode.id);
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleRemoveRelationship(id: string) {
    if (mode.kind !== 'edit') return;
    try {
      await assetsApi.removeRelationship(id);
      await reloadRelationships(mode.id);
    } catch (err) {
      setError(await extractError(err));
    }
  }

  // Asset-name lookup for the relationships list (no need to fetch names
  // per edge — graph() already brought them).
  const assetNameById = useMemo(
    () => new Map(allAssets.map((a) => [a.id, a.name])),
    [allAssets],
  );
  const assetTypeById = useMemo(
    () => new Map(allAssets.map((a) => [a.id, a.assetType])),
    [allAssets],
  );

  // Refresh the relationships view (edit mode). Pulls the full graph so we
  // can look up the *other* asset's name + type per edge in a single fetch.
  // Cheaper than a per-edge join, and the graph endpoint is already cached
  // by the SW.
  async function reloadRelationships(assetId: string) {
    try {
      const g = await assetsApi.graph();
      const involved = g.edges.filter(
        (e) => e.sourceAssetId === assetId || e.targetAssetId === assetId,
      );
      setRelationships(involved);
      setAllAssets(g.nodes.map((n) => ({ id: n.id, name: n.name, assetType: n.assetType })));
    } catch (err) {
      // Non-fatal — the relationships section just shows empty.
      // eslint-disable-next-line no-console
      console.warn('Failed to load relationships', err);
    }
  }

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
          void reloadRelationships(mode.id);
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

      // Auto-link PROTECTIVE/DUAL children to their parent with a PROTECTS
      // edge so the §4 bridge wiring matches the user's mental model
      // ("the camera I just put under HQ Ground Floor protects HQ Ground
      // Floor"). Best-effort: the create itself already succeeded.
      if (
        mode.kind === 'create' &&
        autoLinkProtects &&
        form.parentId &&
        (form.assetRole === 'PROTECTIVE' || form.assetRole === 'DUAL')
      ) {
        try {
          await assetsApi.createRelationship({
            sourceAssetId: saved.id,
            targetAssetId: form.parentId,
            relationshipType: 'PROTECTS',
            direction: 'UNIDIRECTIONAL',
          });
        } catch (relErr) {
          // eslint-disable-next-line no-console
          console.warn('Asset created but auto-link to parent failed', relErr);
        }
      }

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

              {/* Common gotcha: parent_id is topology, not coverage. Without
                  an explicit PROTECTS edge, the wizard's Step 6 won't list
                  a child PROTECTIVE asset under its parent's coverage. The
                  checkbox creates that edge for you on save. */}
              {!isEdit
                && (form.assetRole === 'PROTECTIVE' || form.assetRole === 'DUAL')
                && form.parentId && (
                <label className="flex items-start gap-2 text-[12px] text-n-700 bg-a-50/50 border border-a-200 rounded-r2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={autoLinkProtects}
                    onChange={(e) => setAutoLinkProtects(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Also create a <span className="font-mono">PROTECTS</span> edge from this control to its parent.
                    <span className="block text-[11px] text-n-500 mt-0.5">
                      The parent_id link is just topology; without an edge, Step 6 (Vulnerability) won't surface this control under its parent's coverage. You can change the relationship type later in the asset's <em>Relationships</em> section.
                    </span>
                  </span>
                </label>
              )}

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

              {/* Edit-mode only: list incoming + outgoing edges (PROTECTS,
                  MONITORS, DEPENDS_ON, etc.) and let the user add / remove
                  them inline. Avoids the trip to RelationshipsPage just to
                  draw a single edge. */}
              {isEdit && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                      Relationships ({relationships.length})
                    </div>
                    {!relAdd?.open && (
                      <button
                        type="button"
                        onClick={() => setRelAdd({ open: true, otherAssetId: '', type: 'PROTECTS', direction: 'OUTGOING' })}
                        className="inline-flex items-center gap-1 text-[11px] text-a-700 hover:text-a-800 hover:bg-a-50 rounded-r1 px-1.5 py-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        Add relationship
                      </button>
                    )}
                  </div>
                  {relAdd?.open && (
                    <div className="border border-a-200 bg-a-50/40 rounded-r2 p-2.5 space-y-2 mb-2">
                      <div className="grid grid-cols-12 gap-2">
                        <select
                          value={relAdd.direction}
                          onChange={(e) => setRelAdd({ ...relAdd, direction: e.target.value as typeof relAdd.direction })}
                          className="col-span-3 h-8 px-2 text-[12px] border border-n-200 rounded-r1 bg-white"
                          title="OUTGOING: this asset → other. INCOMING: other → this asset. BIDIRECTIONAL: symmetric."
                        >
                          <option value="OUTGOING">→ outgoing</option>
                          <option value="INCOMING">← incoming</option>
                          <option value="BIDIRECTIONAL">↔ both</option>
                        </select>
                        <select
                          value={relAdd.type}
                          onChange={(e) => setRelAdd({ ...relAdd, type: e.target.value as RelationshipType })}
                          className="col-span-4 h-8 px-2 text-[12px] border border-n-200 rounded-r1 bg-white"
                        >
                          {RELATIONSHIP_TYPES.map((t) => (
                            <option key={t} value={t}>{RELATIONSHIP_TYPE_LABEL[t]}</option>
                          ))}
                        </select>
                        <select
                          value={relAdd.otherAssetId}
                          onChange={(e) => setRelAdd({ ...relAdd, otherAssetId: e.target.value })}
                          className="col-span-5 h-8 px-2 text-[12px] border border-n-200 rounded-r1 bg-white"
                        >
                          <option value="">— pick asset —</option>
                          {allAssets
                            .filter((a) => mode.kind === 'edit' && a.id !== mode.id)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((a) => (
                              <option key={a.id} value={a.id}>{a.name} ({a.assetType})</option>
                            ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setRelAdd(null)}
                          className="text-[11.5px] text-n-600 hover:text-n-900 px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAddRelationship()}
                          disabled={!relAdd.otherAssetId}
                          className="inline-flex items-center gap-1 text-[11.5px] text-white bg-a-600 hover:bg-a-700 disabled:bg-n-300 rounded-r1 px-2 py-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                  {relationships.length > 0 ? (
                    <div className="border border-n-150 rounded-r2 divide-y divide-n-100 overflow-hidden bg-white">
                      {relationships.map((r) => {
                        const isOutgoing = r.sourceAssetId === (mode.kind === 'edit' ? mode.id : '');
                        const otherId = isOutgoing ? r.targetAssetId : r.sourceAssetId;
                        const otherName = assetNameById.get(otherId) ?? '—';
                        const otherType = assetTypeById.get(otherId);
                        const Arrow =
                          r.direction === 'BIDIRECTIONAL' ? ArrowLeftRight :
                          isOutgoing ? ArrowRight : ArrowLeft;
                        return (
                          <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                            <Pill variant="outline">{RELATIONSHIP_TYPE_LABEL[r.relationshipType]}</Pill>
                            <Arrow className="w-3.5 h-3.5 text-n-400 shrink-0" />
                            <button
                              type="button"
                              onClick={() => onEditAsset?.(otherId)}
                              disabled={!onEditAsset}
                              className="min-w-0 flex-1 text-left hover:underline disabled:hover:no-underline"
                            >
                              <div className="text-[12.5px] text-n-900 font-medium truncate">{otherName}</div>
                              {otherType && (
                                <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-0.5">{otherType}</div>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRemoveRelationship(r.id)}
                              className="w-6 h-6 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1 shrink-0"
                              aria-label="Remove relationship"
                              title="Remove this relationship"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !relAdd?.open && (
                      <div className="text-[11.5px] text-n-500 border border-dashed border-n-200 rounded-r2 px-3 py-2.5 bg-n-50/40">
                        No relationships yet. Use <em>Add relationship</em> to draw a PROTECTS / MONITORS / DEPENDS_ON edge to another asset.
                      </div>
                    )
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
