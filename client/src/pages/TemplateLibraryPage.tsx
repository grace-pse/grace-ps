import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package as PackageIcon, Layers, Search, Plus, ShieldAlert } from 'lucide-react';
import { Topbar } from '../components/shell/Topbar';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { RiskBadge } from '../components/hifi/RiskBadge';
import { AssetFormDrawer } from '../components/AssetFormDrawer';
import { templatesApi, assetsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  ASSET_TYPES,
  criticalityToRiskLevel,
  type AssetSummary,
  type AssetTemplateDetail,
  type AssetTemplateSummary,
  type AssetType,
  type TemplateModule,
  type TemplatePackage,
} from '../lib/csmp-types';

export function TemplateLibraryPage() {
  const [packages, setPackages] = useState<TemplatePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);

  const [activePackage, setActivePackage] = useState<string>('');
  const [modules, setModules] = useState<TemplateModule[]>([]);
  const [activeModule, setActiveModule] = useState<string>('');

  const [items, setItems] = useState<AssetTemplateSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState<AssetType | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AssetTemplateDetail | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const [applyDrawer, setApplyDrawer] = useState<{ id: string; name: string } | null>(null);
  const [availableParents, setAvailableParents] = useState<AssetSummary[]>([]);

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

  const load = useCallback(async () => {
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

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    assetsApi.list({ pageSize: 200 }).then((r) => setAvailableParents(r.items)).catch(() => undefined);
  }, []);

  async function openDetail(id: string) {
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

  const activePackageObj = useMemo(
    () => packages.find((p) => p.slug === activePackage),
    [packages, activePackage],
  );

  return (
    <>
      <Topbar
        breadcrumbs={<span>Catalog / Template library</span>}
        title="Template library"
        subtitle={
          activePackageObj
            ? `${activePackageObj.name} · ${total} templates`
            : 'Industry template packages'
        }
      />

      <div className="p-6 grid grid-cols-[240px_1fr_360px] gap-4 min-h-[calc(100vh-80px)]">
        {/* Package + module nav */}
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
                            {p.assetTemplateCount} templates · v{p.version}
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
                          <div className="text-[10px] font-mono text-n-500 tracking-[0.05px]">
                            {m.assetTemplateCount}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>

        {/* Template grid */}
        <div className="space-y-3 min-w-0">
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
                    onClick={() => openDetail(tpl.id)}
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
        </div>

        {/* Detail side panel */}
        <aside className="bg-white border border-n-150 rounded-r3 shadow-sh1 p-4 h-fit sticky top-6">
          {selectedLoading ? (
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
