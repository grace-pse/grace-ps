import { useEffect, useState } from 'react';
import { Plus, GitFork, Pencil, Trash2, Package as PackageIcon } from 'lucide-react';
import { Btn2 } from '../../components/hifi/Btn2';
import { Pill } from '../../components/hifi/Pill';
import { Card } from '../../components/hifi/Card';
import { TemplatePackageDrawer } from '../../components/admin/TemplatePackageDrawer';
import { adminTemplatesApi } from '../../lib/csmp-api';
import { extractError } from '../../lib/api';
import type { AdminPackageWithTree } from '../../lib/csmp-types';

type DrawerMode =
  | { kind: 'create' }
  | { kind: 'edit'; pkg: AdminPackageWithTree }
  | null;

interface ForkState {
  src: AdminPackageWithTree;
  slug: string;
  name: string;
  saving: boolean;
  error: string | null;
}

export function TemplatePackagesPage() {
  const [packages, setPackages] = useState<AdminPackageWithTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [fork, setFork] = useState<ForkState | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminTemplatesApi.listPackages();
        if (!cancelled) setPackages(r.items);
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSaved(saved: AdminPackageWithTree) {
    setDrawer(null);
    setPackages((list) => {
      const idx = list.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [saved, ...list];
      const next = list.slice();
      next[idx] = saved;
      return next;
    });
  }

  async function handleToggleEnabled(pkg: AdminPackageWithTree) {
    setTogglingId(pkg.id);
    setError(null);
    try {
      const updated = await adminTemplatesApi.updatePackage(pkg.id, {
        enabled: !pkg.enabled,
      });
      setPackages((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(pkg: AdminPackageWithTree) {
    if (!window.confirm(`Delete package "${pkg.name}"? This removes all of its modules and templates.`)) {
      return;
    }
    setError(null);
    try {
      await adminTemplatesApi.removePackage(pkg.id);
      setPackages((list) => list.filter((p) => p.id !== pkg.id));
    } catch (err) {
      setError(await extractError(err));
    }
  }

  function openFork(pkg: AdminPackageWithTree) {
    setFork({
      src: pkg,
      slug: `${pkg.slug}-fork`,
      name: `${pkg.name} (fork)`,
      saving: false,
      error: null,
    });
  }

  async function submitFork() {
    if (!fork) return;
    const slug = fork.slug.trim();
    const name = fork.name.trim();
    if (!slug || !name) return;
    setFork({ ...fork, saving: true, error: null });
    try {
      const created = await adminTemplatesApi.forkPackage(fork.src.id, { slug, name });
      setPackages((list) => [created, ...list]);
      setFork(null);
    } catch (err) {
      const msg = await extractError(err);
      setFork((s) => (s ? { ...s, saving: false, error: msg } : s));
    }
  }

  if (loading) {
    return <div className="text-[12.5px] text-n-500">Loading template packages…</div>;
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-n-900">Template packages</h2>
          <p className="text-[12.5px] text-n-600 mt-1">
            Curated bundles of asset, threat, and countermeasure templates. Fork a system package
            to get an editable copy, or create one from scratch. Edit individual templates from
            <span className="text-n-700"> Catalog → Templates</span>.
          </p>
        </div>
        <Btn2
          className="whitespace-nowrap shrink-0"
          leading={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setDrawer({ kind: 'create' })}
        >
          New package
        </Btn2>
      </div>

      {error && (
        <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {packages.length === 0 ? (
        <Card className="p-6 text-center">
          <PackageIcon className="w-6 h-6 text-n-400 mx-auto mb-2" />
          <div className="text-[13px] text-n-700 font-medium">No packages yet</div>
          <div className="text-[12px] text-n-500 mt-1">
            Create one or fork an existing system package.
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {packages.map((p) => (
            <PackageRow
              key={p.id}
              pkg={p}
              busyToggle={togglingId === p.id}
              onToggleEnabled={() => handleToggleEnabled(p)}
              onFork={() => openFork(p)}
              onEdit={() => setDrawer({ kind: 'edit', pkg: p })}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {drawer && (
        <TemplatePackageDrawer
          mode={drawer}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
        />
      )}

      {fork && (
        <ForkDialog
          state={fork}
          onChange={(next) => setFork(next)}
          onCancel={() => setFork(null)}
          onSubmit={submitFork}
        />
      )}
    </div>
  );
}

interface PackageRowProps {
  pkg: AdminPackageWithTree;
  busyToggle: boolean;
  onToggleEnabled: () => void;
  onFork: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PackageRow({ pkg, busyToggle, onToggleEnabled, onFork, onEdit, onDelete }: PackageRowProps) {
  const totals = pkg.modules.reduce(
    (acc, m) => {
      acc.assets += m.assetTemplateCount;
      acc.threats += m.threatTemplateCount;
      acc.cms += m.countermeasureTemplateCount;
      return acc;
    },
    { assets: 0, threats: 0, cms: 0 },
  );

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-semibold text-n-900 truncate">{pkg.name}</h3>
            <span className="text-[11px] font-mono text-n-500">{pkg.slug}</span>
            <Pill variant="outline">v{pkg.version}</Pill>
            {pkg.isSystem ? (
              <Pill variant="info">System</Pill>
            ) : (
              <Pill variant="accent">Custom</Pill>
            )}
            {!pkg.enabled && <Pill variant="warn">Disabled</Pill>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11.5px] text-n-500">
            {pkg.industry && <span>{pkg.industry}</span>}
            {pkg.regionScope && <span>{pkg.regionScope}</span>}
            {pkg.complianceRefs.length > 0 && (
              <span>{pkg.complianceRefs.join(' · ')}</span>
            )}
          </div>
          {pkg.description && (
            <p className="text-[12.5px] text-n-700 mt-1.5 line-clamp-2">{pkg.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11.5px] text-n-600">
            <span>{pkg.modules.length} modules</span>
            <span className="text-n-300">·</span>
            <span>{totals.assets} assets</span>
            <span className="text-n-300">·</span>
            <span>{totals.threats} threats</span>
            <span className="text-n-300">·</span>
            <span>{totals.cms} countermeasures</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px]">
              {pkg.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <input
              type="checkbox"
              checked={pkg.enabled}
              onChange={onToggleEnabled}
              disabled={busyToggle}
              className="h-3.5 w-3.5 accent-a-500 cursor-pointer disabled:opacity-50"
            />
          </label>

          <div className="flex items-center gap-1.5">
            <Btn2 variant="secondary" leading={<GitFork className="w-3.5 h-3.5" />} onClick={onFork}>
              Fork
            </Btn2>
            {!pkg.isSystem && (
              <>
                <Btn2 variant="ghost" leading={<Pencil className="w-3.5 h-3.5" />} onClick={onEdit}>
                  Edit
                </Btn2>
                <Btn2 variant="ghost" leading={<Trash2 className="w-3.5 h-3.5" />} onClick={onDelete}>
                  Delete
                </Btn2>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

interface ForkDialogProps {
  state: ForkState;
  onChange: (next: ForkState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function ForkDialog({ state, onChange, onCancel, onSubmit }: ForkDialogProps) {
  const canSubmit = !state.saving && state.slug.trim() && state.name.trim();
  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onCancel} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="fork-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-md bg-white border border-n-200 rounded-r3 shadow-sh3"
      >
        <header className="px-5 py-3.5 border-b border-n-150">
          <h2 id="fork-dialog-title" className="text-[14px] font-semibold text-n-900">
            Fork &quot;{state.src.name}&quot;
          </h2>
          <p className="text-[11.5px] text-n-500 mt-0.5">
            Creates an editable copy with all of its modules, templates, and links.
          </p>
        </header>
        <form
          className="p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
        >
          <label className="block">
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
              New slug
            </div>
            <input
              required
              value={state.slug}
              onChange={(e) => onChange({ ...state, slug: e.target.value })}
              pattern="[a-z0-9][a-z0-9-]*"
              maxLength={100}
              className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 font-mono focus:border-a-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">
              New name
            </div>
            <input
              required
              value={state.name}
              onChange={(e) => onChange({ ...state, name: e.target.value })}
              maxLength={255}
              className="w-full h-9 px-2.5 text-[13px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
            />
          </label>
          {state.error && (
            <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">
              {state.error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Btn2 type="button" variant="ghost" onClick={onCancel}>Cancel</Btn2>
            <Btn2 type="submit" disabled={!canSubmit}>
              {state.saving ? 'Forking…' : 'Fork package'}
            </Btn2>
          </div>
        </form>
      </div>
    </>
  );
}
