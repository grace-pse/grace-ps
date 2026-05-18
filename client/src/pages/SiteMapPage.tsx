import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Topbar } from '../components/shell/Topbar';
import { RiskBadge } from '../components/hifi/RiskBadge';
import { assetsApi, assessmentsApi } from '../lib/csmp-api';
import { extractError } from '../lib/api';
import { PRIORITY_TO_LEVEL } from '../lib/risk-ui';
import {
  criticalityToRiskLevel,
  type AssetDetail, type AssetLocation, type RiskPriority,
  type AssessmentSummary,
} from '../lib/csmp-types';
import { useAppearanceStore } from '../stores/appearance';

const PRIORITY_RANK: Record<RiskPriority, number> = {
  LOW: 1, MEDIUM: 2, HIGH: 3, HIGHEST: 4,
};

interface PinnedAsset {
  id: string;
  name: string;
  assetType: string;
  criticality: number;
  location: AssetLocation;
  highestPriority: RiskPriority | null;
  activeAssessment: AssessmentSummary | null;
}

function hasValidLocation(loc: unknown): loc is AssetLocation {
  if (!loc || typeof loc !== 'object') return false;
  const l = loc as { lat?: unknown; lng?: unknown };
  return typeof l.lat === 'number' && typeof l.lng === 'number'
    && l.lat >= -90 && l.lat <= 90 && l.lng >= -180 && l.lng <= 180;
}

function FitToBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, bounds]);
  return null;
}

export function SiteMapPage() {
  const navigate = useNavigate();
  const appearance = useAppearanceStore((s) => s.appearance);
  const [pins, setPins] = useState<PinnedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);

        // 1. List all assets (paged up to 200) and fetch detail to get location.
        const list = await assetsApi.list({ pageSize: 200 });
        const details = await Promise.all(
          list.items.map((a) => assetsApi.get(a.id).catch(() => null)),
        );
        const located = details.filter((d): d is AssetDetail =>
          d !== null && hasValidLocation(d.location),
        );

        // 2. Fetch all assessments once; aggregate highest priority per asset.
        const assessments = await assessmentsApi.list({ pageSize: 200 });
        const byAsset = new Map<string, AssessmentSummary[]>();
        for (const a of assessments.items) {
          if (!a.assetId || a.status === 'ARCHIVED') continue;
          const arr = byAsset.get(a.assetId) ?? [];
          arr.push(a);
          byAsset.set(a.assetId, arr);
        }

        const result: PinnedAsset[] = located.map((d) => {
          const own = byAsset.get(d.id) ?? [];
          // Walk descendants via name lookup? Simpler: only own assessments.
          // Per spec: "highest-priority active assessment for the asset".
          let top: { priority: RiskPriority; asm: AssessmentSummary } | null = null;
          for (const asm of own) {
            if (!asm.highestPriority) continue;
            if (!top || PRIORITY_RANK[asm.highestPriority] > PRIORITY_RANK[top.priority]) {
              top = { priority: asm.highestPriority, asm };
            }
          }
          return {
            id: d.id,
            name: d.name,
            assetType: d.assetType,
            criticality: d.criticality,
            location: d.location as AssetLocation,
            highestPriority: top?.priority ?? null,
            activeAssessment: top?.asm ?? own[0] ?? null,
          };
        });

        if (!cancelled) setPins(result);
      } catch (err) {
        if (!cancelled) setError(await extractError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (pins.length === 0) return null;
    if (pins.length === 1) return null;
    return pins.map((p) => [p.location.lat, p.location.lng] as LatLngTuple);
  }, [pins]);

  const centerFallback: LatLngTuple = pins[0]
    ? [pins[0].location.lat, pins[0].location.lng]
    : [52.2297, 21.0122]; // Warsaw as neutral default

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Site Map"
        subtitle={
          loading
            ? 'Loading asset locations…'
            : `${pins.length} asset${pins.length === 1 ? '' : 's'} with geographic coordinates`
        }
      />

      {error && (
        <div className="text-[12px] text-bad bg-bad-bg border-b border-bad/20 px-4 py-2">{error}</div>
      )}

      <div className="flex-1 relative bg-n-50">
        {!loading && pins.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="max-w-md">
              <div className="text-[13px] text-n-700 font-medium">No geographically located assets</div>
              <div className="text-[11.5px] text-n-500 mt-1">
                Add <code>location: &#123; lat, lng, address? &#125;</code> to assets (Admin &rarr; Assets) to
                see them pinned on the map.
              </div>
            </div>
          </div>
        ) : (
          <MapContainer
            center={centerFallback}
            zoom={4}
            scrollWheelZoom
            className="absolute inset-0 z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToBounds bounds={bounds} />
            {pins.map((p) => {
              const level = p.highestPriority
                ? PRIORITY_TO_LEVEL[p.highestPriority]
                : criticalityToRiskLevel(p.criticality);
              const color = appearance.riskColors[level];
              return (
                <CircleMarker
                  key={p.id}
                  center={[p.location.lat, p.location.lng]}
                  radius={10}
                  pathOptions={{
                    color: color.ink,
                    fillColor: color.bg,
                    fillOpacity: 0.9,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="min-w-[180px]">
                      <div className="text-[12.5px] font-semibold text-n-900">{p.name}</div>
                      <div className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
                        {p.assetType} &middot; C{p.criticality}
                      </div>
                      {p.location.address && (
                        <div className="text-[11px] text-n-600 mt-1">{p.location.address}</div>
                      )}
                      <div className="mt-2">
                        <RiskBadge level={level} value={p.highestPriority ?? 'no active assessment'} />
                      </div>
                      <div className="flex flex-col gap-1 mt-2">
                        <button
                          type="button"
                          className="text-[11.5px] text-a-700 hover:underline text-left"
                          onClick={() => navigate({ to: '/assets', search: { siteId: p.id } })}
                        >
                          View assets at this site &rarr;
                        </button>
                        {p.activeAssessment && (
                          <button
                            type="button"
                            className="text-[11.5px] text-a-700 hover:underline text-left"
                            onClick={() =>
                              navigate({
                                to: '/assessments/$id',
                                params: { id: p.activeAssessment!.id },
                              })
                            }
                          >
                            Open assessment: {p.activeAssessment.title} &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
