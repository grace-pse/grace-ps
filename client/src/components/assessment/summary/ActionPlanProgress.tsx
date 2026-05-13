import { AlertTriangle, CalendarClock } from 'lucide-react';
import type { AssessmentSummaryActionPlan, ActionStatus } from '../../../lib/csmp-types';
import { ACTION_STATUS_VARIANT } from '../../../lib/risk-ui';
import { Card } from '../../hifi/Card';
import { CardHeader } from '../../hifi/CardHeader';
import { Pill } from '../../hifi/Pill';

const STATUS_LABEL: Record<ActionStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

interface ActionPlanProgressProps {
  actionPlan: AssessmentSummaryActionPlan;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ActionPlanProgress({ actionPlan }: ActionPlanProgressProps) {
  const subtitle = actionPlan.total > 0
    ? `${actionPlan.completionPct}% complete · cancelled actions excluded from denominator`
    : 'No actions tracked';
  const overdueChip = actionPlan.overdueCount > 0
    ? <Pill variant="bad" icon={<AlertTriangle />}>{actionPlan.overdueCount} overdue</Pill>
    : null;
  const nextDue = formatDate(actionPlan.nextDueDate);
  const dueChip = nextDue
    ? <Pill variant="info" icon={<CalendarClock />}>Next due {nextDue}</Pill>
    : null;

  return (
    <Card>
      <CardHeader
        title="Action plan progress"
        subtitle={subtitle}
        pills={overdueChip || dueChip ? <>{overdueChip}{dueChip}</> : null}
      />
      <div className="px-[14px] py-3 space-y-3">
        {actionPlan.total > 0 && (
          <div>
            <div className="h-2 bg-n-75 rounded-[3px] overflow-hidden">
              <div
                className="h-full bg-ok"
                style={{ width: `${Math.min(100, actionPlan.completionPct)}%` }}
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {actionPlan.byStatus.map((b) => (
            <div key={b.key} className="bg-n-50 border border-n-150 rounded-r2 px-2.5 py-2">
              <div className="text-[10px] uppercase font-mono text-n-500 tracking-[0.4px]">
                {STATUS_LABEL[b.key as ActionStatus] ?? b.key}
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <div className="text-[18px] font-semibold tabular-nums text-n-900">{b.count}</div>
                <Pill variant={ACTION_STATUS_VARIANT[b.key as ActionStatus] ?? 'default'}>
                  {b.pct.toFixed(0)}%
                </Pill>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
