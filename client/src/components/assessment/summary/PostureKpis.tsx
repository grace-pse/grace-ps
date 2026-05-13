import type { AssessmentSummaryPosture, AssessmentSummaryActionPlan } from '../../../lib/csmp-types';
import { PRIORITY_TO_LEVEL } from '../../../lib/risk-ui';
import { KPICard } from '../../hifi/KPICard';
import { RiskBadge } from '../../hifi/RiskBadge';

interface PostureKpisProps {
  posture: AssessmentSummaryPosture;
  actionPlan: AssessmentSummaryActionPlan;
}

export function PostureKpis({ posture, actionPlan }: PostureKpisProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPICard
        label="Highest priority"
        value={posture.highestPriority
          ? <RiskBadge level={PRIORITY_TO_LEVEL[posture.highestPriority]} />
          : <span className="text-[14px] text-n-500">—</span>}
        sub={posture.unscoredThreatsCount > 0
          ? `${posture.unscoredThreatsCount} unscored`
          : 'across all threats'}
      />
      <KPICard
        label="High + extreme IRV"
        value={posture.highOrExtremeIrvCount}
        sub={posture.totalThreats > 0
          ? `of ${posture.totalThreats} threats`
          : null}
      />
      <KPICard
        label="Total threats"
        value={posture.totalThreats}
      />
      <KPICard
        label="Action plan progress"
        value={`${actionPlan.completionPct}%`}
        delta={actionPlan.overdueCount > 0
          ? { value: `${actionPlan.overdueCount} overdue`, tone: 'bad' }
          : undefined}
        sub={actionPlan.total > 0
          ? `${actionPlan.total} actions tracked`
          : 'no actions tracked'}
      />
    </div>
  );
}
