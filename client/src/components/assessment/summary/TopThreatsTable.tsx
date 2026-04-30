import type { ThreatSummary } from '../../../lib/csmp-types';
import { IRV_TO_LEVEL, PRIORITY_TO_LEVEL, TEAR_LABEL } from '../../../lib/risk-ui';
import { Card } from '../../hifi/Card';
import { CardHeader } from '../../hifi/CardHeader';
import { Pill } from '../../hifi/Pill';
import { RiskBadge } from '../../hifi/RiskBadge';

interface TopThreatsTableProps {
  threats: ThreatSummary[];
}

export function TopThreatsTable({ threats }: TopThreatsTableProps) {
  if (threats.length === 0) {
    return (
      <Card>
        <CardHeader title="Top risks" subtitle="Highest treatment priority" />
        <div className="px-[14px] py-6 text-center text-[12px] text-n-500">
          No threats recorded.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Top risks" subtitle={`Top ${threats.length} of all scored threats, by priority then severity`} />
      <div className="divide-y divide-n-150">
        {threats.map((t, i) => (
          <div key={t.id} className="px-[14px] py-2.5 flex items-start gap-3">
            <div className="text-[11px] font-mono text-n-500 w-5 shrink-0 mt-0.5">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium text-n-900 truncate">
                {t.targetAssetName ?? '—'}
              </div>
              <div className="text-[11.5px] text-n-500 truncate">
                {t.adversaryType.replace(/_/g, ' ').toLowerCase()}
                {' · '}
                {t.actionType.replace(/_/g, ' ').toLowerCase()}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {t.irv ? <RiskBadge level={IRV_TO_LEVEL[t.irv]} /> : null}
              {t.riskTreatmentPriority ? (
                <RiskBadge level={PRIORITY_TO_LEVEL[t.riskTreatmentPriority]} />
              ) : null}
              {t.tearStrategy && <Pill variant="outline">{TEAR_LABEL[t.tearStrategy]}</Pill>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
