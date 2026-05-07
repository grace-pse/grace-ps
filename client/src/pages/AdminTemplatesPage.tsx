import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Search, Plus, Pencil, Trash2, Save, X, Lock, Link2, Unlink, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { adminTemplatesApi, templateQuestionsApi, surveyQuestionsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { hasPermission } from '../lib/permissions';
import {
  ASSET_TYPES, ASSET_CATEGORIES, ASSET_ROLES,
  ADVERSARY_TYPES, ACTION_TYPES,
  SHAPE_CATEGORIES, PPS_FUNCTIONS, PROTECTION_DOMAINS,
  TEAR_STRATEGIES, VULNERABILITY_RATINGS,
  type Relevance,
  type AssetType, type AssetCategory, type AssetRole,
  type AdversaryType, type ActionType,
  type ShapeCategory, type PpsFunction, type ProtectionDomain,
  type TearStrategy, type VulnerabilityRating,
  type AdminAssetTemplate, type AdminThreatTemplate, type AdminCountermeasureTemplate,
  type AdminAssetTemplateCreateInput, type AdminAssetTemplateUpdateInput,
  type AdminThreatTemplateCreateInput, type AdminThreatTemplateUpdateInput,
  type AdminCountermeasureTemplateCreateInput, type AdminCountermeasureTemplateUpdateInput,
  type TemplateQuestionLink, type SurveyQuestionLibraryItem,
  type SurveyQuestionCreateInput, type SurveyType,
  type QuestionTemplateAttachments,
  SURVEY_TYPES,
} from '../lib/csmp-types';

type Tab = 'asset' | 'threat' | 'cm' | 'question';

interface ModuleRef {
  id: string;
  slug: string;
  name: string;
  packageId: string;
  packageName: string;
  packageSlug: string;
  isSystem: boolean;
}

interface AssetRow {
  kind: 'asset';
  tpl: AdminAssetTemplate;
  module: ModuleRef;
}
interface ThreatRow {
  kind: 'threat';
  tpl: AdminThreatTemplate;
  module: ModuleRef;
}
interface CmRow {
  kind: 'cm';
  tpl: AdminCountermeasureTemplate;
  module: ModuleRef;
}
interface QuestionRow {
  kind: 'question';
  tpl: SurveyQuestionLibraryItem;
}

interface CombinedData {
  assets: AssetRow[];
  threats: ThreatRow[];
  cms: CmRow[];
  questions: QuestionRow[];
  /** Module records keyed by id, used by selection panels and the module dropdown. */
  modulesById: Map<string, ModuleRef>;
  /** Junction: assetTemplateId → list of {threatTemplateId, relevance, rationale}. */
  assetThreatLinks: Map<string, Array<{ threatTemplateId: string; relevance: Relevance; rationale: string | null }>>;
  /** Junction: threatTemplateId → list of {countermeasureTemplateId, relevance, rationale}. */
  threatCmLinks: Map<string, Array<{ countermeasureTemplateId: string; relevance: Relevance; rationale: string | null }>>;
  /** Reverse: threatTemplateId → list of asset templates that link to it. */
  threatAssetReverse: Map<string, Array<{ assetTemplateId: string; relevance: Relevance; rationale: string | null }>>;
  /** Reverse: countermeasureTemplateId → list of threat templates that link to it. */
  cmThreatReverse: Map<string, Array<{ threatTemplateId: string; relevance: Relevance; rationale: string | null }>>;
}

const RELEVANCES: Relevance[] = ['HIGH', 'MEDIUM', 'LOW'];

export function AdminTemplatesPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = hasPermission(user?.role, 'templates:manage');

  const [data, setData] = useState<CombinedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('asset');
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Tab | null>(null);

  async function refresh() {
    setError(null);
    try {
      const [{ items: pkgs }, { items: questionItems }] = await Promise.all([
        adminTemplatesApi.listPackages(),
        // Question library is loaded alongside the AAA template tree so the
        // Questions tab can render without a second round-trip on tab switch.
        // includeInactive so admins can see/restore deactivated questions.
        surveyQuestionsApi.list({ includeInactive: true }),
      ]);
      const visible = pkgs.filter((p) => p.enabled);

      const moduleDetails = await Promise.all(
        visible.flatMap((p) => p.modules.map((m) => adminTemplatesApi.getModule(m.id).then((d) => ({ d, p })))),
      );

      const assets: AssetRow[] = [];
      const threats: ThreatRow[] = [];
      const cms: CmRow[] = [];
      const questions: QuestionRow[] = questionItems.map((q) => ({ kind: 'question' as const, tpl: q }));
      const modulesById = new Map<string, ModuleRef>();
      const assetThreatLinks = new Map<string, Array<{ threatTemplateId: string; relevance: Relevance; rationale: string | null }>>();
      const threatCmLinks = new Map<string, Array<{ countermeasureTemplateId: string; relevance: Relevance; rationale: string | null }>>();
      const threatAssetReverse = new Map<string, Array<{ assetTemplateId: string; relevance: Relevance; rationale: string | null }>>();
      const cmThreatReverse = new Map<string, Array<{ threatTemplateId: string; relevance: Relevance; rationale: string | null }>>();

      for (const { d, p } of moduleDetails) {
        const moduleRef: ModuleRef = {
          id: d.id, slug: d.slug, name: d.name,
          packageId: p.id, packageName: p.name, packageSlug: p.slug,
          isSystem: p.isSystem,
        };
        modulesById.set(d.id, moduleRef);

        for (const t of d.assetTemplates) assets.push({ kind: 'asset', tpl: t, module: moduleRef });
        for (const t of d.threatTemplates) threats.push({ kind: 'threat', tpl: t, module: moduleRef });
        for (const t of d.countermeasureTemplates) cms.push({ kind: 'cm', tpl: t, module: moduleRef });

        for (const link of d.assetThreatLinks) {
          const list = assetThreatLinks.get(link.assetTemplateId) ?? [];
          list.push({ threatTemplateId: link.threatTemplateId, relevance: link.relevance, rationale: link.rationale });
          assetThreatLinks.set(link.assetTemplateId, list);
          const rev = threatAssetReverse.get(link.threatTemplateId) ?? [];
          rev.push({ assetTemplateId: link.assetTemplateId, relevance: link.relevance, rationale: link.rationale });
          threatAssetReverse.set(link.threatTemplateId, rev);
        }
        for (const link of d.threatCountermeasureLinks) {
          const list = threatCmLinks.get(link.threatTemplateId) ?? [];
          list.push({ countermeasureTemplateId: link.countermeasureTemplateId, relevance: link.relevance, rationale: link.rationale });
          threatCmLinks.set(link.threatTemplateId, list);
          const rev = cmThreatReverse.get(link.countermeasureTemplateId) ?? [];
          rev.push({ threatTemplateId: link.threatTemplateId, relevance: link.relevance, rationale: link.rationale });
          cmThreatReverse.set(link.countermeasureTemplateId, rev);
        }
      }

      assets.sort((a, b) => a.tpl.name.localeCompare(b.tpl.name));
      threats.sort((a, b) => a.tpl.scenarioName.localeCompare(b.tpl.scenarioName));
      cms.sort((a, b) => a.tpl.name.localeCompare(b.tpl.name));
      questions.sort((a, b) => {
        if (a.tpl.isSystem !== b.tpl.isSystem) return a.tpl.isSystem ? -1 : 1;
        return a.tpl.prompt.localeCompare(b.tpl.prompt);
      });

      setData({
        assets, threats, cms, questions, modulesById,
        assetThreatLinks, threatCmLinks, threatAssetReverse, cmThreatReverse,
      });
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const filteredAssets = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.assets.filter((r) => {
      if (q && !r.tpl.name.toLowerCase().includes(q) && !r.tpl.slug.toLowerCase().includes(q)) return false;
      if (moduleFilter && r.module.id !== moduleFilter) return false;
      if (typeFilter && r.tpl.assetType !== typeFilter) return false;
      return true;
    });
  }, [data, search, moduleFilter, typeFilter]);

  const filteredThreats = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.threats.filter((r) => {
      if (q && !r.tpl.scenarioName.toLowerCase().includes(q) && !r.tpl.slug.toLowerCase().includes(q)) return false;
      if (moduleFilter && r.module.id !== moduleFilter) return false;
      if (typeFilter && r.tpl.adversaryType !== typeFilter) return false;
      return true;
    });
  }, [data, search, moduleFilter, typeFilter]);

  const filteredCms = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.cms.filter((r) => {
      if (q && !r.tpl.name.toLowerCase().includes(q) && !r.tpl.slug.toLowerCase().includes(q)) return false;
      if (moduleFilter && r.module.id !== moduleFilter) return false;
      if (typeFilter && r.tpl.shapeCategory !== typeFilter) return false;
      return true;
    });
  }, [data, search, moduleFilter, typeFilter]);

  // Question library tab filters: search by prompt/category; typeFilter is
  // repurposed as evidenceType (PHYSICAL / REMOTE_TECH / DOC_REVIEW / HYBRID
  // / CUSTOM). Module filter doesn't apply (questions aren't packaged).
  const filteredQuestions = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.questions.filter((r) => {
      if (q && !r.tpl.prompt.toLowerCase().includes(q) && !(r.tpl.category ?? '').toLowerCase().includes(q)) return false;
      if (typeFilter && r.tpl.evidenceType !== typeFilter) return false;
      return true;
    });
  }, [data, search, typeFilter]);

  function selectedRow(): AssetRow | ThreatRow | CmRow | QuestionRow | null {
    if (!data || !selectedId) return null;
    if (tab === 'asset') return data.assets.find((r) => r.tpl.id === selectedId) ?? null;
    if (tab === 'threat') return data.threats.find((r) => r.tpl.id === selectedId) ?? null;
    if (tab === 'cm') return data.cms.find((r) => r.tpl.id === selectedId) ?? null;
    return data.questions.find((r) => r.tpl.id === selectedId) ?? null;
  }

  function onTabChange(next: Tab) {
    setTab(next);
    setSelectedId(null);
    setSearch('');
    setModuleFilter('');
    setTypeFilter('');
    setCreating(null);
  }

  const editableModules = useMemo(() => {
    if (!data) return [];
    return Array.from(data.modulesById.values())
      .filter((m) => !m.isSystem)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const allModules = useMemo(() => {
    if (!data) return [];
    return Array.from(data.modulesById.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const sel = selectedRow();
  // Questions don't belong to a module — a system question (tenantId=NULL)
  // is the equivalent "locked" state.
  const selLocked = sel
    ? sel.kind === 'question' ? sel.tpl.isSystem : sel.module.isSystem
    : false;
  const editableForSel = canManage && editMode && !selLocked;

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-4 pb-0 border-b border-n-150 shrink-0 bg-white">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-semibold text-n-900">Templates</h1>
            <div className="text-[12px] text-n-500 mt-0.5">
              Browse asset, threat, countermeasure and survey-question templates — and the links between them.
            </div>
          </div>
          {/*
            Edit mode + New buttons live in the tabs row below (not here).
            This top-right area is reserved for global help / notification
            chrome that the shell layers on top; placing actionable buttons
            here caused visual overlap.
          */}
        </div>
        {error && (
          <div className="mt-3 text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}
        <nav className="flex items-center gap-1 mt-3 pb-2">
          <TabBtn active={tab === 'asset'} onClick={() => onTabChange('asset')}>Assets</TabBtn>
          <TabBtn active={tab === 'threat'} onClick={() => onTabChange('threat')}>Threats</TabBtn>
          <TabBtn active={tab === 'cm'} onClick={() => onTabChange('cm')}>Countermeasures</TabBtn>
          <TabBtn active={tab === 'question'} onClick={() => onTabChange('question')}>Questions</TabBtn>
          {canManage && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className={[
                  'inline-flex items-center gap-1.5 text-[12px] font-medium rounded-r2 px-3 h-8 border transition-colors',
                  editMode
                    ? 'bg-a-50 border-a-300 text-a-700'
                    : 'bg-white border-n-200 text-n-700 hover:bg-n-75',
                ].join(' ')}
                aria-pressed={editMode}
                title={editMode ? 'Exit edit mode' : 'Enter edit mode'}
              >
                <Pencil className="w-3.5 h-3.5" />
                {editMode ? 'Editing' : 'Edit mode'}
              </button>
              {editMode && (
                <Btn2
                  variant="primary"
                  leading={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setCreating(tab)}
                >
                  New {tab === 'asset' ? 'asset' : tab === 'threat' ? 'threat' : tab === 'cm' ? 'countermeasure' : 'question'}
                </Btn2>
              )}
            </div>
          )}
        </nav>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <section className="flex-1 flex flex-col min-w-0 border-r border-n-150">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-n-150 bg-white shrink-0">
            <div className="relative flex-1 max-w-[320px]">
              <Search className="w-3.5 h-3.5 text-n-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-400 focus:outline-none"
              />
            </div>
            {tab !== 'question' && (
              <Select value={moduleFilter} onChange={setModuleFilter} className="min-w-[160px]">
                <option value="">All modules</option>
                {allModules.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            )}
            {tab === 'asset' && (
              <Select value={typeFilter} onChange={setTypeFilter} className="min-w-[140px]">
                <option value="">All types</option>
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
            {tab === 'threat' && (
              <Select value={typeFilter} onChange={setTypeFilter} className="min-w-[140px]">
                <option value="">All adversaries</option>
                {ADVERSARY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
            {tab === 'cm' && (
              <Select value={typeFilter} onChange={setTypeFilter} className="min-w-[140px]">
                <option value="">All categories</option>
                {SHAPE_CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
            {tab === 'question' && (
              <Select value={typeFilter} onChange={setTypeFilter} className="min-w-[140px]">
                <option value="">All evidence types</option>
                {SURVEY_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </Select>
            )}
            <div className="ml-auto text-[11px] font-mono text-n-500">
              {tab === 'asset' && `${filteredAssets.length} of ${data?.assets.length ?? 0}`}
              {tab === 'threat' && `${filteredThreats.length} of ${data?.threats.length ?? 0}`}
              {tab === 'cm' && `${filteredCms.length} of ${data?.cms.length ?? 0}`}
              {tab === 'question' && `${filteredQuestions.length} of ${data?.questions.length ?? 0}`}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-n-25">
            {loading && <div className="text-[12px] text-n-500 px-2">Loading…</div>}
            {!loading && tab === 'asset' && filteredAssets.length === 0 && (
              <div className="text-[12px] text-n-500 italic px-2">No asset templates match.</div>
            )}
            {!loading && tab === 'threat' && filteredThreats.length === 0 && (
              <div className="text-[12px] text-n-500 italic px-2">No threat templates match.</div>
            )}
            {!loading && tab === 'cm' && filteredCms.length === 0 && (
              <div className="text-[12px] text-n-500 italic px-2">No countermeasure templates match.</div>
            )}
            {!loading && tab === 'question' && filteredQuestions.length === 0 && (
              <div className="text-[12px] text-n-500 italic px-2">No survey questions match.</div>
            )}
            {tab === 'asset' && filteredAssets.map((r) => (
              <AssetListRow key={r.tpl.id} row={r} active={r.tpl.id === selectedId}
                links={data?.assetThreatLinks.get(r.tpl.id)?.length ?? 0}
                onClick={() => setSelectedId(r.tpl.id)} />
            ))}
            {tab === 'threat' && filteredThreats.map((r) => (
              <ThreatListRow key={r.tpl.id} row={r} active={r.tpl.id === selectedId}
                links={data?.threatCmLinks.get(r.tpl.id)?.length ?? 0}
                reverseLinks={data?.threatAssetReverse.get(r.tpl.id)?.length ?? 0}
                onClick={() => setSelectedId(r.tpl.id)} />
            ))}
            {tab === 'cm' && filteredCms.map((r) => (
              <CmListRow key={r.tpl.id} row={r} active={r.tpl.id === selectedId}
                reverseLinks={data?.cmThreatReverse.get(r.tpl.id)?.length ?? 0}
                onClick={() => setSelectedId(r.tpl.id)} />
            ))}
            {tab === 'question' && filteredQuestions.map((r) => (
              <QuestionListRow key={r.tpl.id} row={r} active={r.tpl.id === selectedId}
                onClick={() => setSelectedId(r.tpl.id)} />
            ))}
          </div>
        </section>

        <aside className="w-[480px] shrink-0 overflow-y-auto bg-white">
          {!sel && !creating && (
            <div className="p-6 text-[12.5px] text-n-500">
              Select a template on the left to view its details and linked entities.
            </div>
          )}
          {sel && sel.kind === 'asset' && data && (
            <AssetDetailPanel
              key={`asset-${sel.tpl.id}`}
              row={sel}
              data={data}
              editable={editableForSel}
              onChanged={refresh}
              onDeleted={() => { setSelectedId(null); void refresh(); }}
              setError={setError}
            />
          )}
          {sel && sel.kind === 'threat' && data && (
            <ThreatDetailPanel
              key={`threat-${sel.tpl.id}`}
              row={sel}
              data={data}
              editable={editableForSel}
              onChanged={refresh}
              onDeleted={() => { setSelectedId(null); void refresh(); }}
              setError={setError}
            />
          )}
          {sel && sel.kind === 'question' && data && (
            <QuestionDetailPanel
              key={`question-${sel.tpl.id}`}
              row={sel}
              editable={editableForSel}
              onChanged={refresh}
              onDeleted={() => { setSelectedId(null); void refresh(); }}
              setError={setError}
            />
          )}
          {sel && sel.kind === 'cm' && data && (
            <CmDetailPanel
              key={`cm-${sel.tpl.id}`}
              row={sel}
              data={data}
              editable={editableForSel}
              onChanged={refresh}
              onDeleted={() => { setSelectedId(null); void refresh(); }}
              setError={setError}
            />
          )}
        </aside>
      </div>

      {creating && (
        <CreateDrawer
          kind={creating}
          editableModules={editableModules}
          onCancel={() => setCreating(null)}
          onCreated={async (newId) => {
            setCreating(null);
            await refresh();
            setSelectedId(newId);
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

// ─── List rows ────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-8 px-3 text-[12.5px] font-medium rounded-r2 border-b-2 transition-colors',
        active ? 'border-a-500 text-a-700' : 'border-transparent text-n-600 hover:text-n-900',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Select({ value, onChange, children, className = '' }: {
  value: string; onChange: (v: string) => void; children: ReactNode; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none ${className}`}
    >
      {children}
    </select>
  );
}

function AssetListRow({ row, active, links, onClick }: {
  row: AssetRow; active: boolean; links: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-r2 border transition-colors',
        active ? 'bg-a-50 border-a-300' : 'bg-white border-n-150 hover:border-n-200',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-[13px] font-medium text-n-900 truncate">{row.tpl.name}</div>
          {row.module.isSystem && <Lock className="w-3 h-3 text-n-400 shrink-0" />}
        </div>
        <div className="text-[11px] font-mono text-n-500 truncate">
          {row.module.name} · {row.tpl.assetType} · c={row.tpl.defaultCriticality}
        </div>
      </div>
      <Pill variant="outline">
        <Link2 className="w-2.5 h-2.5" />
        {links}
      </Pill>
    </button>
  );
}

function ThreatListRow({ row, active, links, reverseLinks, onClick }: {
  row: ThreatRow; active: boolean; links: number; reverseLinks: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-r2 border transition-colors',
        active ? 'bg-a-50 border-a-300' : 'bg-white border-n-150 hover:border-n-200',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-[13px] font-medium text-n-900 truncate">{row.tpl.scenarioName}</div>
          {row.module.isSystem && <Lock className="w-3 h-3 text-n-400 shrink-0" />}
        </div>
        <div className="text-[11px] font-mono text-n-500 truncate">
          {row.module.name} · {row.tpl.adversaryType} · {row.tpl.actionType}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-mono text-n-500" title="Linked countermeasures">CM:{links}</span>
        <span className="text-[10px] font-mono text-n-500" title="Credible-for asset templates">A:{reverseLinks}</span>
      </div>
    </button>
  );
}

function CmListRow({ row, active, reverseLinks, onClick }: {
  row: CmRow; active: boolean; reverseLinks: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-r2 border transition-colors',
        active ? 'bg-a-50 border-a-300' : 'bg-white border-n-150 hover:border-n-200',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-[13px] font-medium text-n-900 truncate">{row.tpl.name}</div>
          {row.module.isSystem && <Lock className="w-3 h-3 text-n-400 shrink-0" />}
        </div>
        <div className="text-[11px] font-mono text-n-500 truncate">
          {row.module.name} · {row.tpl.shapeCategory} · {row.tpl.domain}
        </div>
      </div>
      <Pill variant="outline">
        <Link2 className="w-2.5 h-2.5" />
        {reverseLinks}
      </Pill>
    </button>
  );
}

// ─── Detail panels ────────────────────────────────────────

function PanelHeader({ title, subtitle, locked, editable, dirty, onSave, onDelete, onReset }: {
  title: string; subtitle: string;
  locked: boolean; editable: boolean; dirty: boolean;
  onSave: () => void; onDelete: () => void; onReset: () => void;
}) {
  return (
    <header className="px-5 py-4 border-b border-n-150 sticky top-0 bg-white z-10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-n-900 flex items-center gap-2">
            {title}
            {locked && <Lock className="w-3.5 h-3.5 text-n-400" />}
          </h2>
          <div className="text-[11px] font-mono text-n-500 mt-0.5 truncate">{subtitle}</div>
        </div>
        {editable && (
          <div className="flex items-center gap-1 shrink-0">
            {dirty && (
              <Btn2 variant="secondary" onClick={onReset} leading={<X className="w-3.5 h-3.5" />}>
                Reset
              </Btn2>
            )}
            <Btn2 variant="primary" onClick={onSave} leading={<Save className="w-3.5 h-3.5" />} disabled={!dirty}>
              Save
            </Btn2>
            <button
              type="button"
              onClick={onDelete}
              className="w-8 h-8 flex items-center justify-center text-bad hover:bg-bad-bg rounded-r2"
              aria-label="Delete"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">{label}</div>
      {children}
    </div>
  );
}

function Input({ value, onChange, disabled, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={[
        'w-full h-8 px-2.5 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none',
        disabled ? 'bg-n-50 text-n-700 cursor-default' : '',
        className,
      ].join(' ')}
    />
  );
}

function Textarea({ value, onChange, disabled, rows = 3 }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={rows}
      className={[
        'w-full px-2.5 py-1.5 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none resize-y',
        disabled ? 'bg-n-50 text-n-700 cursor-default' : '',
      ].join(' ')}
    />
  );
}

function NumberInput({ value, onChange, disabled, min, max }: {
  value: number | null; onChange: (v: number | null) => void; disabled?: boolean; min?: number; max?: number;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : Number(v));
      }}
      disabled={disabled}
      min={min}
      max={max}
      className={[
        'w-full h-8 px-2.5 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none',
        disabled ? 'bg-n-50 text-n-700 cursor-default' : '',
      ].join(' ')}
    />
  );
}

function TagsEditor({ values, onChange, disabled }: {
  values: string[]; onChange: (v: string[]) => void; disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-1">
      {values.map((t, i) => (
        <span key={`${t}-${i}`} className="inline-flex items-center gap-1 px-1.5 py-px text-[10.5px] bg-n-100 text-n-700 rounded-[3px]">
          {t}
          {!disabled && (
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-n-500 hover:text-n-900" aria-label={`Remove ${t}`}>
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              onChange([...values, draft.trim()]);
              setDraft('');
            }
          }}
          placeholder="add…"
          className="h-6 px-1.5 text-[11px] border border-n-200 rounded-[3px] bg-white focus:border-a-400 focus:outline-none"
        />
      )}
    </div>
  );
}

function MultiSelect<T extends string>({ options, values, onChange, disabled }: {
  options: T[]; values: T[]; onChange: (v: T[]) => void; disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const on = values.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(on ? values.filter((v) => v !== opt) : [...values, opt])}
            className={[
              'px-1.5 py-0.5 text-[10.5px] rounded-[3px] border transition-colors',
              on ? 'bg-a-50 border-a-300 text-a-700' : 'bg-white border-n-200 text-n-600',
              disabled ? 'cursor-default' : 'hover:border-a-300',
            ].join(' ')}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Asset detail panel ──

function AssetDetailPanel({ row, data, editable, onChanged, onDeleted, setError }: {
  row: AssetRow; data: CombinedData; editable: boolean;
  onChanged: () => Promise<void>; onDeleted: () => void;
  setError: (e: string | null) => void;
}) {
  const [draft, setDraft] = useState(() => assetDraftFromTpl(row.tpl));
  useEffect(() => { setDraft(assetDraftFromTpl(row.tpl)); }, [row.tpl]);
  const dirty = useMemo(() => !assetDraftEquals(draft, row.tpl), [draft, row.tpl]);

  async function save() {
    try {
      const update: AdminAssetTemplateUpdateInput = {
        name: draft.name,
        slug: draft.slug,
        assetType: draft.assetType,
        category: draft.category,
        defaultCriticality: draft.defaultCriticality,
        defaultAssetRole: draft.defaultAssetRole,
        description: draft.description || null,
        tags: draft.tags,
      };
      await adminTemplatesApi.updateAssetTemplate(row.tpl.id, update);
      await onChanged();
    } catch (err) { setError(await extractError(err)); }
  }

  async function remove() {
    if (!window.confirm(`Delete asset template "${row.tpl.name}"?`)) return;
    try {
      await adminTemplatesApi.removeAssetTemplate(row.tpl.id);
      onDeleted();
    } catch (err) { setError(await extractError(err)); }
  }

  const linkedThreats = data.assetThreatLinks.get(row.tpl.id) ?? [];
  const editableModules = useMemo(
    () => Array.from(data.modulesById.values()).filter((m) => !m.isSystem)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [data.modulesById],
  );

  return (
    <div>
      <PanelHeader
        title={row.tpl.name}
        subtitle={`${row.module.packageName} · ${row.module.name} · ${row.tpl.slug}`}
        locked={row.module.isSystem}
        editable={editable}
        dirty={dirty}
        onSave={save}
        onDelete={remove}
        onReset={() => setDraft(assetDraftFromTpl(row.tpl))}
      />
      <div className="p-5 space-y-4">
        <Field label="Name">
          <Input value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} disabled={!editable} />
        </Field>
        <Field label="Slug">
          <Input value={draft.slug} onChange={(v) => setDraft({ ...draft, slug: v })} disabled={!editable} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset type">
            <select value={draft.assetType} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, assetType: e.target.value as AssetType })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select value={draft.category} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as AssetCategory })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              {ASSET_CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Criticality (1–5)">
            <NumberInput value={draft.defaultCriticality} onChange={(v) => setDraft({ ...draft, defaultCriticality: v ?? 3 })}
              disabled={!editable} min={1} max={5} />
          </Field>
          <Field label="Default role">
            <select value={draft.defaultAssetRole ?? ''} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, defaultAssetRole: (e.target.value || null) as AssetRole | null })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              <option value="">—</option>
              {ASSET_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} disabled={!editable} />
        </Field>
        <Field label="Tags">
          <TagsEditor values={draft.tags} onChange={(v) => setDraft({ ...draft, tags: v })} disabled={!editable} />
        </Field>

        <LinkedThreatsSection
          assetTemplateId={row.tpl.id}
          linkedThreats={linkedThreats}
          allThreats={data.threats}
          editable={editable}
          editableModules={editableModules}
          onChanged={onChanged}
          setError={setError}
        />

        <LinkedQuestionsSection
          kind="asset"
          templateId={row.tpl.id}
          editable={editable}
          setError={setError}
        />
      </div>
    </div>
  );
}

interface AssetDraft {
  name: string; slug: string; assetType: AssetType; category: AssetCategory;
  defaultCriticality: number; defaultAssetRole: AssetRole | null;
  description: string; tags: string[];
}

function assetDraftFromTpl(t: AdminAssetTemplate): AssetDraft {
  return {
    name: t.name, slug: t.slug, assetType: t.assetType, category: t.category,
    defaultCriticality: t.defaultCriticality, defaultAssetRole: t.defaultAssetRole,
    description: t.description ?? '', tags: t.tags,
  };
}

function assetDraftEquals(d: AssetDraft, t: AdminAssetTemplate) {
  return d.name === t.name && d.slug === t.slug && d.assetType === t.assetType
    && d.category === t.category && d.defaultCriticality === t.defaultCriticality
    && d.defaultAssetRole === t.defaultAssetRole
    && d.description === (t.description ?? '')
    && d.tags.length === t.tags.length && d.tags.every((x, i) => x === t.tags[i]);
}

// ── Threat detail panel ──

function ThreatDetailPanel({ row, data, editable, onChanged, onDeleted, setError }: {
  row: ThreatRow; data: CombinedData; editable: boolean;
  onChanged: () => Promise<void>; onDeleted: () => void;
  setError: (e: string | null) => void;
}) {
  const [draft, setDraft] = useState(() => threatDraftFromTpl(row.tpl));
  useEffect(() => { setDraft(threatDraftFromTpl(row.tpl)); }, [row.tpl]);
  const dirty = useMemo(() => !threatDraftEquals(draft, row.tpl), [draft, row.tpl]);

  async function save() {
    try {
      const update: AdminThreatTemplateUpdateInput = {
        scenarioName: draft.scenarioName, slug: draft.slug,
        adversaryType: draft.adversaryType, actionType: draft.actionType,
        targetAssetTypes: draft.targetAssetTypes, indicators: draft.indicators,
        typicalActions: draft.typicalActions,
        suggestedLikelihood: draft.suggestedLikelihood,
      };
      await adminTemplatesApi.updateThreatTemplate(row.tpl.id, update);
      await onChanged();
    } catch (err) { setError(await extractError(err)); }
  }

  async function remove() {
    if (!window.confirm(`Delete threat template "${row.tpl.scenarioName}"?`)) return;
    try {
      await adminTemplatesApi.removeThreatTemplate(row.tpl.id);
      onDeleted();
    } catch (err) { setError(await extractError(err)); }
  }

  const linkedCms = data.threatCmLinks.get(row.tpl.id) ?? [];
  const reverseAssets = data.threatAssetReverse.get(row.tpl.id) ?? [];
  const editableModules = useMemo(
    () => Array.from(data.modulesById.values()).filter((m) => !m.isSystem)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [data.modulesById],
  );

  return (
    <div>
      <PanelHeader
        title={row.tpl.scenarioName}
        subtitle={`${row.module.packageName} · ${row.module.name} · ${row.tpl.slug}`}
        locked={row.module.isSystem}
        editable={editable}
        dirty={dirty}
        onSave={save}
        onDelete={remove}
        onReset={() => setDraft(threatDraftFromTpl(row.tpl))}
      />
      <div className="p-5 space-y-4">
        <Field label="Scenario name">
          <Input value={draft.scenarioName} onChange={(v) => setDraft({ ...draft, scenarioName: v })} disabled={!editable} />
        </Field>
        <Field label="Slug">
          <Input value={draft.slug} onChange={(v) => setDraft({ ...draft, slug: v })} disabled={!editable} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adversary type">
            <select value={draft.adversaryType} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, adversaryType: e.target.value as AdversaryType })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              {ADVERSARY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Action type">
            <select value={draft.actionType} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, actionType: e.target.value as ActionType })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Target asset types">
          <MultiSelect options={ASSET_TYPES} values={draft.targetAssetTypes as AssetType[]}
            onChange={(v) => setDraft({ ...draft, targetAssetTypes: v })} disabled={!editable} />
        </Field>
        <Field label="Suggested likelihood (1–5)">
          <NumberInput value={draft.suggestedLikelihood} onChange={(v) => setDraft({ ...draft, suggestedLikelihood: v })}
            disabled={!editable} min={1} max={5} />
        </Field>
        <Field label="Typical actions">
          <TagsEditor values={draft.typicalActions} onChange={(v) => setDraft({ ...draft, typicalActions: v })} disabled={!editable} />
        </Field>
        <Field label="Indicators">
          <TagsEditor values={draft.indicators} onChange={(v) => setDraft({ ...draft, indicators: v })} disabled={!editable} />
        </Field>

        <LinkedCountermeasuresSection
          threatTemplateId={row.tpl.id}
          linkedCms={linkedCms}
          allCms={data.cms}
          editable={editable}
          editableModules={editableModules}
          onChanged={onChanged}
          setError={setError}
        />

        <ReverseAssetLinksSection
          threatTemplateId={row.tpl.id}
          reverseAssets={reverseAssets}
          allAssets={data.assets}
          editable={editable}
          editableModules={editableModules}
          onChanged={onChanged}
          setError={setError}
        />

        <LinkedQuestionsSection
          kind="threat"
          templateId={row.tpl.id}
          editable={editable}
          setError={setError}
        />
      </div>
    </div>
  );
}

interface ThreatDraft {
  scenarioName: string; slug: string;
  adversaryType: AdversaryType; actionType: ActionType;
  targetAssetTypes: string[]; indicators: string[]; typicalActions: string[];
  suggestedLikelihood: number | null;
}

function threatDraftFromTpl(t: AdminThreatTemplate): ThreatDraft {
  return {
    scenarioName: t.scenarioName, slug: t.slug,
    adversaryType: t.adversaryType, actionType: t.actionType,
    targetAssetTypes: t.targetAssetTypes, indicators: t.indicators,
    typicalActions: t.typicalActions, suggestedLikelihood: t.suggestedLikelihood,
  };
}

function arrEq(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function threatDraftEquals(d: ThreatDraft, t: AdminThreatTemplate) {
  return d.scenarioName === t.scenarioName && d.slug === t.slug
    && d.adversaryType === t.adversaryType && d.actionType === t.actionType
    && arrEq(d.targetAssetTypes, t.targetAssetTypes)
    && arrEq(d.indicators, t.indicators)
    && arrEq(d.typicalActions, t.typicalActions)
    && d.suggestedLikelihood === t.suggestedLikelihood;
}

// ── Countermeasure detail panel ──

function CmDetailPanel({ row, data, editable, onChanged, onDeleted, setError }: {
  row: CmRow; data: CombinedData; editable: boolean;
  onChanged: () => Promise<void>; onDeleted: () => void;
  setError: (e: string | null) => void;
}) {
  const [draft, setDraft] = useState(() => cmDraftFromTpl(row.tpl));
  useEffect(() => { setDraft(cmDraftFromTpl(row.tpl)); }, [row.tpl]);
  const dirty = useMemo(() => !cmDraftEquals(draft, row.tpl), [draft, row.tpl]);

  async function save() {
    try {
      const update: AdminCountermeasureTemplateUpdateInput = {
        name: draft.name, slug: draft.slug,
        description: draft.description || null,
        shapeCategory: draft.shapeCategory, ppsFunctions: draft.ppsFunctions,
        domain: draft.domain,
        defaultTearStrategy: draft.defaultTearStrategy,
        defaultEffectiveness: draft.defaultEffectiveness,
        typicalCostEstimate: draft.typicalCostEstimate,
        typicalAnnualCost: draft.typicalAnnualCost,
        tags: draft.tags,
      };
      await adminTemplatesApi.updateCountermeasureTemplate(row.tpl.id, update);
      await onChanged();
    } catch (err) { setError(await extractError(err)); }
  }

  async function remove() {
    if (!window.confirm(`Delete countermeasure template "${row.tpl.name}"?`)) return;
    try {
      await adminTemplatesApi.removeCountermeasureTemplate(row.tpl.id);
      onDeleted();
    } catch (err) { setError(await extractError(err)); }
  }

  const reverseThreats = data.cmThreatReverse.get(row.tpl.id) ?? [];
  const editableModules = useMemo(
    () => Array.from(data.modulesById.values()).filter((m) => !m.isSystem)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [data.modulesById],
  );

  return (
    <div>
      <PanelHeader
        title={row.tpl.name}
        subtitle={`${row.module.packageName} · ${row.module.name} · ${row.tpl.slug}`}
        locked={row.module.isSystem}
        editable={editable}
        dirty={dirty}
        onSave={save}
        onDelete={remove}
        onReset={() => setDraft(cmDraftFromTpl(row.tpl))}
      />
      <div className="p-5 space-y-4">
        <Field label="Name">
          <Input value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} disabled={!editable} />
        </Field>
        <Field label="Slug">
          <Input value={draft.slug} onChange={(v) => setDraft({ ...draft, slug: v })} disabled={!editable} />
        </Field>
        <Field label="Description">
          <Textarea value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} disabled={!editable} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SHAPE category">
            <select value={draft.shapeCategory} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, shapeCategory: e.target.value as ShapeCategory })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              {SHAPE_CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Domain">
            <select value={draft.domain} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, domain: e.target.value as ProtectionDomain })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              {PROTECTION_DOMAINS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="PPS functions">
          <MultiSelect options={PPS_FUNCTIONS} values={draft.ppsFunctions}
            onChange={(v) => setDraft({ ...draft, ppsFunctions: v as PpsFunction[] })} disabled={!editable} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default TEAR strategy">
            <select value={draft.defaultTearStrategy ?? ''} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, defaultTearStrategy: (e.target.value || null) as TearStrategy | null })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              <option value="">—</option>
              {TEAR_STRATEGIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Default effectiveness">
            <select value={draft.defaultEffectiveness ?? ''} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, defaultEffectiveness: (e.target.value || null) as VulnerabilityRating | null })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              <option value="">—</option>
              {VULNERABILITY_RATINGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Typical CAPEX">
            <NumberInput value={draft.typicalCostEstimate} onChange={(v) => setDraft({ ...draft, typicalCostEstimate: v })}
              disabled={!editable} />
          </Field>
          <Field label="Typical OPEX/yr">
            <NumberInput value={draft.typicalAnnualCost} onChange={(v) => setDraft({ ...draft, typicalAnnualCost: v })}
              disabled={!editable} />
          </Field>
        </div>
        <Field label="Tags">
          <TagsEditor values={draft.tags} onChange={(v) => setDraft({ ...draft, tags: v })} disabled={!editable} />
        </Field>

        <ReverseThreatLinksSection
          countermeasureTemplateId={row.tpl.id}
          reverseThreats={reverseThreats}
          allThreats={data.threats}
          editable={editable}
          editableModules={editableModules}
          onChanged={onChanged}
          setError={setError}
        />

        <LinkedQuestionsSection
          kind="cm"
          templateId={row.tpl.id}
          editable={editable}
          setError={setError}
        />
      </div>
    </div>
  );
}

interface CmDraft {
  name: string; slug: string; description: string;
  shapeCategory: ShapeCategory; ppsFunctions: PpsFunction[]; domain: ProtectionDomain;
  defaultTearStrategy: TearStrategy | null; defaultEffectiveness: VulnerabilityRating | null;
  typicalCostEstimate: number | null; typicalAnnualCost: number | null;
  tags: string[];
}

function cmDraftFromTpl(t: AdminCountermeasureTemplate): CmDraft {
  return {
    name: t.name, slug: t.slug, description: t.description ?? '',
    shapeCategory: t.shapeCategory, ppsFunctions: t.ppsFunctions, domain: t.domain,
    defaultTearStrategy: t.defaultTearStrategy, defaultEffectiveness: t.defaultEffectiveness,
    typicalCostEstimate: t.typicalCostEstimate, typicalAnnualCost: t.typicalAnnualCost,
    tags: t.tags,
  };
}

function ppsEq(a: PpsFunction[], b: PpsFunction[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function cmDraftEquals(d: CmDraft, t: AdminCountermeasureTemplate) {
  return d.name === t.name && d.slug === t.slug
    && d.description === (t.description ?? '')
    && d.shapeCategory === t.shapeCategory
    && ppsEq(d.ppsFunctions, t.ppsFunctions)
    && d.domain === t.domain
    && d.defaultTearStrategy === t.defaultTearStrategy
    && d.defaultEffectiveness === t.defaultEffectiveness
    && d.typicalCostEstimate === t.typicalCostEstimate
    && d.typicalAnnualCost === t.typicalAnnualCost
    && arrEq(d.tags, t.tags);
}

// ─── Link editors ─────────────────────────────────────────

function LinkedThreatsSection({ assetTemplateId, linkedThreats, allThreats, editable, editableModules, onChanged, setError }: {
  assetTemplateId: string;
  linkedThreats: Array<{ threatTemplateId: string; relevance: Relevance; rationale: string | null }>;
  allThreats: ThreatRow[];
  editable: boolean;
  editableModules: ModuleRef[];
  onChanged: () => Promise<void>;
  setError: (e: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [creatingNew, setCreatingNew] = useState<{ name: string; rel: Relevance; rat: string | null } | null>(null);
  return (
    <SubsectionCard
      title="Credible threats"
      count={linkedThreats.length}
      action={editable && !adding ? (
        <Btn2 variant="secondary" leading={<Plus className="w-3.5 h-3.5" />} onClick={() => setAdding(true)}>
          Link threat
        </Btn2>
      ) : null}
    >
      {linkedThreats.length === 0 && !adding && (
        <div className="text-[12px] text-n-500 italic">No linked threats.</div>
      )}
      <div className="space-y-1.5">
        {linkedThreats.map((link) => {
          const tpl = allThreats.find((r) => r.tpl.id === link.threatTemplateId);
          if (!tpl) return null;
          return (
            <LinkRow
              key={link.threatTemplateId}
              title={tpl.tpl.scenarioName}
              subtitle={`${tpl.tpl.adversaryType} · ${tpl.tpl.actionType}`}
              relevance={link.relevance}
              rationale={link.rationale}
              editable={editable}
              onSave={async (rel, rat) => {
                try {
                  await adminTemplatesApi.upsertAssetThreatLink(assetTemplateId, link.threatTemplateId, {
                    relevance: rel, rationale: rat,
                  });
                  await onChanged();
                } catch (err) { setError(await extractError(err)); }
              }}
              onRemove={async () => {
                try {
                  await adminTemplatesApi.removeAssetThreatLink(assetTemplateId, link.threatTemplateId);
                  await onChanged();
                } catch (err) { setError(await extractError(err)); }
              }}
            />
          );
        })}
      </div>
      {adding && (
        <AddLinkPanel
          targetLabel="threat"
          options={allThreats
            .filter((r) => !linkedThreats.some((l) => l.threatTemplateId === r.tpl.id))
            .map((r) => ({ id: r.tpl.id, label: r.tpl.scenarioName, sub: `${r.module.name} · ${r.tpl.adversaryType}` }))}
          onCancel={() => setAdding(false)}
          onAdd={async (id, rel, rat) => {
            try {
              await adminTemplatesApi.upsertAssetThreatLink(assetTemplateId, id, { relevance: rel, rationale: rat });
              setAdding(false);
              await onChanged();
            } catch (err) { setError(await extractError(err)); }
          }}
          onCreateNew={(name, rel, rat) => setCreatingNew({ name, rel, rat })}
        />
      )}
      {creatingNew && (
        <CreateDrawer
          kind="threat"
          editableModules={editableModules}
          initialName={creatingNew.name}
          onCancel={() => setCreatingNew(null)}
          afterCreate={async (newId) => {
            await adminTemplatesApi.upsertAssetThreatLink(assetTemplateId, newId, {
              relevance: creatingNew.rel,
              rationale: creatingNew.rat,
            });
          }}
          onCreated={async () => {
            setCreatingNew(null);
            setAdding(false);
            await onChanged();
          }}
          setError={setError}
        />
      )}
    </SubsectionCard>
  );
}

function LinkedCountermeasuresSection({ threatTemplateId, linkedCms, allCms, editable, editableModules, onChanged, setError }: {
  threatTemplateId: string;
  linkedCms: Array<{ countermeasureTemplateId: string; relevance: Relevance; rationale: string | null }>;
  allCms: CmRow[];
  editable: boolean;
  editableModules: ModuleRef[];
  onChanged: () => Promise<void>;
  setError: (e: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [creatingNew, setCreatingNew] = useState<{ name: string; rel: Relevance; rat: string | null } | null>(null);
  return (
    <SubsectionCard
      title="Recommended countermeasures"
      count={linkedCms.length}
      action={editable && !adding ? (
        <Btn2 variant="secondary" leading={<Plus className="w-3.5 h-3.5" />} onClick={() => setAdding(true)}>
          Link countermeasure
        </Btn2>
      ) : null}
    >
      {linkedCms.length === 0 && !adding && (
        <div className="text-[12px] text-n-500 italic">No linked countermeasures.</div>
      )}
      <div className="space-y-1.5">
        {linkedCms.map((link) => {
          const tpl = allCms.find((r) => r.tpl.id === link.countermeasureTemplateId);
          if (!tpl) return null;
          return (
            <LinkRow
              key={link.countermeasureTemplateId}
              title={tpl.tpl.name}
              subtitle={`${tpl.tpl.shapeCategory} · ${tpl.tpl.domain}`}
              relevance={link.relevance}
              rationale={link.rationale}
              editable={editable}
              onSave={async (rel, rat) => {
                try {
                  await adminTemplatesApi.upsertThreatCountermeasureLink(threatTemplateId, link.countermeasureTemplateId, {
                    relevance: rel, rationale: rat,
                  });
                  await onChanged();
                } catch (err) { setError(await extractError(err)); }
              }}
              onRemove={async () => {
                try {
                  await adminTemplatesApi.removeThreatCountermeasureLink(threatTemplateId, link.countermeasureTemplateId);
                  await onChanged();
                } catch (err) { setError(await extractError(err)); }
              }}
            />
          );
        })}
      </div>
      {adding && (
        <AddLinkPanel
          targetLabel="countermeasure"
          options={allCms
            .filter((r) => !linkedCms.some((l) => l.countermeasureTemplateId === r.tpl.id))
            .map((r) => ({ id: r.tpl.id, label: r.tpl.name, sub: `${r.module.name} · ${r.tpl.shapeCategory}` }))}
          onCancel={() => setAdding(false)}
          onAdd={async (id, rel, rat) => {
            try {
              await adminTemplatesApi.upsertThreatCountermeasureLink(threatTemplateId, id, { relevance: rel, rationale: rat });
              setAdding(false);
              await onChanged();
            } catch (err) { setError(await extractError(err)); }
          }}
          onCreateNew={(name, rel, rat) => setCreatingNew({ name, rel, rat })}
        />
      )}
      {creatingNew && (
        <CreateDrawer
          kind="cm"
          editableModules={editableModules}
          initialName={creatingNew.name}
          onCancel={() => setCreatingNew(null)}
          afterCreate={async (newId) => {
            await adminTemplatesApi.upsertThreatCountermeasureLink(threatTemplateId, newId, {
              relevance: creatingNew.rel,
              rationale: creatingNew.rat,
            });
          }}
          onCreated={async () => {
            setCreatingNew(null);
            setAdding(false);
            await onChanged();
          }}
          setError={setError}
        />
      )}
    </SubsectionCard>
  );
}

function ReverseAssetLinksSection({ threatTemplateId, reverseAssets, allAssets, editable, editableModules, onChanged, setError }: {
  threatTemplateId: string;
  reverseAssets: Array<{ assetTemplateId: string; relevance: Relevance; rationale: string | null }>;
  allAssets: AssetRow[];
  editable: boolean;
  editableModules: ModuleRef[];
  onChanged: () => Promise<void>;
  setError: (e: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [creatingNew, setCreatingNew] = useState<{ name: string; rel: Relevance; rat: string | null } | null>(null);
  return (
    <SubsectionCard
      title="Credible-for asset templates"
      count={reverseAssets.length}
      action={editable && !adding ? (
        <Btn2 variant="secondary" leading={<Plus className="w-3.5 h-3.5" />} onClick={() => setAdding(true)}>
          Link asset
        </Btn2>
      ) : null}
    >
      {reverseAssets.length === 0 && !adding && (
        <div className="text-[12px] text-n-500 italic">No assets list this threat as credible.</div>
      )}
      <div className="space-y-1.5">
        {reverseAssets.map((link) => {
          const tpl = allAssets.find((r) => r.tpl.id === link.assetTemplateId);
          if (!tpl) return null;
          return (
            <LinkRow
              key={link.assetTemplateId}
              title={tpl.tpl.name}
              subtitle={`${tpl.tpl.assetType} · c=${tpl.tpl.defaultCriticality}`}
              relevance={link.relevance}
              rationale={link.rationale}
              editable={editable}
              onSave={async (rel, rat) => {
                try {
                  await adminTemplatesApi.upsertAssetThreatLink(link.assetTemplateId, threatTemplateId, {
                    relevance: rel, rationale: rat,
                  });
                  await onChanged();
                } catch (err) { setError(await extractError(err)); }
              }}
              onRemove={async () => {
                try {
                  await adminTemplatesApi.removeAssetThreatLink(link.assetTemplateId, threatTemplateId);
                  await onChanged();
                } catch (err) { setError(await extractError(err)); }
              }}
            />
          );
        })}
      </div>
      {adding && (
        <AddLinkPanel
          targetLabel="asset"
          options={allAssets
            .filter((r) => !reverseAssets.some((l) => l.assetTemplateId === r.tpl.id))
            .map((r) => ({ id: r.tpl.id, label: r.tpl.name, sub: `${r.module.name} · ${r.tpl.assetType}` }))}
          onCancel={() => setAdding(false)}
          onAdd={async (id, rel, rat) => {
            try {
              await adminTemplatesApi.upsertAssetThreatLink(id, threatTemplateId, { relevance: rel, rationale: rat });
              setAdding(false);
              await onChanged();
            } catch (err) { setError(await extractError(err)); }
          }}
          onCreateNew={(name, rel, rat) => setCreatingNew({ name, rel, rat })}
        />
      )}
      {creatingNew && (
        <CreateDrawer
          kind="asset"
          editableModules={editableModules}
          initialName={creatingNew.name}
          onCancel={() => setCreatingNew(null)}
          afterCreate={async (newId) => {
            await adminTemplatesApi.upsertAssetThreatLink(newId, threatTemplateId, {
              relevance: creatingNew.rel,
              rationale: creatingNew.rat,
            });
          }}
          onCreated={async () => {
            setCreatingNew(null);
            setAdding(false);
            await onChanged();
          }}
          setError={setError}
        />
      )}
    </SubsectionCard>
  );
}

function ReverseThreatLinksSection({ countermeasureTemplateId, reverseThreats, allThreats, editable, editableModules, onChanged, setError }: {
  countermeasureTemplateId: string;
  reverseThreats: Array<{ threatTemplateId: string; relevance: Relevance; rationale: string | null }>;
  allThreats: ThreatRow[];
  editable: boolean;
  editableModules: ModuleRef[];
  onChanged: () => Promise<void>;
  setError: (e: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [creatingNew, setCreatingNew] = useState<{ name: string; rel: Relevance; rat: string | null } | null>(null);
  return (
    <SubsectionCard
      title="Mitigates threats"
      count={reverseThreats.length}
      action={editable && !adding ? (
        <Btn2 variant="secondary" leading={<Plus className="w-3.5 h-3.5" />} onClick={() => setAdding(true)}>
          Link threat
        </Btn2>
      ) : null}
    >
      {reverseThreats.length === 0 && !adding && (
        <div className="text-[12px] text-n-500 italic">No threats listed.</div>
      )}
      <div className="space-y-1.5">
        {reverseThreats.map((link) => {
          const tpl = allThreats.find((r) => r.tpl.id === link.threatTemplateId);
          if (!tpl) return null;
          return (
            <LinkRow
              key={link.threatTemplateId}
              title={tpl.tpl.scenarioName}
              subtitle={`${tpl.tpl.adversaryType} · ${tpl.tpl.actionType}`}
              relevance={link.relevance}
              rationale={link.rationale}
              editable={editable}
              onSave={async (rel, rat) => {
                try {
                  await adminTemplatesApi.upsertThreatCountermeasureLink(link.threatTemplateId, countermeasureTemplateId, {
                    relevance: rel, rationale: rat,
                  });
                  await onChanged();
                } catch (err) { setError(await extractError(err)); }
              }}
              onRemove={async () => {
                try {
                  await adminTemplatesApi.removeThreatCountermeasureLink(link.threatTemplateId, countermeasureTemplateId);
                  await onChanged();
                } catch (err) { setError(await extractError(err)); }
              }}
            />
          );
        })}
      </div>
      {adding && (
        <AddLinkPanel
          targetLabel="threat"
          options={allThreats
            .filter((r) => !reverseThreats.some((l) => l.threatTemplateId === r.tpl.id))
            .map((r) => ({ id: r.tpl.id, label: r.tpl.scenarioName, sub: `${r.module.name} · ${r.tpl.adversaryType}` }))}
          onCancel={() => setAdding(false)}
          onAdd={async (id, rel, rat) => {
            try {
              await adminTemplatesApi.upsertThreatCountermeasureLink(id, countermeasureTemplateId, { relevance: rel, rationale: rat });
              setAdding(false);
              await onChanged();
            } catch (err) { setError(await extractError(err)); }
          }}
          onCreateNew={(name, rel, rat) => setCreatingNew({ name, rel, rat })}
        />
      )}
      {creatingNew && (
        <CreateDrawer
          kind="threat"
          editableModules={editableModules}
          initialName={creatingNew.name}
          onCancel={() => setCreatingNew(null)}
          afterCreate={async (newId) => {
            await adminTemplatesApi.upsertThreatCountermeasureLink(newId, countermeasureTemplateId, {
              relevance: creatingNew.rel,
              rationale: creatingNew.rat,
            });
          }}
          onCreated={async () => {
            setCreatingNew(null);
            setAdding(false);
            await onChanged();
          }}
          setError={setError}
        />
      )}
    </SubsectionCard>
  );
}

function LinkRow({ title, subtitle, relevance, rationale, editable, onSave, onRemove }: {
  title: string; subtitle: string;
  relevance: Relevance; rationale: string | null;
  editable: boolean;
  onSave: (rel: Relevance, rat: string | null) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [rel, setRel] = useState<Relevance>(relevance);
  const [rat, setRat] = useState<string>(rationale ?? '');
  useEffect(() => { setRel(relevance); setRat(rationale ?? ''); }, [relevance, rationale]);

  return (
    <div className="border border-n-150 rounded-r2 bg-white">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-n-800 truncate">{title}</div>
          <div className="text-[11px] font-mono text-n-500 truncate">{subtitle}</div>
        </div>
        <Pill variant={relevance === 'HIGH' ? 'bad' : relevance === 'MEDIUM' ? 'warn' : 'default'}>
          {relevance}
        </Pill>
        {editable && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={() => setEditing((v) => !v)}
              className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
              title="Edit relevance / rationale">
              <Pencil className="w-3 h-3" />
            </button>
            <button type="button" onClick={onRemove}
              className="w-7 h-7 flex items-center justify-center text-bad hover:bg-bad-bg rounded-r1"
              title="Remove link">
              <Unlink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {editing && editable && (
        <div className="border-t border-n-150 px-2.5 py-2 space-y-2 bg-n-25">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px]">Relevance:</span>
            {RELEVANCES.map((r) => (
              <button key={r} type="button" onClick={() => setRel(r)}
                className={[
                  'px-1.5 py-0.5 text-[10.5px] rounded-[3px] border',
                  rel === r ? 'bg-a-50 border-a-300 text-a-700' : 'bg-white border-n-200 text-n-600',
                ].join(' ')}>
                {r}
              </button>
            ))}
          </div>
          <Textarea value={rat} onChange={setRat} rows={2} />
          <div className="flex justify-end gap-1.5">
            <Btn2 variant="secondary" onClick={() => { setRel(relevance); setRat(rationale ?? ''); setEditing(false); }}>
              Cancel
            </Btn2>
            <Btn2 variant="primary" onClick={async () => { await onSave(rel, rat || null); setEditing(false); }}>
              Save
            </Btn2>
          </div>
        </div>
      )}
      {!editing && rationale && (
        <div className="border-t border-n-150 px-2.5 py-1.5 text-[11.5px] text-n-700 bg-n-25">{rationale}</div>
      )}
    </div>
  );
}

function AddLinkPanel({ targetLabel, options, onCancel, onAdd, onCreateNew }: {
  targetLabel: string;
  options: Array<{ id: string; label: string; sub: string }>;
  onCancel: () => void;
  onAdd: (id: string, rel: Relevance, rat: string | null) => Promise<void>;
  /** When set, render a "+ Create new {targetLabel}" button that hands the
   *  current search text + relevance + rationale up to the parent so it can
   *  open a CreateDrawer and auto-link the new item on success. */
  onCreateNew?: (initialName: string, rel: Relevance, rat: string | null) => void;
}) {
  const [pickedId, setPickedId] = useState<string>('');
  const [rel, setRel] = useState<Relevance>('MEDIUM');
  const [rat, setRat] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sub.toLowerCase().includes(q)).slice(0, 50);
  }, [options, search]);

  return (
    <div className="mt-2 border border-a-200 rounded-r2 bg-a-50/40 p-3 space-y-2">
      <div className="text-[11px] font-mono uppercase text-a-700 tracking-[0.4px]">Link a {targetLabel}</div>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-n-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${targetLabel} templates…`}
          className="w-full h-8 pl-8 pr-3 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none" />
      </div>
      <div className="max-h-[180px] overflow-y-auto space-y-1 border border-n-150 rounded-r2 bg-white p-1">
        {filtered.length === 0 && (
          <div className="text-[11.5px] text-n-500 italic px-2 py-1">No matching templates.</div>
        )}
        {filtered.map((o) => (
          <button key={o.id} type="button" onClick={() => setPickedId(o.id)}
            className={[
              'w-full text-left px-2 py-1.5 rounded-r1 text-[12px]',
              pickedId === o.id ? 'bg-a-50 text-a-800' : 'hover:bg-n-50 text-n-800',
            ].join(' ')}>
            <div className="font-medium truncate">{o.label}</div>
            <div className="text-[10.5px] font-mono text-n-500 truncate">{o.sub}</div>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px]">Relevance:</span>
        {RELEVANCES.map((r) => (
          <button key={r} type="button" onClick={() => setRel(r)}
            className={[
              'px-1.5 py-0.5 text-[10.5px] rounded-[3px] border',
              rel === r ? 'bg-a-50 border-a-300 text-a-700' : 'bg-white border-n-200 text-n-600',
            ].join(' ')}>
            {r}
          </button>
        ))}
      </div>
      <Field label="Rationale (optional)">
        <Textarea value={rat} onChange={setRat} rows={2} />
      </Field>
      <div className="flex items-center justify-end gap-1.5">
        {onCreateNew && (
          <Btn2
            variant="ghost"
            leading={<Plus className="w-3.5 h-3.5" />}
            onClick={() => onCreateNew(search.trim(), rel, rat.trim() || null)}
          >
            Create new {targetLabel}
          </Btn2>
        )}
        <div className="flex-1" />
        <Btn2 variant="secondary" onClick={onCancel}>Cancel</Btn2>
        <Btn2 variant="primary" disabled={!pickedId} onClick={() => onAdd(pickedId, rel, rat || null)}>
          Add link
        </Btn2>
      </div>
    </div>
  );
}

// ─── Create drawer ────────────────────────────────────────

const NEW_MODULE_OPTION = '__new__';

function CreateDrawer({ kind, editableModules, onCancel, onCreated, setError, afterCreate, initialName }: {
  kind: Tab;
  editableModules: ModuleRef[];
  onCancel: () => void;
  onCreated: (newId: string) => void;
  setError: (e: string | null) => void;
  /** Optional async hook run between create and onCreated, e.g. to link the new
   *  item to a parent template when the drawer was opened from a toolbox picker.
   *  Throws bubble back into the drawer's busy/error path so the user can retry. */
  afterCreate?: (newId: string) => Promise<void>;
  /** Pre-fill the name/prompt field — typically with whatever the user typed
   *  into the picker's search box before clicking "+ Create new". */
  initialName?: string;
}) {
  const [moduleId, setModuleId] = useState<string>(editableModules[0]?.id ?? NEW_MODULE_OPTION);
  const [newModuleName, setNewModuleName] = useState('');
  const [name, setName] = useState(initialName ?? '');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);

  // Asset-only fields
  const [assetType, setAssetType] = useState<AssetType>('EQUIPMENT');
  const [category, setCategory] = useState<AssetCategory>('TANGIBLE');
  // Threat-only fields
  const [adversaryType, setAdversaryType] = useState<AdversaryType>('CRIMINAL');
  const [actionType, setActionType] = useState<ActionType>('THEFT');
  // CM-only fields
  const [shapeCategory, setShapeCategory] = useState<ShapeCategory>('EQUIPMENT');
  const [domain, setDomain] = useState<ProtectionDomain>('PERIMETER');
  // Question-only fields
  const [questionType, setQuestionType] = useState<'yes_no_partial' | 'number' | 'text' | 'select'>('yes_no_partial');
  const [evidenceType, setEvidenceType] = useState<SurveyType>('PHYSICAL');
  const [defaultWeight, setDefaultWeight] = useState<number>(3);

  async function resolveModuleId(): Promise<string> {
    if (moduleId !== NEW_MODULE_OPTION) return moduleId;
    if (!newModuleName.trim()) throw new Error('Module name is required.');
    const userPkg = await adminTemplatesApi.ensureUserPackage();
    const slugified = newModuleName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const created = await adminTemplatesApi.createModule(userPkg.id, {
      slug: slugified || `module-${Date.now()}`,
      name: newModuleName.trim(),
    });
    return created.id;
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let createdId: string;
      if (kind === 'question') {
        // Library questions are tenant-scoped — no module / slug needed.
        if (!name.trim()) throw new Error('Prompt is required.');
        const data: SurveyQuestionCreateInput = {
          prompt: name.trim(),
          type: questionType,
          evidenceType,
          defaultWeight,
        };
        const c = await surveyQuestionsApi.create(data);
        createdId = c.id;
      } else {
        const targetModuleId = await resolveModuleId();
        const finalSlug = slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!finalSlug || !name.trim()) throw new Error('Name is required.');

        if (kind === 'asset') {
          const data: AdminAssetTemplateCreateInput = {
            slug: finalSlug, name: name.trim(),
            assetType, category, defaultCriticality: 3,
          };
          const c = await adminTemplatesApi.createAssetTemplate(targetModuleId, data);
          createdId = c.id;
        } else if (kind === 'threat') {
          const data: AdminThreatTemplateCreateInput = {
            slug: finalSlug, scenarioName: name.trim(),
            adversaryType, actionType,
          };
          const c = await adminTemplatesApi.createThreatTemplate(targetModuleId, data);
          createdId = c.id;
        } else {
          const data: AdminCountermeasureTemplateCreateInput = {
            slug: finalSlug, name: name.trim(),
            shapeCategory, domain,
          };
          const c = await adminTemplatesApi.createCountermeasureTemplate(targetModuleId, data);
          createdId = c.id;
        }
      }
      if (afterCreate) await afterCreate(createdId);
      onCreated(createdId);
    } catch (err) {
      setError(err instanceof Error ? err.message : await extractError(err));
    } finally {
      setBusy(false);
    }
  }

  const title = kind === 'asset' ? 'New asset template'
    : kind === 'threat' ? 'New threat template'
    : kind === 'cm' ? 'New countermeasure template'
    : 'New survey question';

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onCancel} aria-hidden />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col"
        role="dialog"
        aria-labelledby="tpl-create-title"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150 shrink-0">
          <h2 id="tpl-create-title" className="text-[15px] font-semibold text-n-900">{title}</h2>
          <button type="button" onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {kind !== 'question' && (
            <>
              <Field label="Module">
                <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}
                  className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                  {editableModules.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.packageName})</option>
                  ))}
                  <option value={NEW_MODULE_OPTION}>+ Create new module…</option>
                </select>
              </Field>
              {moduleId === NEW_MODULE_OPTION && (
                <Field label="New module name">
                  <Input value={newModuleName} onChange={setNewModuleName} placeholder="e.g. Sandbox" />
                  <div className="text-[10.5px] text-n-500 mt-1">
                    A new module will be created under the User templates package.
                  </div>
                </Field>
              )}
            </>
          )}
          <Field label={kind === 'threat' ? 'Scenario name' : kind === 'question' ? 'Prompt' : 'Name'}>
            <Input value={name} onChange={setName} />
          </Field>
          {kind !== 'question' && (
            <Field label="Slug (optional — auto-derived if blank)">
              <Input value={slug} onChange={setSlug} placeholder="auto-generated from name" />
            </Field>
          )}

          {kind === 'question' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select value={questionType} onChange={(e) => setQuestionType(e.target.value as typeof questionType)}
                    className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                    <option value="yes_no_partial">yes / no / partial</option>
                    <option value="number">number</option>
                    <option value="text">text</option>
                    <option value="select">select</option>
                  </select>
                </Field>
                <Field label="Evidence type">
                  <select value={evidenceType} onChange={(e) => setEvidenceType(e.target.value as SurveyType)}
                    className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                    {SURVEY_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Default weight (1–5)">
                <NumberInput value={defaultWeight} onChange={(v) => setDefaultWeight(v ?? 3)} min={1} max={5} />
              </Field>
              <div className="text-[11px] text-n-500 italic">
                Severity map, options and hint can be set after creation by editing the question.
              </div>
            </>
          )}

          {kind === 'asset' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Asset type">
                <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)}
                  className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                  {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value as AssetCategory)}
                  className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                  {ASSET_CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          )}
          {kind === 'threat' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adversary type">
                <select value={adversaryType} onChange={(e) => setAdversaryType(e.target.value as AdversaryType)}
                  className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                  {ADVERSARY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Action type">
                <select value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)}
                  className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                  {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          )}
          {kind === 'cm' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="SHAPE category">
                <select value={shapeCategory} onChange={(e) => setShapeCategory(e.target.value as ShapeCategory)}
                  className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                  {SHAPE_CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Domain">
                <select value={domain} onChange={(e) => setDomain(e.target.value as ProtectionDomain)}
                  className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none">
                  {PROTECTION_DOMAINS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
        <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
          <Btn2 variant="secondary" onClick={onCancel}>Cancel</Btn2>
          <Btn2 variant="primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create'}
          </Btn2>
        </footer>
      </aside>
    </>
  );
}

// ─── Linked questions section (asset / threat / cm templates) ──
//
// Self-contained: loads its own list of attached questions and the library
// on mount. Mirrors LinkedThreatsSection's pattern (header + add affordance
// + per-row edit/remove) but adapted for the question link shape (per-link
// weight override + sortOrder + rationale).

type QuestionKind = 'asset' | 'threat' | 'cm';

function LinkedQuestionsSection({
  kind, templateId, editable, setError,
}: {
  kind: QuestionKind;
  templateId: string;
  editable: boolean;
  setError: (e: string | null) => void;
}) {
  const [links, setLinks] = useState<TemplateQuestionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [creatingNew, setCreatingNew] = useState<{
    prompt: string;
    body: { weight: number | null; sortOrder: number; rationale: string | null };
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = kind === 'asset'
        ? await templateQuestionsApi.listAsset(templateId)
        : kind === 'threat'
          ? await templateQuestionsApi.listThreat(templateId)
          : await templateQuestionsApi.listCm(templateId);
      setLinks(r.items);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, templateId]);

  async function upsert(questionId: string, body: { weight?: number | null; sortOrder?: number; rationale?: string | null }) {
    try {
      if (kind === 'asset') await templateQuestionsApi.upsertAsset(templateId, questionId, body);
      else if (kind === 'threat') await templateQuestionsApi.upsertThreat(templateId, questionId, body);
      else await templateQuestionsApi.upsertCm(templateId, questionId, body);
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function remove(questionId: string) {
    try {
      if (kind === 'asset') await templateQuestionsApi.removeAsset(templateId, questionId);
      else if (kind === 'threat') await templateQuestionsApi.removeThreat(templateId, questionId);
      else await templateQuestionsApi.removeCm(templateId, questionId);
      await load();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  return (
    <SubsectionCard
      title="Survey questions"
      count={links.length}
      action={editable && !adding ? (
        <Btn2 variant="secondary" leading={<Plus className="w-3.5 h-3.5" />} onClick={() => setAdding(true)}>
          Attach question
        </Btn2>
      ) : null}
    >
      {loading ? (
        <div className="text-[12px] text-n-500">Loading…</div>
      ) : links.length === 0 && !adding ? (
        <div className="text-[12px] text-n-500 italic">
          No questions attached. Auto-compose on a cluster scope will skip this template.
        </div>
      ) : (
        <div className="space-y-1.5">
          {links.map((l) => (
            <QuestionLinkRow
              key={l.questionId}
              link={l}
              editable={editable}
              onSave={(body) => upsert(l.questionId, body)}
              onRemove={() => remove(l.questionId)}
            />
          ))}
        </div>
      )}

      {adding && (
        <AttachQuestionPanel
          alreadyAttachedIds={new Set(links.map((l) => l.questionId))}
          onCancel={() => setAdding(false)}
          onAdd={async (questionId, body) => {
            await upsert(questionId, body);
            setAdding(false);
          }}
          onCreateNew={(prompt, body) => setCreatingNew({ prompt, body })}
        />
      )}
      {creatingNew && (
        <CreateDrawer
          kind="question"
          editableModules={[]}
          initialName={creatingNew.prompt}
          onCancel={() => setCreatingNew(null)}
          afterCreate={async (newId) => {
            await upsert(newId, creatingNew.body);
          }}
          onCreated={async () => {
            setCreatingNew(null);
            setAdding(false);
          }}
          setError={setError}
        />
      )}
    </SubsectionCard>
  );
}

function QuestionLinkRow({
  link, editable, onSave, onRemove,
}: {
  link: TemplateQuestionLink;
  editable: boolean;
  onSave: (body: { weight?: number | null; sortOrder?: number; rationale?: string | null }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [weight, setWeight] = useState<string>(link.weight == null ? '' : String(link.weight));
  const [sortOrder, setSortOrder] = useState<string>(String(link.sortOrder));
  const [rationale, setRationale] = useState(link.rationale ?? '');
  const [editingMeta, setEditingMeta] = useState(false);

  async function save() {
    const w = weight.trim() === '' ? null : Number(weight);
    if (w != null && (!Number.isFinite(w) || w < 1 || w > 5)) return;
    await onSave({
      weight: w,
      sortOrder: Number(sortOrder) || 0,
      rationale: rationale.trim() || null,
    });
    setEditingMeta(false);
  }

  return (
    <div className="border border-n-200 rounded-r2 px-3 py-2 bg-white">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-n-900">{link.prompt}</div>
          <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-0.5">
            {link.evidenceType.replace('_', ' ')} · {link.type} · weight {link.weight ?? link.defaultWeight}
            {link.weight != null && ' (override)'}
            {link.sortOrder !== 0 && ` · order ${link.sortOrder}`}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {editable && !editingMeta && (
            <button
              type="button"
              onClick={() => setEditingMeta(true)}
              className="w-6 h-6 flex items-center justify-center text-n-500 hover:text-a-700 rounded-r1 hover:bg-n-100"
              aria-label="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={onRemove}
              className="w-6 h-6 flex items-center justify-center text-n-500 hover:text-bad rounded-r1 hover:bg-n-100"
              aria-label="Detach"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {editable && link.rationale && !editingMeta && (
        <div className="text-[11px] text-n-600 mt-1 italic">{link.rationale}</div>
      )}

      {editingMeta && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="inline-flex items-center gap-1 text-[11px] text-n-500">
            weight override
            <input
              type="number"
              min={1}
              max={5}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={String(link.defaultWeight)}
              className="w-14 h-7 border border-n-200 rounded-r1 px-1 text-[11.5px] font-mono"
            />
          </label>
          <label className="inline-flex items-center gap-1 text-[11px] text-n-500">
            sort order
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-14 h-7 border border-n-200 rounded-r1 px-1 text-[11.5px] font-mono"
            />
          </label>
          <input
            type="text"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why this question is on this template (optional)"
            className="flex-1 min-w-[180px] h-7 border border-n-200 rounded-r1 px-2 text-[11.5px]"
          />
          <Btn2 variant="ghost" onClick={() => setEditingMeta(false)}>Cancel</Btn2>
          <Btn2 variant="primary" leading={<Save className="w-3.5 h-3.5" />} onClick={save}>Save</Btn2>
        </div>
      )}
    </div>
  );
}

function AttachQuestionPanel({
  alreadyAttachedIds, onCancel, onAdd, onCreateNew,
}: {
  alreadyAttachedIds: Set<string>;
  onCancel: () => void;
  onAdd: (questionId: string, body: { weight?: number | null; sortOrder?: number; rationale?: string | null }) => Promise<void>;
  /** When set, render a "+ Create new question" button that hands the current
   *  search text + weight/sortOrder/rationale up to the parent so it can open
   *  a CreateDrawer and auto-attach the new question on success. */
  onCreateNew?: (
    initialPrompt: string,
    body: { weight: number | null; sortOrder: number; rationale: string | null },
  ) => void;
}) {
  const [library, setLibrary] = useState<SurveyQuestionLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('0');
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      try {
        const r = await surveyQuestionsApi.list({ search: search.trim() || undefined });
        setLibrary(r.items);
      } finally {
        setLoading(false);
      }
    })();
  }, [search]);

  const visible = useMemo(
    () => library.filter((q) => !alreadyAttachedIds.has(q.id)),
    [library, alreadyAttachedIds],
  );

  async function add() {
    if (!pickedId) return;
    setBusy(true);
    try {
      const w = weight.trim() === '' ? null : Number(weight);
      await onAdd(pickedId, {
        weight: w == null || !Number.isFinite(w) ? null : w,
        sortOrder: Number(sortOrder) || 0,
        rationale: rationale.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border border-a-200 bg-a-50/40 rounded-r2 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 border border-n-200 rounded-r1 h-7 px-2 text-[12px] bg-white"
          placeholder="Search the question library…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="text-[11.5px] text-n-500">Loading library…</div>
      ) : visible.length === 0 ? (
        <div className="text-[11.5px] text-n-500 italic">
          No matching questions. Create new ones in the Question library page.
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {visible.map((q) => {
            const active = q.id === pickedId;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setPickedId(q.id);
                  setWeight(String(q.defaultWeight));
                }}
                className={[
                  'w-full text-left border rounded-r1 px-2 py-1.5',
                  active
                    ? 'border-a-300 bg-a-50'
                    : 'border-n-200 bg-white hover:bg-n-50',
                ].join(' ')}
              >
                <div className="text-[12px] text-n-900">{q.prompt}</div>
                <div className="text-[10.5px] font-mono text-n-500 tracking-[0.4px] mt-0.5">
                  {q.evidenceType.replace('_', ' ')} · {q.type} · default weight {q.defaultWeight}
                  {q.isSystem && ' · system'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {pickedId && (
        <div className="flex flex-wrap items-end gap-2 border-t border-a-200/60 pt-2">
          <label className="inline-flex items-center gap-1 text-[11px] text-n-500">
            weight override
            <input
              type="number"
              min={1}
              max={5}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-14 h-7 border border-n-200 rounded-r1 px-1 text-[11.5px] font-mono"
            />
          </label>
          <label className="inline-flex items-center gap-1 text-[11px] text-n-500">
            sort order
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-14 h-7 border border-n-200 rounded-r1 px-1 text-[11.5px] font-mono"
            />
          </label>
          <input
            type="text"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why on this template (optional)"
            className="flex-1 min-w-[180px] h-7 border border-n-200 rounded-r1 px-2 text-[11.5px]"
          />
          <Btn2 variant="ghost" onClick={onCancel}>Cancel</Btn2>
          <Btn2 variant="primary" leading={<Link2 className="w-3.5 h-3.5" />} onClick={add} disabled={busy}>
            {busy ? 'Attaching…' : 'Attach'}
          </Btn2>
        </div>
      )}
      {onCreateNew && !pickedId && (
        <div className="flex justify-end border-t border-a-200/60 pt-2">
          <Btn2
            variant="ghost"
            leading={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              const w = weight.trim() === '' ? null : Number(weight);
              onCreateNew(search.trim(), {
                weight: w == null || !Number.isFinite(w) ? null : w,
                sortOrder: Number(sortOrder) || 0,
                rationale: rationale.trim() || null,
              });
            }}
          >
            Create new question
          </Btn2>
        </div>
      )}
    </div>
  );
}

// ─── Collapsible subsection card ───────────────────────────
//
// Used to wrap each Linked*Section in the detail panels so operators can
// hide noisy sections they aren't working on. The header is more
// pronounced than the prior plain text label: dark background strip,
// chevron, count badge, optional inline action button on the right.

function SubsectionCard({
  title, count, defaultOpen = true, action, children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border border-n-200 rounded-r2 bg-white overflow-hidden">
      <header
        className={[
          'flex items-center gap-2 px-3 h-10 cursor-pointer select-none',
          'bg-n-50 hover:bg-n-100 transition-colors',
          open ? 'border-b border-n-200' : '',
        ].join(' ')}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-n-600 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-n-600 shrink-0" />
        )}
        <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.6px] text-n-800 flex-1">
          {title}
          {typeof count === 'number' && (
            <span className="ml-1.5 text-[11px] font-mono text-n-500 normal-case tracking-normal">
              · {count}
            </span>
          )}
        </h3>
        {action && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            {action}
          </div>
        )}
      </header>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
}

// ─── Question list row + detail panel ──────────────────────

const EVIDENCE_TYPE_VARIANT: Record<SurveyType, 'accent' | 'info' | 'outline' | 'ok' | 'warn'> = {
  PHYSICAL: 'accent',
  REMOTE_TECH: 'info',
  DOC_REVIEW: 'outline',
  HYBRID: 'ok',
  CUSTOM: 'warn',
};

function QuestionListRow({ row, active, onClick }: {
  row: QuestionRow; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-r2 border transition-colors',
        active ? 'bg-a-50 border-a-300' : 'bg-white border-n-150 hover:border-n-200',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-[13px] font-medium text-n-900 truncate">{row.tpl.prompt}</div>
          {row.tpl.isSystem && <Lock className="w-3 h-3 text-n-400 shrink-0" />}
          {!row.tpl.isActive && <Pill variant="outline">inactive</Pill>}
        </div>
        <div className="text-[11px] font-mono text-n-500 truncate">
          {row.tpl.category ?? 'general'} · {row.tpl.type} · w={row.tpl.defaultWeight}
        </div>
      </div>
      <Pill variant={EVIDENCE_TYPE_VARIANT[row.tpl.evidenceType]}>
        {row.tpl.evidenceType.replace('_', ' ')}
      </Pill>
      <Pill variant="outline">
        <Link2 className="w-2.5 h-2.5" />
        {row.tpl.attachedTemplateCount}
      </Pill>
    </button>
  );
}

const Q_TYPES: Array<'yes_no_partial' | 'number' | 'text' | 'select'> = ['yes_no_partial', 'number', 'text', 'select'];
const SEVERITY_KEYS_YN = ['YES', 'PARTIAL', 'NO'];
const SEVERITY_KEYS_NUM = ['BELOW_30', '30_TO_60', 'ABOVE_60'];

interface QuestionDraft {
  prompt: string;
  category: string;
  hint: string;
  type: 'yes_no_partial' | 'number' | 'text' | 'select';
  evidenceType: SurveyType;
  defaultWeight: number;
  optionsText: string;
  severityMap: Record<string, 'ok' | 'warn' | 'bad'>;
  isActive: boolean;
}

function questionDraftFromTpl(t: SurveyQuestionLibraryItem): QuestionDraft {
  return {
    prompt: t.prompt,
    category: t.category ?? '',
    hint: t.hint ?? '',
    type: t.type,
    evidenceType: t.evidenceType,
    defaultWeight: t.defaultWeight,
    optionsText: t.options?.join('\n') ?? '',
    severityMap: t.severityMap ?? { YES: 'ok', PARTIAL: 'warn', NO: 'bad' },
    isActive: t.isActive,
  };
}

function questionDraftEquals(d: QuestionDraft, t: SurveyQuestionLibraryItem): boolean {
  if (d.prompt !== t.prompt) return false;
  if (d.category !== (t.category ?? '')) return false;
  if (d.hint !== (t.hint ?? '')) return false;
  if (d.type !== t.type) return false;
  if (d.evidenceType !== t.evidenceType) return false;
  if (d.defaultWeight !== t.defaultWeight) return false;
  if (d.isActive !== t.isActive) return false;
  const draftOpts = d.optionsText.split('\n').map((s) => s.trim()).filter(Boolean).join('\n');
  const tplOpts = t.options?.join('\n') ?? '';
  if (draftOpts !== tplOpts) return false;
  const sm = t.severityMap ?? {};
  const draftKeys = Object.keys(d.severityMap).sort();
  const tplKeys = Object.keys(sm).sort();
  if (draftKeys.length !== tplKeys.length) return false;
  for (const k of draftKeys) if (d.severityMap[k] !== sm[k]) return false;
  return true;
}

function QuestionDetailPanel({ row, editable, onChanged, onDeleted, setError }: {
  row: QuestionRow; editable: boolean;
  onChanged: () => Promise<void>; onDeleted: () => void;
  setError: (e: string | null) => void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(() => questionDraftFromTpl(row.tpl));
  useEffect(() => { setDraft(questionDraftFromTpl(row.tpl)); }, [row.tpl]);
  const dirty = useMemo(() => !questionDraftEquals(draft, row.tpl), [draft, row.tpl]);

  const [attachments, setAttachments] = useState<QuestionTemplateAttachments | null>(null);
  useEffect(() => {
    let cancelled = false;
    setAttachments(null);
    void (async () => {
      try {
        const r = await templateQuestionsApi.listAttachments(row.tpl.id);
        if (!cancelled) setAttachments(r);
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      }
    })();
    return () => { cancelled = true; };
  }, [row.tpl.id, setError]);

  // Severity-map keys depend on question type — recompute when type / options change.
  const severityKeys = useMemo(() => {
    if (draft.type === 'yes_no_partial') return SEVERITY_KEYS_YN;
    if (draft.type === 'number') return SEVERITY_KEYS_NUM;
    if (draft.type === 'select') return draft.optionsText.split('\n').map((s) => s.trim()).filter(Boolean);
    return [];
  }, [draft.type, draft.optionsText]);

  async function save() {
    try {
      const options = draft.type === 'select'
        ? draft.optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
        : undefined;
      await surveyQuestionsApi.update(row.tpl.id, {
        prompt: draft.prompt,
        category: draft.category || null,
        hint: draft.hint || null,
        type: draft.type,
        options,
        severityMap: severityKeys.length > 0 ? draft.severityMap : undefined,
        evidenceType: draft.evidenceType,
        defaultWeight: draft.defaultWeight,
        isActive: draft.isActive,
      });
      await onChanged();
    } catch (err) { setError(await extractError(err)); }
  }

  async function remove() {
    if (!window.confirm(`Delete question "${row.tpl.prompt.slice(0, 60)}…"?`)) return;
    try {
      await surveyQuestionsApi.remove(row.tpl.id);
      onDeleted();
    } catch (err) { setError(await extractError(err)); }
  }

  return (
    <div>
      <PanelHeader
        title={row.tpl.prompt.length > 60 ? row.tpl.prompt.slice(0, 60) + '…' : row.tpl.prompt}
        subtitle={`${row.tpl.evidenceType.replace('_', ' ')} · ${row.tpl.type} · attached to ${row.tpl.attachedTemplateCount} template${row.tpl.attachedTemplateCount === 1 ? '' : 's'}`}
        locked={row.tpl.isSystem}
        editable={editable}
        dirty={dirty}
        onSave={save}
        onDelete={remove}
        onReset={() => setDraft(questionDraftFromTpl(row.tpl))}
      />
      <div className="p-5 space-y-4">
        <Field label="Prompt">
          <Textarea value={draft.prompt} onChange={(v) => setDraft({ ...draft, prompt: v })} disabled={!editable} rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} disabled={!editable} placeholder="e.g. Compliance" />
          </Field>
          <Field label="Default weight (1–5)">
            <NumberInput value={draft.defaultWeight} onChange={(v) => setDraft({ ...draft, defaultWeight: v ?? 3 })} disabled={!editable} min={1} max={5} />
          </Field>
        </div>
        <Field label="Hint (shown under the question on the run page)">
          <Input value={draft.hint} onChange={(v) => setDraft({ ...draft, hint: v })} disabled={!editable} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={draft.type} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as QuestionDraft['type'] })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              {Q_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Evidence type">
            <select value={draft.evidenceType} disabled={!editable}
              onChange={(e) => setDraft({ ...draft, evidenceType: e.target.value as SurveyType })}
              className="w-full h-8 px-2 text-[12.5px] border border-n-200 rounded-r2 bg-white focus:border-a-400 focus:outline-none disabled:bg-n-50">
              {SURVEY_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Active">
          <label className="inline-flex items-center gap-2 text-[12.5px] text-n-700">
            <input
              type="checkbox"
              checked={draft.isActive}
              disabled={!editable}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
            Question is available for attachment and auto-compose
          </label>
        </Field>

        {draft.type === 'select' && (
          <Field label="Options (one per line)">
            <textarea
              value={draft.optionsText}
              disabled={!editable}
              onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })}
              rows={4}
              className="w-full px-2 py-1.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-400 focus:outline-none disabled:bg-n-50 font-mono"
              placeholder={'PASS\nWARN\nFAIL'}
            />
          </Field>
        )}

        {severityKeys.length > 0 && draft.type !== 'text' && (
          <Field label="Severity map">
            <div className="space-y-1">
              {severityKeys.map((k) => (
                <div key={k} className="flex items-center gap-2 text-[11.5px]">
                  <span className="font-mono w-24 text-n-700">{k}</span>
                  <select
                    disabled={!editable}
                    value={draft.severityMap[k] ?? 'ok'}
                    onChange={(e) =>
                      setDraft({ ...draft, severityMap: { ...draft.severityMap, [k]: e.target.value as 'ok' | 'warn' | 'bad' } })
                    }
                    className="h-7 border border-n-200 rounded-r2 px-2 text-[12px] bg-white disabled:bg-n-50"
                  >
                    <option value="ok">ok</option>
                    <option value="warn">warn</option>
                    <option value="bad">bad</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="text-[10.5px] text-n-500 mt-1">
              Maps each answer key to a severity that scoring uses to compute the question’s score.
            </div>
          </Field>
        )}

        <QuestionAttachmentsSection
          title="Attached to asset templates"
          items={attachments?.asset ?? null}
          loading={attachments === null}
          emptyHint="No asset templates attach this question."
        />
        <QuestionAttachmentsSection
          title="Attached to threat templates"
          items={attachments?.threat ?? null}
          loading={attachments === null}
          emptyHint="No threat templates attach this question."
        />
        <QuestionAttachmentsSection
          title="Attached to countermeasure templates"
          items={attachments?.cm ?? null}
          loading={attachments === null}
          emptyHint="No countermeasure templates attach this question."
        />
      </div>
    </div>
  );
}

// Read-only list rendering question→template back-references, used inside
// QuestionDetailPanel. Editing/unlinking is done from the parent template's
// own LinkedQuestionsSection — this view is purely for navigation/awareness.
function QuestionAttachmentsSection({
  title, items, loading, emptyHint,
}: {
  title: string;
  items: QuestionTemplateAttachments['asset'] | null;
  loading: boolean;
  emptyHint: string;
}) {
  return (
    <SubsectionCard title={title} count={items?.length}>
      {loading ? (
        <div className="text-[12px] text-n-500">Loading…</div>
      ) : !items || items.length === 0 ? (
        <div className="text-[12px] text-n-500 italic">{emptyHint}</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.templateId} className="border border-n-150 rounded-r2 bg-white">
              <div className="flex items-center gap-2 px-2.5 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-n-800 truncate">{it.name}</div>
                  <div className="text-[11px] font-mono text-n-500 truncate">
                    {it.packageName} · {it.moduleName} · {it.slug}
                  </div>
                </div>
                {it.weight != null && (
                  <Pill variant="outline">w={it.weight}</Pill>
                )}
                <Pill variant="default">#{it.sortOrder}</Pill>
              </div>
              {it.rationale && (
                <div className="border-t border-n-150 px-2.5 py-1.5 text-[11.5px] text-n-700 bg-n-25">
                  {it.rationale}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SubsectionCard>
  );
}
