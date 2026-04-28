import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/hifi/Card';
import { ColorInput } from '../../components/settings/ColorInput';
import { IconPicker } from '../../components/settings/IconPicker';
import { AppearanceEditorChrome } from '../../components/settings/AppearanceEditorChrome';
import { useAppearanceStore } from '../../stores/appearance';
import {
  DEFAULT_ASSET_ROLE_STYLES,
  type AssetRoleStyle,
  resolveIcon,
} from '../../lib/appearance-defaults';
import {
  ASSET_ROLES, ASSET_ROLE_LABEL, ASSET_ROLE_DESCRIPTION,
  type AssetRole,
} from '../../lib/csmp-types';
import { extractError } from '../../lib/api';

type Drafts = Record<AssetRole, AssetRoleStyle>;

export function AppearanceAssetRolesPage() {
  const appearance = useAppearanceStore((s) => s.appearance);
  const save = useAppearanceStore((s) => s.save);

  const [drafts, setDrafts] = useState<Drafts>(() => ({ ...appearance.assetRoleStyles }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDrafts({ ...appearance.assetRoleStyles }); }, [appearance.assetRoleStyles]);

  const dirty = useMemo(
    () => JSON.stringify(drafts) !== JSON.stringify(appearance.assetRoleStyles),
    [drafts, appearance.assetRoleStyles],
  );

  function patch(role: AssetRole, partial: Partial<AssetRoleStyle>) {
    setSaved(false);
    setDrafts((d) => ({ ...d, [role]: { ...d[role], ...partial } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await save({ ...appearance, assetRoleStyles: drafts });
      setSaved(true);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDrafts({ ...DEFAULT_ASSET_ROLE_STYLES });
    setSaved(false);
  }

  return (
    <AppearanceEditorChrome
      title="Asset roles"
      subtitle="Visual treatment for the three asset roles in the relationships graph."
      dirty={dirty} saving={saving} saved={saved} error={error}
      onSave={handleSave} onReset={handleReset}
    >
      <div className="space-y-3">
        {ASSET_ROLES.map((role) => {
          const s = drafts[role];
          const Icon = resolveIcon(s.iconName);
          return (
            <Card key={role} className="p-4">
              <div className="grid grid-cols-[260px_1fr] gap-6">
                <div>
                  <div className="text-[13px] font-semibold text-n-900">{ASSET_ROLE_LABEL[role]}</div>
                  <div className="text-[10.5px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">{role}</div>
                  <div className="text-[11px] text-n-600 mt-1.5">{ASSET_ROLE_DESCRIPTION[role]}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <ColorInput label="Border" value={s.borderColor} onChange={(v) => patch(role, { borderColor: v })} />
                    <label className="inline-flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Width</span>
                      <input
                        type="number"
                        min={1} max={8}
                        value={s.borderWidth}
                        onChange={(e) => patch(role, { borderWidth: Number(e.target.value) })}
                        className="w-14 h-7 px-1.5 border border-n-200 rounded-r1 text-[11.5px] text-center"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Style</span>
                      <select
                        value={s.borderStyle}
                        onChange={(e) => patch(role, { borderStyle: e.target.value as AssetRoleStyle['borderStyle'] })}
                        className="h-7 px-1.5 border border-n-200 rounded-r1 text-[11.5px] bg-white"
                      >
                        <option value="solid">solid</option>
                        <option value="dashed">dashed</option>
                        <option value="dotted">dotted</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <ColorInput label="Chip bg" value={s.chipBg} onChange={(v) => patch(role, { chipBg: v })} />
                    <ColorInput label="Chip ink" value={s.chipInk} onChange={(v) => patch(role, { chipInk: v })} />
                    <label className="inline-flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Icon</span>
                      <IconPicker value={s.iconName} onChange={(v) => patch(role, { iconName: v })} />
                    </label>
                  </div>
                  <div className="pt-2">
                    <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1">Preview</div>
                    <div
                      className="inline-block rounded-r2 px-3 py-2 bg-white shadow-sh1 min-w-[180px] max-w-[240px]"
                      style={{
                        borderColor: s.borderColor,
                        borderWidth: s.borderWidth,
                        borderStyle: s.borderStyle,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-r1 bg-n-100 text-n-700">EQ</span>
                        <span
                          className="inline-flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-r1"
                          style={{ backgroundColor: s.chipBg, color: s.chipInk }}
                        >
                          <Icon size={9} />
                          {role.slice(0, 4)}
                        </span>
                      </div>
                      <div className="text-[12.5px] font-medium text-n-900 mt-1">Sample asset</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </AppearanceEditorChrome>
  );
}
