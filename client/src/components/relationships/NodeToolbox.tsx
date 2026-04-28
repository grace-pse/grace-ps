import { useEffect, useMemo, useState } from 'react';
import {
  X, ExternalLink, Pencil, Focus, ChevronDown, ChevronRight, Plus, Trash2,
  ArrowRight, ArrowLeftRight,
} from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { Pill } from '../hifi/Pill';
import {
  RELATIONSHIP_TYPE_LABEL,
  ASSET_ROLE_LABEL,
  type AssetGraphResponse,
} from '../../lib/csmp-types';

interface NodeToolboxProps {
  graph: AssetGraphResponse;
  nodeId: string;
  collapsed: boolean;
  onClose: () => void;
  onEdit: () => void;
  onOpenInAssets: () => void;
  onIsolate: () => void;
  onToggleCollapse: () => void;
  onAddChild: () => void;
  onDeleteRelationship: (relationshipId: string) => Promise<void>;
}

export function NodeToolbox({
  graph,
  nodeId,
  collapsed,
  onClose,
  onEdit,
  onOpenInAssets,
  onIsolate,
  onToggleCollapse,
  onAddChild,
  onDeleteRelationship,
}: NodeToolboxProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const node = useMemo(
    () => graph.nodes.find((n) => n.id === nodeId) ?? null,
    [graph, nodeId],
  );

  const childCount = useMemo(
    () => graph.nodes.filter((n) => n.parentId === nodeId).length,
    [graph, nodeId],
  );

  const inbound = useMemo(
    () => graph.edges.filter((e) => e.targetAssetId === nodeId),
    [graph, nodeId],
  );

  const outbound = useMemo(
    () => graph.edges.filter((e) => e.sourceAssetId === nodeId),
    [graph, nodeId],
  );

  const nameOf = (id: string) =>
    graph.nodes.find((n) => n.id === id)?.name ?? id.slice(0, 8);

  const handleDelete = async (relId: string) => {
    setDeletingId(relId);
    setError(null);
    try {
      await onDeleteRelationship(relId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  };

  if (!node) {
    return (
      <>
        <div className="fixed inset-0 bg-n-900/30 z-30 csmp-no-export" onClick={onClose} aria-hidden />
        <aside className="fixed right-0 top-0 h-full w-full max-w-[380px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col csmp-no-export">
          <header className="flex items-center justify-between px-4 py-3 border-b border-n-150">
            <div className="text-[13px] font-semibold text-n-900">Node not found</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 grid place-items-center text-n-500 hover:text-n-800 hover:bg-n-100 rounded-r1"
            >
              <X size={14} />
            </button>
          </header>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30 csmp-no-export" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Node toolbox"
        className="fixed right-0 top-0 h-full w-full max-w-[380px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col csmp-no-export"
      >
        <header className="flex items-start justify-between px-4 py-3 border-b border-n-150 gap-2 shrink-0">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-n-900 truncate" title={node.name}>
              {node.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Pill variant="outline">{node.assetType}</Pill>
              <Pill variant={node.assetRole === 'PROTECTIVE' || node.assetRole === 'DUAL' ? 'accent' : 'default'}>
                {ASSET_ROLE_LABEL[node.assetRole]}
              </Pill>
              <Pill variant="accent">C{node.criticality}</Pill>
              <Pill variant="default">{node.status}</Pill>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 grid place-items-center text-n-500 hover:text-n-800 hover:bg-n-100 rounded-r1 shrink-0"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <section>
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1.5">
              At a glance
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Children" value={childCount} />
              <Stat label="Inbound" value={inbound.length} />
              <Stat label="Outbound" value={outbound.length} />
            </div>
          </section>

          <section>
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1.5">
              Actions
            </div>
            <div className="space-y-1.5">
              <ActionRow icon={<Pencil size={12} />} label="Edit asset" onClick={onEdit} />
              <ActionRow icon={<ExternalLink size={12} />} label="Open in Assets page" onClick={onOpenInAssets} />
              <ActionRow icon={<Focus size={12} />} label="Isolate this branch" onClick={onIsolate} />
              {childCount > 0 && (
                <ActionRow
                  icon={collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  label={collapsed ? `Expand children (${childCount})` : `Collapse children (${childCount})`}
                  onClick={onToggleCollapse}
                />
              )}
              <ActionRow icon={<Plus size={12} />} label="Add child asset" onClick={onAddChild} />
            </div>
          </section>

          <section>
            <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1.5">
              Connections ({inbound.length + outbound.length})
            </div>
            {inbound.length === 0 && outbound.length === 0 ? (
              <div className="text-[11.5px] text-n-500 border border-dashed border-n-200 rounded-r2 px-3 py-2.5 bg-n-50/40">
                No relationships yet. Drag from a handle to another node to connect.
              </div>
            ) : (
              <div className="border border-n-150 rounded-r2 divide-y divide-n-100 overflow-hidden bg-white">
                {outbound.map((e) => (
                  <ConnectionRow
                    key={e.id}
                    direction="out"
                    bidi={e.direction === 'BIDIRECTIONAL'}
                    typeLabel={RELATIONSHIP_TYPE_LABEL[e.relationshipType]}
                    otherName={nameOf(e.targetAssetId)}
                    deleting={deletingId === e.id}
                    onDelete={() => handleDelete(e.id)}
                  />
                ))}
                {inbound.map((e) => (
                  <ConnectionRow
                    key={e.id}
                    direction="in"
                    bidi={e.direction === 'BIDIRECTIONAL'}
                    typeLabel={RELATIONSHIP_TYPE_LABEL[e.relationshipType]}
                    otherName={nameOf(e.sourceAssetId)}
                    deleting={deletingId === e.id}
                    onDelete={() => handleDelete(e.id)}
                  />
                ))}
              </div>
            )}
            {error && (
              <div className="mt-2 text-[11.5px] text-bad bg-bad-bg border border-bad/20 rounded-r1 px-2 py-1.5">
                {error}
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-n-150 px-4 py-3 flex justify-end shrink-0">
          <Btn2 type="button" variant="ghost" onClick={onClose}>Done</Btn2>
        </footer>
      </aside>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-n-150 rounded-r2 px-2 py-1.5 bg-white">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{label}</div>
      <div className="text-[14px] font-semibold text-n-900 mt-0.5">{value}</div>
    </div>
  );
}

function ActionRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] text-n-800 border border-n-150 rounded-r2 bg-white hover:bg-n-50 hover:border-n-200"
    >
      <span className="text-n-500">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function ConnectionRow({
  direction, bidi, typeLabel, otherName, deleting, onDelete,
}: {
  direction: 'in' | 'out';
  bidi: boolean;
  typeLabel: string;
  otherName: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  const Icon = bidi ? ArrowLeftRight : ArrowRight;
  return (
    <div className="px-3 py-2 flex items-center gap-2">
      <span className="text-n-500 shrink-0">
        <Icon size={12} className={direction === 'in' ? 'rotate-180' : ''} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-n-900 font-medium truncate" title={otherName}>{otherName}</div>
        <div className="text-[10px] font-mono text-n-500 tracking-[0.4px] mt-0.5">
          {direction === 'out' ? 'OUT' : 'IN'} · {typeLabel}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label="Delete relationship"
        title="Delete relationship"
        className="w-6 h-6 grid place-items-center text-n-400 hover:text-bad hover:bg-bad-bg rounded-r1 disabled:opacity-50"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
