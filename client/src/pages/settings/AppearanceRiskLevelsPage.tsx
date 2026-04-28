import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/hifi/Card';
import { ColorInput } from '../../components/settings/ColorInput';
import { AppearanceEditorChrome } from '../../components/settings/AppearanceEditorChrome';
import { useAppearanceStore } from '../../stores/appearance';
import {
  DEFAULT_RISK_COLORS,
  type RiskColor,
  type RiskLevel,
} from '../../lib/appearance-defaults';
import { extractError } from '../../lib/api';

const RISK_LEVELS: RiskLevel[] = ['Negligible', 'Low', 'Moderate', 'High', 'Extreme'];

type Drafts = Record<RiskLevel, RiskColor>;

export function AppearanceRiskLevelsPage() {
  const appearance = useAppearanceStore((s) => s.appearance);
  const save = useAppearanceStore((s) => s.save);

  const [drafts, setDrafts] = useState<Drafts>(() => ({ ...appearance.riskColors }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDrafts({ ...appearance.riskColors }); }, [appearance.riskColors]);

  const dirty = useMemo(
    () => JSON.stringify(drafts) !== JSON.stringify(appearance.riskColors),
    [drafts, appearance.riskColors],
  );

  function patch(level: RiskLevel, partial: Partial<RiskColor>) {
    setSaved(false);
    setDrafts((d) => ({ ...d, [level]: { ...d[level], ...partial } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await save({ ...appearance, riskColors: drafts });
      setSaved(true);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDrafts({ ...DEFAULT_RISK_COLORS });
    setSaved(false);
  }

  return (
    <AppearanceEditorChrome
      title="Risk levels"
      subtitle="Background and ink color per risk level. Affects relationships graph node tints and the site map markers. Risk badges in dashboards keep their fixed design tokens."
      dirty={dirty} saving={saving} saved={saved} error={error}
      onSave={handleSave} onReset={handleReset}
    >
      <Card className="p-4">
        <div className="grid grid-cols-[120px_1fr_240px] gap-4 px-2 py-1 mb-2 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
          <span>Level</span>
          <span>Colors</span>
          <span>Preview</span>
        </div>
        {RISK_LEVELS.map((level) => {
          const s = drafts[level];
          return (
            <div
              key={level}
              className="grid grid-cols-[120px_1fr_240px] gap-4 items-center px-2 py-2 border-t border-n-100 first:border-t-0"
            >
              <div className="text-[12.5px] font-medium text-n-900">{level}</div>
              <div className="flex items-center gap-3">
                <ColorInput label="Background" value={s.bg} onChange={(v) => patch(level, { bg: v })} />
                <ColorInput label="Ink" value={s.ink} onChange={(v) => patch(level, { ink: v })} />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center text-[10.5px] font-medium rounded-[3px] px-1.5 py-px"
                  style={{ backgroundColor: s.bg, color: s.ink }}
                >
                  {level} · sample
                </span>
                <span
                  className="inline-block w-6 h-6 rounded-full border-2"
                  style={{ backgroundColor: s.bg, borderColor: s.ink }}
                  title="Site map marker preview"
                />
              </div>
            </div>
          );
        })}
      </Card>
    </AppearanceEditorChrome>
  );
}
