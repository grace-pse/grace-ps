import { useEffect, useState } from 'react';
import { X, Search, Package as PackageIcon } from 'lucide-react';
import { Btn2 } from './hifi/Btn2';
import { Pill } from './hifi/Pill';
import { countermeasureTemplatesApi, templatesApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import {
  SHAPE_CATEGORIES,
  SHAPE_CATEGORY_LABEL,
  PROTECTION_DOMAINS,
  PPS_FUNCTIONS,
  type CountermeasureTemplateDetail,
  type CountermeasureTemplateSummary,
  type ProtectionDomain,
  type ShapeCategory,
  type PpsFunction,
  type TemplatePackage,
} from '../lib/csmp-types';

interface Props {
  onClose: () => void;
  onPick: (tpl: CountermeasureTemplateDetail) => void;
}

export function CountermeasureTemplatePickerDrawer({ onClose, onPick }: Props) {
  const [packages, setPackages] = useState<TemplatePackage[]>([]);
  const [items, setItems] = useState<CountermeasureTemplateSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [packageSlug, setPackageSlug] = useState('');
  const [shapeCategory, setShapeCategory] = useState<ShapeCategory | ''>('');
  const [domain, setDomain] = useState<ProtectionDomain | ''>('');
  const [ppsFunction, setPpsFunction] = useState<PpsFunction | ''>('');

  useEffect(() => {
    templatesApi.listPackages().then((r) => setPackages(r.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    countermeasureTemplatesApi
      .list({
        search: search || undefined,
        packageSlug: packageSlug || undefined,
        shapeCategory: (shapeCategory || undefined) as ShapeCategory | undefined,
        domain: (domain || undefined) as ProtectionDomain | undefined,
        ppsFunction: (ppsFunction || undefined) as PpsFunction | undefined,
        pageSize: 100,
      })
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(async (err) => {
        if (!cancelled) setError(await extractError(err));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [search, packageSlug, shapeCategory, domain, ppsFunction]);

  async function handlePick(id: string) {
    setPicking(id);
    try {
      const detail = await countermeasureTemplatesApi.get(id);
      onPick(detail);
    } catch (err) {
      setError(await extractError(err));
      setPicking(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[620px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col"
        role="dialog"
        aria-labelledby="cm-tpl-picker-title"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150 shrink-0">
          <div>
            <h2 id="cm-tpl-picker-title" className="text-[15px] font-semibold text-n-900">
              Pick a countermeasure template
            </h2>
            <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
              {total} available
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-3 border-b border-n-150 grid grid-cols-3 gap-2 shrink-0">
          <label className="relative col-span-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-n-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countermeasures…"
              className="w-full h-8 pl-8 pr-2.5 text-[12.5px] border border-n-200 rounded-r2 focus:border-a-500 focus:outline-none"
            />
          </label>
          <select
            value={packageSlug}
            onChange={(e) => setPackageSlug(e.target.value)}
            className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
          >
            <option value="">All packages</option>
            {packages.map((p) => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </select>
          <select
            value={shapeCategory}
            onChange={(e) => setShapeCategory(e.target.value as ShapeCategory | '')}
            className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
          >
            <option value="">All SHAPE</option>
            {SHAPE_CATEGORIES.map((s) => (
              <option key={s} value={s}>{SHAPE_CATEGORY_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as ProtectionDomain | '')}
            className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none"
          >
            <option value="">All domains</option>
            {PROTECTION_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={ppsFunction}
            onChange={(e) => setPpsFunction(e.target.value as PpsFunction | '')}
            className="h-8 px-2 text-[12px] border border-n-200 rounded-r2 bg-white focus:border-a-500 focus:outline-none col-span-2"
          >
            <option value="">All PPS functions</option>
            {PPS_FUNCTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-[12.5px] text-n-500">Loading…</div>
          ) : error ? (
            <div className="m-5 text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r2 px-3 py-2">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-[12.5px] text-n-500">No countermeasures match your filters.</div>
          ) : (
            <ul className="divide-y divide-n-100">
              {items.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    disabled={!!picking}
                    onClick={() => handlePick(tpl.id)}
                    className="w-full text-left px-5 py-3 hover:bg-n-75 transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-medium text-n-900 truncate">{tpl.name}</span>
                          <Pill variant="accent">{SHAPE_CATEGORY_LABEL[tpl.shapeCategory]}</Pill>
                          <Pill variant="outline">{tpl.domain}</Pill>
                        </div>
                        {tpl.description && (
                          <p className="text-[11.5px] text-n-600 mt-0.5 line-clamp-2">{tpl.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {tpl.ppsFunctions.map((fn) => (
                            <Pill key={fn} variant="default">{fn}</Pill>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px]">
                          <PackageIcon className="w-3 h-3" />
                          <span>{tpl.module.package.name}</span>
                          <span className="text-n-300">·</span>
                          <span>{tpl.module.name}</span>
                        </div>
                      </div>
                      {picking === tpl.id && (
                        <div className="shrink-0 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                          Loading…
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
          <Btn2 type="button" variant="ghost" onClick={onClose}>Cancel</Btn2>
        </footer>
      </aside>
    </>
  );
}
