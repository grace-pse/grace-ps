import { useState } from 'react';
import { ChevronDown, ChevronRight, Package, Lock, Plus } from 'lucide-react';
import type { AdminPackageWithTree } from '../../lib/csmp-types';

export type Selection =
  | { kind: 'package'; packageId: string }
  | { kind: 'module'; packageId: string; moduleId: string };

interface Props {
  packages: AdminPackageWithTree[];
  selection: Selection | null;
  onSelect: (sel: Selection) => void;
  onNewPackage: () => void;
  onNewModule: (packageId: string) => void;
}

export function TemplatePackageTree({
  packages, selection, onSelect, onNewPackage, onNewModule,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(packages.map((p) => p.id)));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-n-150 flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Packages</div>
        <button
          type="button"
          onClick={onNewPackage}
          className="inline-flex items-center gap-1 text-[11px] text-a-700 hover:text-a-800"
        >
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {packages.length === 0 && (
          <div className="px-3 py-4 text-[11.5px] text-n-500">No packages yet.</div>
        )}
        {packages.map((p) => {
          const isExpanded = expanded.has(p.id);
          const pkgActive = selection?.kind === 'package' && selection.packageId === p.id;
          return (
            <div key={p.id}>
              <div
                className={[
                  'flex items-center gap-1 px-2 py-1 mx-1 rounded-r1 cursor-pointer group',
                  pkgActive ? 'bg-a-50 text-a-700' : 'hover:bg-n-75 text-n-800',
                ].join(' ')}
                onClick={() => { toggle(p.id); onSelect({ kind: 'package', packageId: p.id }); }}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(p.id); }}
                  className="w-4 h-4 flex items-center justify-center shrink-0 text-n-500"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate text-[12.5px] font-medium">{p.name}</span>
                {p.isSystem && (
                  <Lock className="w-3 h-3 text-n-400 shrink-0" aria-label="System · locked" />
                )}
              </div>
              {isExpanded && (
                <div>
                  {p.modules.map((m) => {
                    const modActive = selection?.kind === 'module' && selection.moduleId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelect({ kind: 'module', packageId: p.id, moduleId: m.id })}
                        className={[
                          'flex items-center gap-1.5 pl-7 pr-2 py-1 mx-1 rounded-r1 cursor-pointer text-[12px]',
                          modActive ? 'bg-a-50 text-a-700 font-medium' : 'hover:bg-n-75 text-n-700',
                        ].join(' ')}
                      >
                        <span className="flex-1 truncate">{m.name}</span>
                        <span className="text-[10px] font-mono text-n-400">
                          {m.assetTemplateCount}A·{m.threatTemplateCount}T·{m.countermeasureTemplateCount}CM
                        </span>
                      </div>
                    );
                  })}
                  {!p.isSystem && (
                    <button
                      type="button"
                      onClick={() => onNewModule(p.id)}
                      className="flex items-center gap-1 pl-7 pr-2 py-1 mx-1 text-[11px] text-a-700 hover:bg-n-75 rounded-r1 w-[calc(100%-8px)]"
                    >
                      <Plus className="w-3 h-3" /> New module
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
