import type { AssessmentSummaryRecommendation } from '../../../lib/csmp-types';
import { PRIORITY_TO_LEVEL } from '../../../lib/risk-ui';
import { Card } from '../../hifi/Card';
import { CardHeader } from '../../hifi/CardHeader';
import { Pill } from '../../hifi/Pill';
import { RiskBadge } from '../../hifi/RiskBadge';

interface RecommendationsListProps {
  items: AssessmentSummaryRecommendation[];
}

export function RecommendationsList({ items }: RecommendationsListProps) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Recommendations"
        subtitle={`${items.length} recommendation${items.length === 1 ? '' : 's'}`}
      />
      <div className="divide-y divide-n-150">
        {items.map((r) => (
          <div key={r.id} className="px-[14px] py-3">
            <div className="flex items-start gap-3 mb-1">
              <span className="text-[10.5px] font-mono text-n-500 mt-0.5 shrink-0">{r.ref}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-n-900">{r.title}</div>
              </div>
              <RiskBadge level={PRIORITY_TO_LEVEL[r.priority]} />
            </div>
            <p className="text-[12px] text-n-700 whitespace-pre-wrap pl-8">{r.body}</p>
            {(r.owner || r.horizon || r.cost) && (
              <div className="flex flex-wrap gap-1.5 mt-2 pl-8">
                {r.owner && <Pill variant="outline">Owner: {r.owner}</Pill>}
                {r.horizon && <Pill variant="outline">Horizon: {r.horizon}</Pill>}
                {r.cost && <Pill variant="outline">Cost: {r.cost}</Pill>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
