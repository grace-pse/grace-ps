import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/hifi/Card';
import { ColorInput } from '../../components/settings/ColorInput';
import { DashArrayPicker } from '../../components/settings/DashArrayPicker';
import { AppearanceEditorChrome } from '../../components/settings/AppearanceEditorChrome';
import { useAppearanceStore } from '../../stores/appearance';
import {
  DEFAULT_EDGE_STYLES,
  type EdgeStyle,
} from '../../lib/appearance-defaults';
import {
  RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_LABEL,
  type RelationshipType,
} from '../../lib/csmp-types';
import { extractError } from '../../lib/api';

type Drafts = Record<RelationshipType, EdgeStyle>;

export function AppearanceEdgesPage() {
  const appearance = useAppearanceStore((s) => s.appearance);
  const save = useAppearanceStore((s) => s.save);

  const [drafts, setDrafts] = useState<Drafts>(() => ({ ...appearance.edgeStyles }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDrafts({ ...appearance.edgeStyles }); }, [appearance.edgeStyles]);

  const dirty = useMemo(
    () => JSON.stringify(drafts) !== JSON.stringify(appearance.edgeStyles),
    [drafts, appearance.edgeStyles],
  );

  function patch(type: RelationshipType, partial: Partial<EdgeStyle>) {
    setSaved(false);
    setDrafts((d) => ({ ...d, [type]: { ...d[type], ...partial } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await save({ ...appearance, edgeStyles: drafts });
      setSaved(true);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDrafts({ ...DEFAULT_EDGE_STYLES });
    setSaved(false);
  }

  return (
    <AppearanceEditorChrome
      title="Edge styles"
      subtitle="Stroke color, width, dash pattern and label visibility per relationship type."
      dirty={dirty} saving={saving} saved={saved} error={error}
      onSave={handleSave} onReset={handleReset}
    >
      <div className="space-y-2">
        {RELATIONSHIP_TYPES.map((type) => {
          const s = drafts[type];
          return (
            <Card key={type} className="p-3">
              <div className="grid grid-cols-[200px_1fr_220px] gap-4 items-center">
                <div>
                  <div className="text-[12.5px] font-semibold text-n-900">{RELATIONSHIP_TYPE_LABEL[type]}</div>
                  <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{type}</div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <ColorInput label="Stroke" value={s.stroke} onChange={(v) => patch(type, { stroke: v })} />
                  <label className="inline-flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Width</span>
                    <input
                      type="number" min={0.5} max={8} step={0.5}
                      value={s.strokeWidth}
                      onChange={(e) => patch(type, { strokeWidth: Number(e.target.value) })}
                      className="w-14 h-7 px-1.5 border border-n-200 rounded-r1 text-[11.5px] text-center"
                    />
                  </label>
                  <DashArrayPicker value={s.dashArray} onChange={(v) => patch(type, { dashArray: v })} />
                  <label className="inline-flex items-center gap-1.5 text-[11.5px] text-n-700">
                    <input
                      type="checkbox"
                      checked={s.showLabel}
                      onChange={(e) => patch(type, { showLabel: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    Show label
                  </label>
                </div>
                <div className="flex items-center justify-end">
                  <svg width="200" height="40" viewBox="0 0 200 40">
                    <line
                      x1="10" y1="20" x2="190" y2="20"
                      stroke={s.stroke}
                      strokeWidth={s.strokeWidth}
                      strokeDasharray={s.dashArray ?? undefined}
                      markerEnd="url(#arrowhead)"
                    />
                    {s.showLabel && (
                      <g>
                        <rect x="70" y="8" width="60" height="14" fill="#ffffff" stroke="none" />
                        <text x="100" y="18" fontSize="9" fontFamily="JetBrains Mono, monospace" fill="#373735" textAnchor="middle">
                          {RELATIONSHIP_TYPE_LABEL[type]}
                        </text>
                      </g>
                    )}
                    <defs>
                      <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <polygon points="0 0, 6 3, 0 6" fill={s.stroke} />
                      </marker>
                    </defs>
                  </svg>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </AppearanceEditorChrome>
  );
}
