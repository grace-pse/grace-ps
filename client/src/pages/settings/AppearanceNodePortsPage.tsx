import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/hifi/Card';
import { ColorInput } from '../../components/settings/ColorInput';
import { AppearanceEditorChrome } from '../../components/settings/AppearanceEditorChrome';
import { useAppearanceStore } from '../../stores/appearance';
import {
  DEFAULT_NODE_PORT_STYLE,
  type NodePortShape,
  type NodePortStyle,
} from '../../lib/appearance-defaults';
import { extractError } from '../../lib/api';

const SHAPE_OPTIONS: Array<{ id: NodePortShape; label: string; title: string }> = [
  { id: 'square',  label: 'Square',  title: 'Sharp square ports (default)' },
  { id: 'rounded', label: 'Rounded', title: 'Slightly rounded corners' },
  { id: 'circle',  label: 'Circle',  title: 'Fully circular ports' },
];

function shapeBorderRadius(shape: NodePortShape, size: number): number | string {
  if (shape === 'circle') return '50%';
  if (shape === 'rounded') return Math.max(2, Math.round(size * 0.25));
  return 0;
}

export function AppearanceNodePortsPage() {
  const appearance = useAppearanceStore((s) => s.appearance);
  const save = useAppearanceStore((s) => s.save);

  const [draft, setDraft] = useState<NodePortStyle>(() => ({ ...appearance.nodePortStyle }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDraft({ ...appearance.nodePortStyle }); }, [appearance.nodePortStyle]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(appearance.nodePortStyle),
    [draft, appearance.nodePortStyle],
  );

  function patch(partial: Partial<NodePortStyle>) {
    setSaved(false);
    setDraft((d) => ({ ...d, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await save({ ...appearance, nodePortStyle: draft });
      setSaved(true);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft({ ...DEFAULT_NODE_PORT_STYLE });
    setSaved(false);
  }

  const radius = shapeBorderRadius(draft.shape, draft.size);

  return (
    <AppearanceEditorChrome
      title="Node ports"
      subtitle="Size, shape, color, border and disabled opacity for the four connection ports on every node in the relationships graph. Top-half ports are spatial (topology); bottom-half ports are logical (coverage)."
      dirty={dirty} saving={saving} saved={saved} error={error}
      onSave={handleSave} onReset={handleReset}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        <Card className="p-4">
          <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 items-center">
            <Label>Spatial color</Label>
            <ColorInput value={draft.spatialColor} onChange={(v) => patch({ spatialColor: v })} />

            <Label>Logical color</Label>
            <ColorInput value={draft.logicalColor} onChange={(v) => patch({ logicalColor: v })} />

            <Label>Shape</Label>
            <div className="inline-flex items-center rounded-r1 border border-n-200 bg-white overflow-hidden self-start">
              {SHAPE_OPTIONS.map((o, i) => {
                const active = draft.shape === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    title={o.title}
                    onClick={() => patch({ shape: o.id })}
                    className={[
                      'h-7 px-2.5 text-[11.5px] font-medium transition-colors',
                      active ? 'bg-a-50 text-a-800' : 'text-n-600 hover:bg-n-50',
                      i > 0 ? 'border-l border-n-200' : '',
                    ].join(' ')}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            <Label>Size (px)</Label>
            <NumberInput
              value={draft.size}
              min={4} max={20} step={1}
              onChange={(v) => patch({ size: v })}
              suffix="px"
            />

            <Label>Border width (px)</Label>
            <NumberInput
              value={draft.borderWidth}
              min={0} max={4} step={0.5}
              onChange={(v) => patch({ borderWidth: v })}
              suffix="px"
            />

            <Label>Border color</Label>
            <ColorInput value={draft.borderColor} onChange={(v) => patch({ borderColor: v })} />

            <Label>Disabled opacity</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0} max={1} step={0.01}
                value={draft.disabledOpacity}
                onChange={(e) => patch({ disabledOpacity: Number(e.target.value) })}
                className="w-40"
              />
              <span className="text-[11.5px] font-mono text-n-700 w-10 text-right">
                {draft.disabledOpacity.toFixed(2)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-3">
            Live preview
          </div>
          <PortPreview style={draft} radius={radius} />
          <div className="mt-3 text-[10.5px] text-n-500 leading-snug">
            Top row shows ports in their <span className="font-medium text-n-700">active</span> state.
            Bottom row shows them dimmed at <span className="font-mono">{draft.disabledOpacity.toFixed(2)}</span>{' '}
            opacity — that's how off-mode ports appear in topology / coverage view.
          </div>
        </Card>
      </div>
    </AppearanceEditorChrome>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11.5px] font-medium text-n-700 self-center">{children}</span>
  );
}

function NumberInput({
  value, min, max, step, onChange, suffix,
}: {
  value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-20 h-7 px-2 border border-n-200 rounded-r1 text-[11.5px] text-center"
      />
      {suffix && (
        <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{suffix}</span>
      )}
    </div>
  );
}

function PortPreview({ style, radius }: { style: NodePortStyle; radius: number | string }) {
  const dot = (color: string, opacity: number) => ({
    width: style.size,
    height: style.size,
    background: color,
    border: `${style.borderWidth}px solid ${style.borderColor}`,
    borderRadius: radius,
    opacity,
    display: 'inline-block',
  } as React.CSSProperties);

  return (
    <div className="space-y-3">
      <PreviewRow label="Active">
        <PortDot style={dot(style.spatialColor, 1)} caption="spatial" />
        <PortDot style={dot(style.logicalColor, 1)} caption="logical" />
      </PreviewRow>
      <PreviewRow label="Disabled">
        <PortDot style={dot(style.spatialColor, style.disabledOpacity)} caption="spatial" />
        <PortDot style={dot(style.logicalColor, style.disabledOpacity)} caption="logical" />
      </PreviewRow>
      <div className="border border-n-200 rounded-r2 bg-n-50 p-3">
        <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-2">
          On a node
        </div>
        <NodeMockup style={style} radius={radius} />
      </div>
    </div>
  );
}

function PreviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] w-16">{label}</span>
      <div className="flex items-center gap-5">{children}</div>
    </div>
  );
}

function PortDot({ style, caption }: { style: React.CSSProperties; caption: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={style} aria-hidden />
      <span className="text-[10.5px] text-n-600">{caption}</span>
    </div>
  );
}

function NodeMockup({ style, radius }: { style: NodePortStyle; radius: number | string }) {
  const port = (color: string, top: string): React.CSSProperties => ({
    position: 'absolute',
    width: style.size,
    height: style.size,
    background: color,
    border: `${style.borderWidth}px solid ${style.borderColor}`,
    borderRadius: radius,
    top,
    transform: 'translate(-50%, -50%)',
  });
  return (
    <div className="relative mx-auto bg-white border-2 border-n-300 rounded-r2 px-3 py-2 shadow-sh1 w-[180px]">
      <span style={{ ...port(style.spatialColor, '30%'), left: 0 }} aria-hidden />
      <span style={{ ...port(style.logicalColor, '70%'), left: 0 }} aria-hidden />
      <span style={{ ...port(style.spatialColor, '30%'), left: '100%' }} aria-hidden />
      <span style={{ ...port(style.logicalColor, '70%'), left: '100%' }} aria-hidden />
      <div className="text-[10px] font-mono text-n-500">SAMPLE</div>
      <div className="text-[12.5px] font-medium text-n-900 mt-1">Sample asset</div>
    </div>
  );
}
