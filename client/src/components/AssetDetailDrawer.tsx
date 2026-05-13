import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  X, ArrowRight, ArrowLeftRight, Eye, Shield, ShieldCheck, ShieldHalf,
  AlertTriangle, ExternalLink, Copy, Check,
} from 'lucide-react';
import { Btn2 } from './hifi/Btn2';
import { Pill } from './hifi/Pill';
import {
  ASSET_ROLE_LABEL, OPERATIONAL_STATUS_LABEL, RELATIONSHIP_TYPE_LABEL,
  criticalityToRiskLevel,
  type AssetDetail, type AssetGraphResponse, type AssetRelationshipSummary,
  type AssetType, type AssetSummary, type ProtectiveCoverageResponse,
  type ProtectiveCoverageItem, type RelationshipType,
} from '../lib/csmp-types';
import { assetsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { useAppearanceStore } from '../stores/appearance';
import { resolveIcon, getShapeRadiusClass } from '../lib/appearance-defaults';
import { useAssetSelectionStore } from '../stores/assetSelection';

// Read-only side panel that summarises everything the user usually wants to
// know about an asset without dragging them into the canvas: parent chain,
// children grouped by type, protective coverage in/out, dependencies in/out,
// status. Opens via the shared `useAssetSelectionStore` so any view (graph,
// tree, future matrix) can drive it.

const PROTECTIVE_RELS: RelationshipType[] = ['PROTECTS', 'MONITORS'];

interface DrawerData {
  detail: AssetDetail;
  graph: AssetGraphResponse;
  coverage: ProtectiveCoverageResponse;
}

export function AssetDetailDrawer() {
  const selectedId = useAssetSelectionStore((s) => s.selectedId);
  const close = useAssetSelectionStore((s) => s.close);
  const open = useAssetSelectionStore((s) => s.open);
  const navigate = useNavigate();
  const appearance = useAppearanceStore((s) => s.appearance);

  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch whenever the selection changes. Three parallel requests; we
  // accept the latency over a chained sequence and a per-asset endpoint for
  // Phase 1.
  useEffect(() => {
    if (!selectedId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [detail, graph, coverage] = await Promise.all([
          assetsApi.get(selectedId),
          assetsApi.graph(),
          assetsApi.protectiveCoverage(selectedId),
        ]);
        if (cancelled) return;
        setData({ detail, graph, coverage });
      } catch (err) {
        if (cancelled) return;
        setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  // Esc closes the drawer.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, close]);

  if (!selectedId) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-n-900/20 z-30 csmp-no-export"
        onClick={close}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col csmp-no-export"
        role="dialog"
        aria-labelledby="asset-detail-drawer-title"
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-n-150 shrink-0 gap-2">
          <div className="min-w-0 flex items-center gap-2">
            {data && <NodeChip type={data.detail.assetType} />}
            <h2
              id="asset-detail-drawer-title"
              className="text-[14px] font-semibold text-n-900 truncate"
            >
              {data?.detail.name ?? 'Loading…'}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {loading && !data ? (
          <div className="flex-1 flex items-center justify-center text-[12.5px] text-n-500">
            Loading…
          </div>
        ) : error ? (
          <div className="flex-1 p-5">
            <div className="text-[12px] text-bad bg-bad-bg border border-bad/20 rounded-r1 px-3 py-2">
              {error}
            </div>
          </div>
        ) : data ? (
          <DrawerBody
            data={data}
            onSelectAsset={open}
            onIsolateInGraph={() => {
              void navigate({ to: '/relationships', search: { isolate: data.detail.id } });
              close();
            }}
            chipFor={(t) => <NodeChip type={t} />}
            roleStyle={appearance.assetRoleStyles}
          />
        ) : null}
      </aside>
    </>
  );
}

function NodeChip({ type }: { type: AssetType }) {
  const appearance = useAppearanceStore((s) => s.appearance);
  const t = appearance.assetTypeStyles[type];
  const Icon = resolveIcon(t.iconName);
  const shape = getShapeRadiusClass(type);
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 shrink-0 ${shape}`}
      style={{ backgroundColor: t.bg, color: t.ink }}
      title={t.abbr}
    >
      <Icon size={13} />
    </span>
  );
}

interface DrawerBodyProps {
  data: DrawerData;
  onSelectAsset: (id: string) => void;
  onIsolateInGraph: () => void;
  chipFor: (t: AssetType) => React.ReactNode;
  roleStyle: ReturnType<typeof useAppearanceStore.getState>['appearance']['assetRoleStyles'];
}

function DrawerBody({ data, onSelectAsset, onIsolateInGraph, chipFor, roleStyle }: DrawerBodyProps) {
  const { detail, graph, coverage } = data;

  // Index nodes for label lookups when rendering edges.
  const nameById = useMemo(() => {
    const m = new Map<string, { name: string; assetType: AssetType }>();
    for (const n of graph.nodes) m.set(n.id, { name: n.name, assetType: n.assetType });
    return m;
  }, [graph.nodes]);

  // Split edges touching this asset by direction & type. Coverage in/out
  // come from the dedicated coverage endpoint; the *non-protective* edges
  // (DEPENDS_ON, SERVES, COMMUNICATES_WITH, ADJACENT_TO, SUPPLIES, CONTAINS)
  // we filter from graph.edges so the drawer doesn't need a second query.
  const { incoming, outgoing } = useMemo(() => {
    const incoming: AssetRelationshipSummary[] = [];
    const outgoing: AssetRelationshipSummary[] = [];
    for (const e of graph.edges) {
      if (PROTECTIVE_RELS.includes(e.relationshipType)) continue;
      if (e.targetAssetId === detail.id) incoming.push(e);
      else if (e.sourceAssetId === detail.id) outgoing.push(e);
      else if (e.direction === 'BIDIRECTIONAL'
        && (e.sourceAssetId === detail.id || e.targetAssetId === detail.id)) {
        outgoing.push(e);
      }
    }
    return { incoming, outgoing };
  }, [graph.edges, detail.id]);

  // Group children by AssetType for compact display.
  const childrenByType = useMemo(() => {
    const m = new Map<AssetType, AssetSummary[]>();
    for (const c of detail.children) {
      const arr = m.get(c.assetType);
      if (arr) arr.push(c);
      else m.set(c.assetType, [c]);
    }
    return m;
  }, [detail.children]);

  // Coverage incoming: explicit edges + implicit (subtree). The endpoint
  // already de-duplicates and tags source.
  const coverageIn = coverage.items;
  // Coverage outgoing: this asset is the source of PROTECTS/MONITORS edges.
  const coverageOut = useMemo(() => graph.edges.filter(
    (e) => e.sourceAssetId === detail.id && PROTECTIVE_RELS.includes(e.relationshipType),
  ), [graph.edges, detail.id]);

  const role = roleStyle[detail.assetRole];

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      {/* Status row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Pill variant={detail.assetRole === 'PROTECTIVE' ? 'accent' : detail.assetRole === 'DUAL' ? 'info' : 'default'}
              icon={
                detail.assetRole === 'PROTECTIVE' ? <ShieldCheck /> :
                detail.assetRole === 'DUAL' ? <ShieldHalf /> :
                <Shield />
              }>
          {ASSET_ROLE_LABEL[detail.assetRole]}
        </Pill>
        <CriticalityChip value={detail.criticality} />
        <span
          className="text-[10.5px] font-mono px-2 py-0.5 rounded-r1"
          style={{ background: role.chipBg, color: role.chipInk }}
        >
          {OPERATIONAL_STATUS_LABEL[detail.operationalStatus]}
        </span>
        {detail.degradedControlPosture && (
          <Pill variant="warn" icon={<AlertTriangle />}>Degraded posture</Pill>
        )}
      </div>

      {/* MQTT-style path — click-to-copy */}
      <Section title="Path">
        <PathRow path={detail.path} />
      </Section>

      {/* Parent chain */}
      <Section title="Parent">
        {detail.parent ? (
          <button
            type="button"
            onClick={() => onSelectAsset(detail.parent!.id)}
            className="inline-flex items-center gap-2 text-[12.5px] text-n-800 hover:text-a-800 hover:underline underline-offset-2"
            title="Open parent"
          >
            <span>{detail.parent.name}</span>
            <ArrowRight size={12} className="text-n-400" />
          </button>
        ) : (
          <span className="text-[12px] text-n-500 italic">No parent (top level)</span>
        )}
      </Section>

      {/* Children grouped by type */}
      {detail.children.length > 0 && (
        <Section title={`Children (${detail.children.length})`}>
          <div className="space-y-2">
            {[...childrenByType.entries()].map(([type, kids]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-1">
                  {chipFor(type)}
                  <span className="text-[10.5px] font-mono uppercase tracking-[0.4px] text-n-500">
                    {type} · {kids.length}
                  </span>
                </div>
                <ul className="ml-1 space-y-0.5">
                  {kids.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        onClick={() => onSelectAsset(k.id)}
                        className="text-[12px] text-n-800 hover:text-a-800 hover:underline underline-offset-2 truncate text-left max-w-full"
                        title={k.name}
                      >
                        {k.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Protective coverage in */}
      <Section
        title={detail.assetRole === 'PROTECTIVE'
          ? 'Coverage in (n/a — this asset is protective)'
          : `Protective coverage in (${coverageIn.length})`}
      >
        {coverageIn.length === 0 ? (
          <span className="text-[12px] text-n-500 italic">
            {detail.assetRole === 'PROTECTIVE' ? '—' : 'No protective coverage. This asset is uncovered.'}
          </span>
        ) : (
          <ul className="space-y-1">
            {coverageIn.map((c) => (
              <CoverageInRow key={c.protectiveAssetId} item={c} onSelect={() => onSelectAsset(c.protectiveAssetId)} />
            ))}
          </ul>
        )}
      </Section>

      {/* Protective coverage out (this asset protects others) */}
      {coverageOut.length > 0 && (
        <Section title={`Protects / monitors (${coverageOut.length})`}>
          <ul className="space-y-1">
            {coverageOut.map((e) => {
              const target = nameById.get(e.targetAssetId);
              return (
                <li key={e.id} className="flex items-center gap-2 text-[12px]">
                  <span className="text-[9.5px] font-mono uppercase tracking-[0.4px] text-a-700 bg-a-50 px-1.5 py-0.5 rounded-r1">
                    {RELATIONSHIP_TYPE_LABEL[e.relationshipType]}
                  </span>
                  <button
                    type="button"
                    onClick={() => target && onSelectAsset(e.targetAssetId)}
                    className="text-n-800 hover:text-a-800 hover:underline underline-offset-2 truncate max-w-full text-left"
                  >
                    {target?.name ?? '(unknown)'}
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Dependencies in */}
      {incoming.length > 0 && (
        <Section title={`Dependencies in (${incoming.length})`}>
          <DependencyList edges={incoming} nameById={nameById} otherFromEdge={(e) => e.sourceAssetId} onSelect={onSelectAsset} />
        </Section>
      )}

      {/* Dependencies out */}
      {outgoing.length > 0 && (
        <Section title={`Dependencies out (${outgoing.length})`}>
          <DependencyList edges={outgoing} nameById={nameById} otherFromEdge={(e) => e.targetAssetId} onSelect={onSelectAsset} />
        </Section>
      )}

      {/* Tags */}
      {detail.tags.length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1">
            {detail.tags.map((t) => (
              <span
                key={t}
                className="text-[10.5px] font-mono text-n-700 bg-n-100 border border-n-200 rounded-r1 px-1.5 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {detail.description && (
        <Section title="Description">
          <p className="text-[12px] text-n-700 leading-snug whitespace-pre-wrap">{detail.description}</p>
        </Section>
      )}

      <div className="pt-2 border-t border-n-100 flex items-center gap-2">
        <Btn2 variant="secondary" leading={<Eye size={12} />} onClick={onIsolateInGraph}>
          Open in graph
        </Btn2>
        <Btn2 variant="ghost" leading={<ExternalLink size={12} />}
          onClick={() => window.location.assign(`/assets?siteId=${detail.id}`)}>
          Show in catalog
        </Btn2>
      </div>
    </div>
  );
}

function PathRow({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const display = path || '(unset)';
  const onCopy = async () => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard may be unavailable in non-secure contexts; fail quietly.
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code
        className="text-[12px] font-mono text-n-800 bg-n-50 border border-n-200 rounded-r1 px-2 py-1 truncate flex-1 min-w-0"
        title={display}
      >
        {display}
      </code>
      <button
        type="button"
        onClick={onCopy}
        disabled={!path}
        className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 disabled:opacity-40 rounded-r1 shrink-0"
        aria-label={copied ? 'Copied' : 'Copy path'}
        title={copied ? 'Copied!' : 'Copy path'}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-good" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10.5px] font-mono uppercase tracking-[0.4px] text-n-500 mb-1.5">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CriticalityChip({ value }: { value: number }) {
  const level = criticalityToRiskLevel(value);
  return (
    <Pill variant={level === 'Extreme' || level === 'High' ? 'bad' : level === 'Moderate' ? 'warn' : 'default'}>
      C{value} · {level}
    </Pill>
  );
}

function CoverageInRow({ item, onSelect }: { item: ProtectiveCoverageItem; onSelect: () => void }) {
  const isImplicit = item.source === 'IMPLICIT_LOCATION';
  const degraded = item.operationalStatus !== 'OPERATIONAL';
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span
        className={[
          'inline-flex items-center gap-0.5 text-[9.5px] font-mono uppercase tracking-[0.4px] px-1.5 py-0.5 rounded-r1',
          isImplicit ? 'text-n-600 bg-n-100' : 'text-a-700 bg-a-50',
        ].join(' ')}
        title={isImplicit
          ? 'Implicit coverage — protective asset lives inside this asset\'s subtree (not an explicit edge)'
          : item.relationshipType ?? ''}
      >
        {isImplicit ? 'IMPLICIT' : item.relationshipType ?? 'EDGE'}
      </span>
      <button
        type="button"
        onClick={onSelect}
        className="text-n-800 hover:text-a-800 hover:underline underline-offset-2 truncate max-w-full text-left"
      >
        {item.name}
      </button>
      {degraded && (
        <span className="text-[10px] text-warn ml-auto">{item.operationalStatus.toLowerCase()}</span>
      )}
    </li>
  );
}

function DependencyList({
  edges, nameById, otherFromEdge, onSelect,
}: {
  edges: AssetRelationshipSummary[];
  nameById: Map<string, { name: string; assetType: AssetType }>;
  otherFromEdge: (e: AssetRelationshipSummary) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {edges.map((e) => {
        const otherId = otherFromEdge(e);
        const other = nameById.get(otherId);
        return (
          <li key={e.id} className="flex items-center gap-2 text-[12px]">
            <span className="text-[9.5px] font-mono uppercase tracking-[0.4px] text-n-600 bg-n-100 px-1.5 py-0.5 rounded-r1">
              {RELATIONSHIP_TYPE_LABEL[e.relationshipType]}
            </span>
            {e.direction === 'BIDIRECTIONAL' && (
              <ArrowLeftRight size={10} className="text-n-400" />
            )}
            <button
              type="button"
              onClick={() => onSelect(otherId)}
              className="text-n-800 hover:text-a-800 hover:underline underline-offset-2 truncate max-w-full text-left"
            >
              {other?.name ?? '(unknown)'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
