import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/hifi/Card';
import { ColorInput } from '../../components/settings/ColorInput';
import { IconPicker } from '../../components/settings/IconPicker';
import { AppearanceEditorChrome } from '../../components/settings/AppearanceEditorChrome';
import { useAppearanceStore } from '../../stores/appearance';
import {
  DEFAULT_ASSET_TYPE_STYLES,
  type AssetTypeStyle,
  resolveIcon,
} from '../../lib/appearance-defaults';
import { ASSET_TYPES, type AssetType } from '../../lib/csmp-types';
import { extractError } from '../../lib/api';

type Drafts = Record<AssetType, AssetTypeStyle>;

export function AppearanceAssetTypesPage() {
  const appearance = useAppearanceStore((s) => s.appearance);
  const save = useAppearanceStore((s) => s.save);

  const [drafts, setDrafts] = useState<Drafts>(() => ({ ...appearance.assetTypeStyles }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDrafts({ ...appearance.assetTypeStyles }); }, [appearance.assetTypeStyles]);

  const dirty = useMemo(
    () => JSON.stringify(drafts) !== JSON.stringify(appearance.assetTypeStyles),
    [drafts, appearance.assetTypeStyles],
  );

  function patch(type: AssetType, partial: Partial<AssetTypeStyle>) {
    setSaved(false);
    setDrafts((d) => ({ ...d, [type]: { ...d[type], ...partial } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await save({ ...appearance, assetTypeStyles: drafts });
      setSaved(true);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDrafts({ ...DEFAULT_ASSET_TYPE_STYLES });
    setSaved(false);
  }

  return (
    <AppearanceEditorChrome
      title="Asset types"
      subtitle="Color, abbreviation and icon for each of the 13 asset types."
      dirty={dirty} saving={saving} saved={saved} error={error}
      onSave={handleSave} onReset={handleReset}
    >
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-[110px_140px_140px_140px_150px_90px_120px] gap-2 px-3 py-2 bg-n-50 border-b border-n-150 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
          <span>Type</span>
          <span>Color (border)</span>
          <span>Background</span>
          <span>Ink</span>
          <span>Icon</span>
          <span>Abbr.</span>
          <span>Preview</span>
        </div>
        {ASSET_TYPES.map((type) => {
          const s = drafts[type];
          const Icon = resolveIcon(s.iconName);
          return (
            <div key={type} className="grid grid-cols-[110px_140px_140px_140px_150px_90px_120px] gap-2 items-center px-3 py-2 border-b border-n-100 last:border-b-0">
              <div className="text-[12px] font-mono text-n-800 truncate" title={type}>{type}</div>
              <ColorInput value={s.color} onChange={(v) => patch(type, { color: v })} />
              <ColorInput value={s.bg} onChange={(v) => patch(type, { bg: v })} />
              <ColorInput value={s.ink} onChange={(v) => patch(type, { ink: v })} />
              <IconPicker value={s.iconName} onChange={(v) => patch(type, { iconName: v })} />
              <input
                type="text"
                value={s.abbr}
                onChange={(e) => patch(type, { abbr: e.target.value.toUpperCase().slice(0, 8) })}
                className="w-full h-7 px-1.5 border border-n-200 rounded-r1 text-[11.5px] font-mono text-center"
              />
              <div className="flex items-center">
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-r1"
                  style={{ backgroundColor: s.bg, color: s.ink }}
                >
                  <Icon size={9} style={{ color: s.color }} />
                  {s.abbr}
                </span>
              </div>
            </div>
          );
        })}
      </Card>
    </AppearanceEditorChrome>
  );
}
