import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package as PackageIcon, Layers, Search, Plus,
  ShieldAlert, ShieldCheck, Boxes,
} from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { RiskBadge } from '../components/hifi/RiskBadge';
import { AssetFormDrawer } from '../components/AssetFormDrawer';
import { templatesApi, countermeasureTemplatesApi, assetsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  ASSET_TYPES,
  SHAPE_CATEGORIES,
  PROTECTION_DOMAINS,
  PPS_FUNCTIONS,
  SHAPE_CATEGORY_LABEL,
  criticalityToRiskLevel,
  type AssetSummary,
  type AssetTemplateDetail,
  type AssetTemplateSummary,
  type AssetType,
  type CountermeasureTemplateDetail,
  type CountermeasureTemplateSummary,
  type ProtectionDomain,
  type ShapeCategory,
  type PpsFunction,
  type TemplateModule,
  type TemplatePackage,
} from '../lib/csmp-types';

type Tab = 'assets' | 'countermeasures';

export function TemplateLibraryPage() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'assets';
    const qs = new URLSearchParams(window.location.search);
    return qs.get('tab') === 'countermeasures' ? 'countermeasures' : 'assets';
  });

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (tab === 'assets') qs.delete('tab'); else qs.set('tab', tab);
    const q = qs.toString();
    const url = `${window.location.pathname}${q ? `?${q}` : ''}`;
    window.history.replaceState(null, '', url);
  }, [tab]);

  // ─── shared sidebar state ──────────────────────────────
  const [packages, setPackages] = useState<TemplatePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [activePackage, setActivePackage] = useState<string>('');
  const [modules, setModules] = useState<TemplateModule[]>([]);
  const [activeModule, setActiveModule] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // ─── asset-tab state ───────────────────────────────────
  const [items, setItems] = useState<AssetTemplateSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState<AssetType | ''>('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AssetTemplateDetail | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [applyDrawer, setApplyDrawer] = useState<{ id: string; name: string } | null>(null);
  const [availableParents, setAvailableParents] = useState<AssetSummary[]>([]);

  // ─── countermeasure-tab state ─────────────────────────
  const [cmItems, setCmItems] = useState<CountermeasureTemplateSummary[]>([]);
  const [cmTotal, setCmTotal] = useState(0);
  const [cmSearch, setCmSearch] = useState('');
  const [cmShape, setCmShape] = useState<ShapeCategory | ''>('');
  const [cmDomain, setCmDomain] = useState<ProtectionDomain | ''>('');
  const [cmPpsFn, setCmPpsFn] = useState<PpsFunction | ''>('');
  const [cmLoading, setCmLoading] = useState(false);
  const [cmSelected, setCmSelected] = useState<CountermeasureTemplateDetail | null>(null);
  const [cmSelectedLoading, setCmSelectedLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    templatesApi
      .listPackages()
      .then((r) => {
        if (cancelled) return;
        setPackages(r.items);
        if (r.items.length && !activePackage) setActivePackage(r.items[0].slug);
      })
      .catch(async (err) => !cancelled && setError(await extractError(err)))
      .finally(() => !cancelled && setPackagesLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activePackage) { setModules([]); return; }
    let cancelled = false;
    templatesApi
      .listModules(activePackage)
      .then((r) => !cancelled && setModules(r.items))
      .catch(() => undefined);
    setActiveModule('');
    return () => { cancelled = true; };
  }, [activePackage]);

  const loadAssets = useCallback(async () => {
    if (!activePackage) return;
    setLoading(true);
    setError(null);
    try {
      const res = await templatesApi.listAssetTemplates({
        packageSlug: activePackage,
        moduleSlug: activeModule || undefined,
        assetType: (assetType || undefined) as AssetType | undefined,
        search: search || undefined,
        pageSize: 200,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setLoading(false);
    }
  }, [activePackage, activeModule, assetType, search]);

  const loadCountermeasures = useCallback(async () => {
    if (!activePackage) return;
    setCmLoading(true);
    setError(null);
    try {
      const res = await countermeasureTemplatesApi.list({
        packageSlug: activePackage,
        moduleSlug: activeModule || undefined,
        shapeCategory: (cmShape || undefined) as ShapeCategory | undefined,
        domain: (cmDomain || undefined) as ProtectionDomain | undefined,
        ppsFunction: (cmPpsFn || undefined) as PpsFunction | undefined,
        search: cmSearch || undefined,
        pageSize: 200,
      });
      setCmItems(res.items);
      setCmTotal(res.total);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setCmLoading(false);
    }
  }, [activePackage, activeModule, cmShape, cmDomain, cmPpsFn, cmSearch]);

  useEffect(() => { if (tab === 'assets') void loadAssets(); }, [loadAssets, tab]);
  useEffect(() => { if (tab === 'countermeasures') void loadCountermeasures(); }, [loadCountermeasures, tab]);

  useEffect(() => {
    assetsApi.list({ pageSize: 200 }).then((r) => setAvailableParents(r.items)).catch(() => undefined);
  }, []);

  async function openAssetDetail(id: string) {
    setSelectedLoading(true);
    try {
      const d = await templatesApi.getAssetTemplate(id);
      setSelected(d);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSelectedLoading(false);
    }
  }

  async function openCmDetail(id: string) {
    setCmSelectedLoading(true);
    try {
      const d = await countermeasureTemplatesApi.get(id);
      setCmSelected(d);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setCmSelectedLoading(false);
    }
  }

  const activePackageObj = useMemo(
    () => packages.find((p) => p.slug === activePackage),
    [packages, activePackage],
  );

  const subtitleCount = tab === 'assets' ? total : cmTotal;
  const subtitleNoun = tab === 'assets' ? 'asset templates' : 'countermeasure templates';

  return (
    <>
      <Topbar
        breadcrumbs={<span>Catalog / Template library</span>}
        title="Template library"
        subtitle={
          activePackageObj
            ? `${activePackageObj.name} · ${subtitleCount} ${subtitleNoun}`
            : 'Industry template packages'
        }
      />

      <div className="px-6 pt-4">
        <div className="inline-flex items-center gap-0.5 bg-n-75 border border-n-150 rounded-r2 p-0.5">
          <TabBtn active={tab === 'assets'} onClick={() => setTab('assets')} icon={<Boxes className="w-3.5 h-3.5" />}>
            Assets
          </TabBtn>
          <TabBtn active={tab === 'countermeasures'} onClick={() => setTab('countermeasures')} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
            Countermeasures
          </TabBtn>
        </div>
      </div>

      <div className="p-6 pt-3 grid grid-cols-[240px_1fr_360px] gap-4 min-h-[calc(100vh-120px)]">
        {/* Package + module nav (shared across tabs) */}
        <aside className="space-y-4">
          <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-3">
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-2 px-1">
              Packages
            </div>
            {packagesLoading ? (
              <div className="text-[12px] text-n-500 px-1 py-2">Loading…</div>
            ) : packages.length === 0 ? (
              <div className="text-[12px] text-n-500 px-1 py-2">No packages installed.</div>
            ) : (
              <ul className="space-y-0.5">
                {packages.map((p) => {
                  const active = p.slug === activePackage;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setActivePackage(p.slug)}
                        className={[
                          'w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-r2 transition-colors',
                          active ? 'bg-a-50 text-a-700' : 'text-n-700 hover:bg-n-75',
                        ].join(' ')}
                      >
                        <PackageIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-medium truncate">{p.name}</div>
                          <div className="text-[10px] font-mono text-n-500 tracking-[0.05px]">
                            {p.assetTemplateCount} assets · v{p.version}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {modules.length > 0 && (
            <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-3">
              <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-2 px-1">
                Modules
              </div>
              <ul className="space-y-0.5">
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModule('')}
                    className={[
                      'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-r2 text-[12px]',
                      activeModule === '' ? 'bg-n-100 text-n-800 font-medium' : 'text-n-600 hover:bg-n-75',
                    ].join(' ')}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>All modules</span>
                  </button>
                </li>
                {modules.map((m) => {
                  const active = m.slug === activeModule;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setActiveModule(m.slug)}
                        className={[
                          'w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-r2 transition-colors',
                          active ? 'bg-a-50 text-a-700 font-medium' : 'text-n-700 hover:bg-n-75',
                        ].join(' ')}
                      >
                        <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] truncate">{m.name}</div>
                          {tab === 'assets' && (
                            <div className="text-[10px] font-mono text-n-500 tracking-[0.05px]">
                              {m.assetTemplateCount}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>

        {/* Middle column */}
        <div className="space-y-3 min-w-0">
          {tab === 'assets' ? (
            <>
              <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-3 flex flex-wrap items-center gap-2">
                <label className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-n-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates…"
                    className="w-full h-8 pl-8 pr-2.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
                  />
                </label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as AssetType | '')}
                  className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                >
                  <option value="">All asset types</option>
                  {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {error && (
                <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
                  Loading…
                </div>
              ) : items.length === 0 ? (
                <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
                  No templates match your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map((tpl) => {
                    const active = selected?.id === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => openAssetDetail(tpl.id)}
                        className={[
                          'text-left bg-white border rounded-r3 p-3.5 transition-all hover:shadow-sh2',
                          active ? 'border-a-500 shadow-sh2 ring-1 ring-a-500/20' : 'border-n-150 shadow-sh1',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[13px] font-semibold text-n-900 truncate flex-1">{tpl.name}</div>
                          <RiskBadge
                            level={criticalityToRiskLevel(tpl.defaultCriticality)}
                            value={tpl.defaultCriticality}
                          />
                        </div>
                        {tpl.description && (
                          <p className="text-[11.5px] text-n-600 mt-1.5 line-clamp-2">{tpl.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1 mt-2.5">
                          <Pill variant="outline">{tpl.assetType}</Pill>
                          <Pill variant="default">{tpl.category}</Pill>
                        </div>
                        <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mt-2">
                          {tpl.module.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-3 flex flex-wrap items-center gap-2">
                <label className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-n-400" />
                  <input
                    value={cmSearch}
                    onChange={(e) => setCmSearch(e.target.value)}
                    placeholder="Search countermeasures…"
                    className="w-full h-8 pl-8 pr-2.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
                  />
                </label>
                <select
                  value={cmShape}
                  onChange={(e) => setCmShape(e.target.value as ShapeCategory | '')}
                  className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                >
                  <option value="">All SHAPE</option>
                  {SHAPE_CATEGORIES.map((s) => (
                    <option key={s} value={s}>{SHAPE_CATEGORY_LABEL[s]}</option>
                  ))}
                </select>
                <select
                  value={cmDomain}
                  onChange={(e) => setCmDomain(e.target.value as ProtectionDomain | '')}
                  className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                >
                  <option value="">All domains</option>
                  {PROTECTION_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select
                  value={cmPpsFn}
                  onChange={(e) => setCmPpsFn(e.target.value as PpsFunction | '')}
                  className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
                >
                  <option value="">All PPS fns</option>
                  {PPS_FUNCTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {error && (
                <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
                  {error}
                </div>
              )}

              {cmLoading ? (
                <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
                  Loading…
                </div>
              ) : cmItems.length === 0 ? (
                <div className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-10 text-center text-[12.5px] text-n-500">
                  No countermeasures match your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {cmItems.map((tpl) => {
                    const active = cmSelected?.id === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => openCmDetail(tpl.id)}
                        className={[
                          'text-left bg-white border rounded-r3 p-3.5 transition-all hover:shadow-sh2',
                          active ? 'border-a-500 shadow-sh2 ring-1 ring-a-500/20' : 'border-n-150 shadow-sh1',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[13px] font-semibold text-n-900 truncate flex-1">{tpl.name}</div>
                        </div>
                        {tpl.description && (
                          <p className="text-[11.5px] text-n-600 mt-1.5 line-clamp-2">{tpl.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1 mt-2.5">
                          <Pill variant="accent">{SHAPE_CATEGORY_LABEL[tpl.shapeCategory]}</Pill>
                          <Pill variant="outline">{tpl.domain}</Pill>
                          {tpl.ppsFunctions.slice(0, 3).map((fn) => (
                            <Pill key={fn} variant="default">{fn}</Pill>
                          ))}
                        </div>
                        <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mt-2">
                          {tpl.module.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail side panel */}
        <aside className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-4 h-fit sticky top-6">
          {tab === 'assets' ? (
            selectedLoading ? (
              <div className="text-center py-10 text-[12.5px] text-n-500">Loading…</div>
            ) : !selected ? (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
                  <PackageIcon className="w-5 h-5" />
                </div>
                <div className="text-[12.5px] font-medium text-n-700">Pick a template</div>
                <div className="text-[11.5px] text-n-500 mt-1">
                  Select one to see recommended threats and apply it.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                    {selected.module.package.name} · {selected.module.name}
                  </div>
                  <h3 className="text-[15px] font-semibold text-n-900 mt-0.5">{selected.name}</h3>
                  {selected.description && (
                    <p className="text-[12px] text-n-600 mt-1.5 leading-relaxed">{selected.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill variant="outline">{selected.assetType}</Pill>
                  <Pill variant="default">{selected.category}</Pill>
                  <RiskBadge
                    level={criticalityToRiskLevel(selected.defaultCriticality)}
                    value={selected.defaultCriticality}
                  />
                </div>

                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((t) => <Pill key={t} variant="outline">{t}</Pill>)}
                  </div>
                )}

                {selected.recommendedThreats.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1.5">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Recommended threats ({selected.recommendedThreats.length})</span>
                    </div>
                    <ul className="space-y-1">
                      {selected.recommendedThreats.map((r) => (
                        <li
                          key={r.threatTemplate.id}
                          className="flex items-start justify-between gap-2 p-2 border border-n-150 rounded-r2"
                        >
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-n-800 truncate">
                              {r.threatTemplate.scenarioName}
                            </div>
                            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
                              {r.threatTemplate.adversaryType} · {r.threatTemplate.actionType}
                            </div>
                          </div>
                          <Pill
                            variant={
                              r.relevance === 'HIGH' ? 'bad' : r.relevance === 'MEDIUM' ? 'warn' : 'default'
                            }
                          >
                            {r.relevance}
                          </Pill>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Btn2
                  variant="primary"
                  leading={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setApplyDrawer({ id: selected.id, name: selected.name })}
                  className="w-full"
                >
                  Create asset from this template
                </Btn2>
              </div>
            )
          ) : cmSelectedLoading ? (
            <div className="text-center py-10 text-[12.5px] text-n-500">Loading…</div>
          ) : !cmSelected ? (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-r2 bg-n-75 text-n-500 mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-[12.5px] font-medium text-n-700">Pick a countermeasure</div>
              <div className="text-[11.5px] text-n-500 mt-1">
                Browse-only. Add one from the Countermeasures page using the "From template" button.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                  {cmSelected.module.package.name} · {cmSelected.module.name}
                </div>
                <h3 className="text-[15px] font-semibold text-n-900 mt-0.5">{cmSelected.name}</h3>
                {cmSelected.description && (
                  <p className="text-[12px] text-n-600 mt-1.5 leading-relaxed">{cmSelected.description}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Pill variant="accent">{SHAPE_CATEGORY_LABEL[cmSelected.shapeCategory]}</Pill>
                <Pill variant="outline">{cmSelected.domain}</Pill>
                {cmSelected.ppsFunctions.map((fn) => (
                  <Pill key={fn} variant="default">{fn}</Pill>
                ))}
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
                {cmSelected.defaultTearStrategy && (
                  <>
                    <dt className="text-n-500">Tear</dt>
                    <dd className="text-n-800">{cmSelected.defaultTearStrategy}</dd>
                  </>
                )}
                {cmSelected.defaultEffectiveness && (
                  <>
                    <dt className="text-n-500">Effectiveness</dt>
                    <dd className="text-n-800">{cmSelected.defaultEffectiveness}</dd>
                  </>
                )}
                {cmSelected.typicalCostEstimate != null && (
                  <>
                    <dt className="text-n-500">Capex</dt>
                    <dd className="text-n-800">{cmSelected.typicalCostEstimate.toLocaleString()}</dd>
                  </>
                )}
                {cmSelected.typicalAnnualCost != null && (
                  <>
                    <dt className="text-n-500">Opex/yr</dt>
                    <dd className="text-n-800">{cmSelected.typicalAnnualCost.toLocaleString()}</dd>
                  </>
                )}
                {cmSelected.csmpUnitReference && (
                  <>
                    <dt className="text-n-500">CSMP ref</dt>
                    <dd className="text-n-800 font-mono">{cmSelected.csmpUnitReference}</dd>
                  </>
                )}
              </dl>

              {cmSelected.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cmSelected.tags.map((t) => <Pill key={t} variant="outline">{t}</Pill>)}
                </div>
              )}

              {cmSelected.threatLinks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1.5">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Mitigates threats ({cmSelected.threatLinks.length})</span>
                  </div>
                  <ul className="space-y-1">
                    {cmSelected.threatLinks.map((l) => (
                      <li
                        key={l.threatTemplate.id}
                        className="flex items-start justify-between gap-2 p-2 border border-n-150 rounded-r2"
                      >
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-n-800 truncate">
                            {l.threatTemplate.scenarioName}
                          </div>
                          <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
                            {l.threatTemplate.adversaryType} · {l.threatTemplate.actionType}
                          </div>
                        </div>
                        <Pill
                          variant={
                            l.relevance === 'HIGH' ? 'bad' : l.relevance === 'MEDIUM' ? 'warn' : 'default'
                          }
                        >
                          {l.relevance}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {applyDrawer && (
        <AssetFormDrawer
          mode={{ kind: 'create', template: applyDrawer }}
          onClose={() => setApplyDrawer(null)}
          onSaved={() => setApplyDrawer(null)}
          availableParents={availableParents}
        />
      )}
    </>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 h-7 rounded-r2 text-[12px] font-medium transition-colors',
        active ? 'bg-white text-n-900 shadow-sh1' : 'text-n-600 hover:text-n-800',
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}
