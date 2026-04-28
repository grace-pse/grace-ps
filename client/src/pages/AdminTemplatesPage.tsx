import { useEffect, useState } from 'react';
import {
  Download, Upload, GitBranch, Trash2, Pencil, Plus, Package, Power,
} from 'lucide-react';
import { Btn2 } from '../components/hifi/Btn2';
import { Pill } from '../components/hifi/Pill';
import { adminTemplatesApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { downloadJson } from '../lib/download';
import type {
  AdminPackageWithTree, AdminModuleDetail,
  AdminAssetTemplate, AdminThreatTemplate, AdminCountermeasureTemplate,
  AdminImportResult,
} from '../lib/csmp-types';
import {
  TemplatePackageTree, type Selection,
} from '../components/admin/TemplatePackageTree';
import { TemplatePackageDrawer } from '../components/admin/TemplatePackageDrawer';
import { TemplateModuleDrawer } from '../components/admin/TemplateModuleDrawer';
import { AssetTemplateDrawer } from '../components/admin/AssetTemplateDrawer';
import { ThreatTemplateDrawer } from '../components/admin/ThreatTemplateDrawer';
import { CountermeasureTemplateDrawer } from '../components/admin/CountermeasureTemplateDrawer';
import { ImportDialog } from '../components/admin/ImportDialog';

type DrawerState =
  | { kind: 'none' }
  | { kind: 'package'; mode: 'create' } | { kind: 'package'; mode: 'edit'; pkg: AdminPackageWithTree }
  | { kind: 'module'; mode: 'create'; packageId: string; locked: boolean }
  | { kind: 'module'; mode: 'edit'; module: AdminModuleDetail; locked: boolean }
  | { kind: 'asset'; mode: 'create'; moduleId: string; locked: boolean }
  | { kind: 'asset'; mode: 'edit'; moduleId: string; tpl: AdminAssetTemplate; locked: boolean }
  | { kind: 'threat'; mode: 'create'; moduleId: string; locked: boolean }
  | { kind: 'threat'; mode: 'edit'; moduleId: string; tpl: AdminThreatTemplate; locked: boolean }
  | { kind: 'cm'; mode: 'create'; moduleId: string; locked: boolean }
  | { kind: 'cm'; mode: 'edit'; moduleId: string; tpl: AdminCountermeasureTemplate; locked: boolean };

export function AdminTemplatesPage() {
  const [packages, setPackages] = useState<AdminPackageWithTree[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [module, setModule] = useState<AdminModuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ kind: 'none' });
  const [importingFor, setImportingFor] = useState<{ moduleId?: string } | null>(null);
  const [importResult, setImportResult] = useState<AdminImportResult | null>(null);
  const [forkHint, setForkHint] = useState<string | null>(null);

  async function refresh() {
    try {
      const { items } = await adminTemplatesApi.listPackages();
      setPackages(items);
      setLoading(false);
      // refresh selected module if present
      if (selection?.kind === 'module') {
        try {
          const m = await adminTemplatesApi.getModule(selection.moduleId);
          setModule(m);
        } catch {
          setSelection(null);
          setModule(null);
        }
      }
    } catch (err) {
      setError(await extractError(err));
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function handleSelect(sel: Selection) {
    setSelection(sel);
    if (sel.kind === 'module') {
      try {
        const m = await adminTemplatesApi.getModule(sel.moduleId);
        setModule(m);
      } catch (err) {
        setError(await extractError(err));
      }
    } else {
      setModule(null);
    }
  }

  const selectedPackage =
    selection ? packages.find((p) => p.id === selection.packageId) ?? null : null;
  const isLocked = selectedPackage?.isSystem ?? false;

  async function handleDeletePackage(pkg: AdminPackageWithTree) {
    if (!window.confirm(`Delete package "${pkg.name}" and all its modules/templates? This cannot be undone.`)) return;
    try {
      await adminTemplatesApi.removePackage(pkg.id);
      setSelection(null);
      setModule(null);
      await refresh();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleDeleteModule(m: AdminModuleDetail) {
    if (!window.confirm(`Delete module "${m.name}"?`)) return;
    try {
      await adminTemplatesApi.removeModule(m.id);
      setSelection({ kind: 'package', packageId: m.packageId });
      setModule(null);
      await refresh();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleFork(pkg: AdminPackageWithTree) {
    const slug = window.prompt(`Fork "${pkg.name}". New slug:`, `${pkg.slug}-copy`);
    if (!slug) return;
    const name = window.prompt('New name:', `${pkg.name} (copy)`);
    if (!name) return;
    try {
      const created = await adminTemplatesApi.forkPackage(pkg.id, { slug, name });
      await refresh();
      setSelection({ kind: 'package', packageId: created.id });
      setForkHint(
        `Forked "${pkg.name}" → "${name}". To avoid duplicate suggestions in the assessment wizard, ` +
        `disable the original package using the toggle in its header.`,
      );
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleToggleEnabled(pkg: AdminPackageWithTree) {
    try {
      await adminTemplatesApi.updatePackage(pkg.id, { enabled: !pkg.enabled });
      await refresh();
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleExportBundle(pkg: AdminPackageWithTree) {
    try {
      const env = await adminTemplatesApi.exportPackageBundle(pkg.slug);
      downloadJson(`${pkg.slug}.bundle.json`, env);
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function handleExportModule(m: AdminModuleDetail) {
    try {
      const env = await adminTemplatesApi.exportModule(m.id);
      downloadJson(`${m.slug}.module.json`, env);
    } catch (err) {
      setError(await extractError(err));
    }
  }

  async function removeAssetTpl(t: AdminAssetTemplate) {
    if (!window.confirm(`Delete asset template "${t.name}"?`)) return;
    try { await adminTemplatesApi.removeAssetTemplate(t.id); await refresh(); }
    catch (err) { setError(await extractError(err)); }
  }
  async function removeThreatTpl(t: AdminThreatTemplate) {
    if (!window.confirm(`Delete threat template "${t.scenarioName}"?`)) return;
    try { await adminTemplatesApi.removeThreatTemplate(t.id); await refresh(); }
    catch (err) { setError(await extractError(err)); }
  }
  async function removeCmTpl(t: AdminCountermeasureTemplate) {
    if (!window.confirm(`Delete countermeasure template "${t.name}"?`)) return;
    try { await adminTemplatesApi.removeCountermeasureTemplate(t.id); await refresh(); }
    catch (err) { setError(await extractError(err)); }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-n-150 shrink-0 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-n-900">Template library editor</h1>
            <div className="text-[12px] text-n-500 mt-0.5">
              Admin · curate packages, modules, and individual templates. System packs are read-only — fork to edit.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn2
              variant="secondary"
              onClick={() => setImportingFor({})}
              leading={<Upload className="w-3.5 h-3.5" />}
            >
              Import bundle
            </Btn2>
          </div>
        </div>
        {error && (
          <div className="mt-3 text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
            {error}
          </div>
        )}
        {importResult && (
          <div className="mt-3 text-[12px] bg-n-50 border border-n-150 rounded-r2 px-3 py-2 flex items-start gap-3">
            <div className="flex-1">
              <div className="font-medium text-n-800">Import complete</div>
              <div className="text-n-600 mt-0.5">
                {importResult.created.length} created · {importResult.updated.length} updated · {importResult.skipped.length} skipped · {importResult.renamed.length} renamed
              </div>
            </div>
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className="text-[11px] text-n-500 hover:text-n-800"
            >
              Dismiss
            </button>
          </div>
        )}
        {forkHint && (
          <div className="mt-3 text-[12px] bg-a-50 border border-a-200 rounded-r2 px-3 py-2 flex items-start gap-3">
            <div className="flex-1 text-a-800">{forkHint}</div>
            <button
              type="button"
              onClick={() => setForkHint(null)}
              className="text-[11px] text-a-700 hover:text-a-900"
            >
              Dismiss
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[280px] border-r border-n-150 bg-white shrink-0">
          {loading ? (
            <div className="p-4 text-[12px] text-n-500">Loading…</div>
          ) : (
            <TemplatePackageTree
              packages={packages}
              selection={selection}
              onSelect={handleSelect}
              onNewPackage={() => setDrawer({ kind: 'package', mode: 'create' })}
              onNewModule={(packageId) => setDrawer({ kind: 'module', mode: 'create', packageId, locked: false })}
            />
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {!selection && !loading && (
            <div className="text-[13px] text-n-500">
              Select a package or module on the left, or{' '}
              <button
                type="button"
                className="text-a-700 hover:text-a-800 underline"
                onClick={() => setDrawer({ kind: 'package', mode: 'create' })}
              >
                create a new package
              </button>.
            </div>
          )}

          {selection?.kind === 'package' && selectedPackage && (
            <PackageView
              pkg={selectedPackage}
              onEdit={() => setDrawer({ kind: 'package', mode: 'edit', pkg: selectedPackage })}
              onDelete={() => handleDeletePackage(selectedPackage)}
              onFork={() => handleFork(selectedPackage)}
              onExport={() => handleExportBundle(selectedPackage)}
              onToggleEnabled={() => handleToggleEnabled(selectedPackage)}
              onNewModule={() =>
                setDrawer({ kind: 'module', mode: 'create', packageId: selectedPackage.id, locked: selectedPackage.isSystem })
              }
            />
          )}

          {selection?.kind === 'module' && module && selectedPackage && (
            <ModuleView
              pkg={selectedPackage}
              module={module}
              locked={isLocked}
              onEdit={() => setDrawer({ kind: 'module', mode: 'edit', module, locked: isLocked })}
              onDelete={() => handleDeleteModule(module)}
              onExport={() => handleExportModule(module)}
              onImportItem={() => setImportingFor({ moduleId: module.id })}
              onNewAsset={() => setDrawer({ kind: 'asset', mode: 'create', moduleId: module.id, locked: isLocked })}
              onEditAsset={(tpl) => setDrawer({ kind: 'asset', mode: 'edit', moduleId: module.id, tpl, locked: isLocked })}
              onRemoveAsset={removeAssetTpl}
              onNewThreat={() => setDrawer({ kind: 'threat', mode: 'create', moduleId: module.id, locked: isLocked })}
              onEditThreat={(tpl) => setDrawer({ kind: 'threat', mode: 'edit', moduleId: module.id, tpl, locked: isLocked })}
              onRemoveThreat={removeThreatTpl}
              onNewCm={() => setDrawer({ kind: 'cm', mode: 'create', moduleId: module.id, locked: isLocked })}
              onEditCm={(tpl) => setDrawer({ kind: 'cm', mode: 'edit', moduleId: module.id, tpl, locked: isLocked })}
              onRemoveCm={removeCmTpl}
            />
          )}
        </main>
      </div>

      {drawer.kind === 'package' && drawer.mode === 'create' && (
        <TemplatePackageDrawer
          mode={{ kind: 'create' }}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={async (pkg) => { await refresh(); setSelection({ kind: 'package', packageId: pkg.id }); setDrawer({ kind: 'none' }); }}
        />
      )}
      {drawer.kind === 'package' && drawer.mode === 'edit' && (
        <TemplatePackageDrawer
          mode={{ kind: 'edit', pkg: drawer.pkg }}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={async () => { await refresh(); setDrawer({ kind: 'none' }); }}
        />
      )}

      {drawer.kind === 'module' && drawer.mode === 'create' && (
        <TemplateModuleDrawer
          mode={{ kind: 'create', packageId: drawer.packageId, locked: drawer.locked }}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={async (m) => { await refresh(); setSelection({ kind: 'module', packageId: m.packageId, moduleId: m.id }); setDrawer({ kind: 'none' }); }}
        />
      )}
      {drawer.kind === 'module' && drawer.mode === 'edit' && (
        <TemplateModuleDrawer
          mode={{ kind: 'edit', module: drawer.module, locked: drawer.locked }}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={async () => { await refresh(); setDrawer({ kind: 'none' }); }}
        />
      )}

      {drawer.kind === 'asset' && module && (
        <AssetTemplateDrawer
          mode={
            drawer.mode === 'create'
              ? { kind: 'create', moduleId: drawer.moduleId, locked: drawer.locked }
              : { kind: 'edit', moduleId: drawer.moduleId, assetTemplate: drawer.tpl, locked: drawer.locked }
          }
          module={module}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={refresh}
        />
      )}
      {drawer.kind === 'threat' && module && (
        <ThreatTemplateDrawer
          mode={
            drawer.mode === 'create'
              ? { kind: 'create', moduleId: drawer.moduleId, locked: drawer.locked }
              : { kind: 'edit', moduleId: drawer.moduleId, threatTemplate: drawer.tpl, locked: drawer.locked }
          }
          module={module}
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={refresh}
        />
      )}
      {drawer.kind === 'cm' && (
        <CountermeasureTemplateDrawer
          mode={
            drawer.mode === 'create'
              ? { kind: 'create', moduleId: drawer.moduleId, locked: drawer.locked }
              : { kind: 'edit', moduleId: drawer.moduleId, cmTemplate: drawer.tpl, locked: drawer.locked }
          }
          onClose={() => setDrawer({ kind: 'none' })}
          onSaved={refresh}
        />
      )}

      {importingFor && (
        <ImportDialog
          moduleId={importingFor.moduleId}
          onClose={() => setImportingFor(null)}
          onImported={async (r) => {
            setImportResult(r);
            setImportingFor(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function PackageView({
  pkg, onEdit, onDelete, onFork, onExport, onToggleEnabled, onNewModule,
}: {
  pkg: AdminPackageWithTree;
  onEdit: () => void;
  onDelete: () => void;
  onFork: () => void;
  onExport: () => void;
  onToggleEnabled: () => void;
  onNewModule: () => void;
}) {
  return (
    <div className={`space-y-5 ${!pkg.enabled ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Package className="w-5 h-5 text-n-500 mt-1" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold text-n-900">{pkg.name}</h2>
              {!pkg.enabled && <Pill variant="outline">Disabled</Pill>}
            </div>
            <div className="text-[11px] font-mono text-n-500 mt-0.5">
              {pkg.slug} · v{pkg.version}
              {pkg.isSystem && <> · <span className="text-n-600">SYSTEM</span></>}
            </div>
            {pkg.description && <div className="text-[13px] text-n-700 mt-2 max-w-[640px]">{pkg.description}</div>}
            {pkg.complianceRefs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {pkg.complianceRefs.map((t) => <Pill key={t} variant="outline">{t}</Pill>)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Btn2
            variant="secondary"
            leading={<Power className="w-3.5 h-3.5" />}
            onClick={onToggleEnabled}
            title={pkg.enabled
              ? "Hide this package's templates from assessment-wizard suggestions. Existing assets and threats are not affected."
              : 'Re-enable this package so its templates appear in wizard suggestions.'}
          >
            {pkg.enabled ? 'Disable' : 'Enable'}
          </Btn2>
          <Btn2 variant="secondary" leading={<Download className="w-3.5 h-3.5" />} onClick={onExport}>
            Export bundle
          </Btn2>
          {pkg.isSystem ? (
            <Btn2 variant="primary" leading={<GitBranch className="w-3.5 h-3.5" />} onClick={onFork}>
              Fork
            </Btn2>
          ) : (
            <>
              <Btn2 variant="secondary" leading={<Pencil className="w-3.5 h-3.5" />} onClick={onEdit}>
                Edit
              </Btn2>
              <Btn2 variant="danger" leading={<Trash2 className="w-3.5 h-3.5" />} onClick={onDelete}>
                Delete
              </Btn2>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-n-800">Modules · {pkg.modules.length}</h3>
          {!pkg.isSystem && (
            <Btn2 variant="secondary" leading={<Plus className="w-3.5 h-3.5" />} onClick={onNewModule}>
              New module
            </Btn2>
          )}
        </div>
        {pkg.modules.length === 0 && (
          <div className="text-[12.5px] text-n-500 italic">No modules yet.</div>
        )}
        <div className="space-y-1.5">
          {pkg.modules.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border border-n-150 rounded-r2 px-3 py-2 bg-white">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-n-800 truncate">{m.name}</div>
                <div className="text-[11px] font-mono text-n-500">{m.slug}</div>
              </div>
              <div className="text-[11px] font-mono text-n-500 shrink-0">
                {m.assetTemplateCount} A · {m.threatTemplateCount} T · {m.countermeasureTemplateCount} CM
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleView({
  pkg, module, locked,
  onEdit, onDelete, onExport, onImportItem,
  onNewAsset, onEditAsset, onRemoveAsset,
  onNewThreat, onEditThreat, onRemoveThreat,
  onNewCm, onEditCm, onRemoveCm,
}: {
  pkg: AdminPackageWithTree;
  module: AdminModuleDetail;
  locked: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onImportItem: () => void;
  onNewAsset: () => void;
  onEditAsset: (t: AdminAssetTemplate) => void;
  onRemoveAsset: (t: AdminAssetTemplate) => void;
  onNewThreat: () => void;
  onEditThreat: (t: AdminThreatTemplate) => void;
  onRemoveThreat: (t: AdminThreatTemplate) => void;
  onNewCm: () => void;
  onEditCm: (t: AdminCountermeasureTemplate) => void;
  onRemoveCm: (t: AdminCountermeasureTemplate) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px]">
            {pkg.name}{locked && ' · system'}
          </div>
          <h2 className="text-[17px] font-semibold text-n-900 mt-0.5">{module.name}</h2>
          <div className="text-[11px] font-mono text-n-500 mt-0.5">{module.slug}</div>
          {module.description && <div className="text-[13px] text-n-700 mt-2 max-w-[640px]">{module.description}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Btn2 variant="secondary" leading={<Download className="w-3.5 h-3.5" />} onClick={onExport}>Export module</Btn2>
          {!locked && (
            <>
              <Btn2 variant="secondary" leading={<Upload className="w-3.5 h-3.5" />} onClick={onImportItem}>Import item</Btn2>
              <Btn2 variant="secondary" leading={<Pencil className="w-3.5 h-3.5" />} onClick={onEdit}>Edit</Btn2>
              <Btn2 variant="danger" leading={<Trash2 className="w-3.5 h-3.5" />} onClick={onDelete}>Delete</Btn2>
            </>
          )}
        </div>
      </div>

      <Group title={`Asset templates · ${module.assetTemplates.length}`} onNew={locked ? undefined : onNewAsset}>
        {module.assetTemplates.length === 0 ? (
          <Empty>No asset templates.</Empty>
        ) : module.assetTemplates.map((t) => (
          <Row
            key={t.id}
            title={t.name}
            subtitle={`${t.slug} · ${t.assetType} · criticality ${t.defaultCriticality}`}
            tags={t.tags}
            locked={locked}
            onEdit={() => onEditAsset(t)}
            onRemove={() => onRemoveAsset(t)}
          />
        ))}
      </Group>

      <Group title={`Threat templates · ${module.threatTemplates.length}`} onNew={locked ? undefined : onNewThreat}>
        {module.threatTemplates.length === 0 ? (
          <Empty>No threat templates.</Empty>
        ) : module.threatTemplates.map((t) => (
          <Row
            key={t.id}
            title={t.scenarioName}
            subtitle={`${t.slug} · ${t.adversaryType} · ${t.actionType}`}
            tags={t.targetAssetTypes}
            locked={locked}
            onEdit={() => onEditThreat(t)}
            onRemove={() => onRemoveThreat(t)}
          />
        ))}
      </Group>

      <Group title={`Countermeasure templates · ${module.countermeasureTemplates.length}`} onNew={locked ? undefined : onNewCm}>
        {module.countermeasureTemplates.length === 0 ? (
          <Empty>No countermeasure templates.</Empty>
        ) : module.countermeasureTemplates.map((t) => (
          <Row
            key={t.id}
            title={t.name}
            subtitle={`${t.slug} · ${t.shapeCategory} · ${t.domain}`}
            tags={t.ppsFunctions}
            locked={locked}
            onEdit={() => onEditCm(t)}
            onRemove={() => onRemoveCm(t)}
          />
        ))}
      </Group>
    </div>
  );
}

function Group({ title, onNew, children }: { title: string; onNew?: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-n-800">{title}</h3>
        {onNew && (
          <Btn2 variant="secondary" leading={<Plus className="w-3.5 h-3.5" />} onClick={onNew}>New</Btn2>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-n-500 italic">{children}</div>;
}

function Row({
  title, subtitle, tags, locked, onEdit, onRemove,
}: {
  title: string; subtitle: string; tags: string[];
  locked: boolean;
  onEdit: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-n-150 rounded-r2 px-3 py-2 bg-white">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-n-800 truncate">{title}</div>
        <div className="text-[11px] font-mono text-n-500 truncate">{subtitle}</div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.slice(0, 6).map((t) => <Pill key={t} variant="outline">{t}</Pill>)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
          aria-label={locked ? 'View' : 'Edit'}
          title={locked ? 'View' : 'Edit'}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {!locked && (
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center text-bad hover:bg-bad-bg rounded-r1"
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
