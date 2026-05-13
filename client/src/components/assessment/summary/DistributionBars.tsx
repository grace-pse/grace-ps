import type { SummaryBucket } from '../../../lib/csmp-types';
import type { RiskLevel } from '../../hifi/RiskBadge';
import { Card } from '../../hifi/Card';
import { CardHeader } from '../../hifi/CardHeader';

type BucketTone = RiskLevel | 'Neutral';

const TONE_BAR: Record<BucketTone, string> = {
  Negligible: 'bg-r-neg',
  Low: 'bg-r-low',
  Moderate: 'bg-r-mod',
  High: 'bg-r-high',
  Extreme: 'bg-r-ext',
  Neutral: 'bg-n-300',
};

interface BarRow {
  key: string;
  label: string;
  count: number;
  pct: number;
  tone: BucketTone;
}

interface DistributionBarsProps {
  title: string;
  subtitle?: string;
  buckets: SummaryBucket[];
  labels: Record<string, string>;
  tones: Record<string, BucketTone>;
}

export function DistributionBars({ title, subtitle, buckets, labels, tones }: DistributionBarsProps) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const rows: BarRow[] = buckets.map((b) => ({
    key: b.key,
    label: labels[b.key] ?? b.key,
    count: b.count,
    pct: b.pct,
    tone: tones[b.key] ?? 'Neutral',
  }));

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="px-[14px] py-3 space-y-2">
        {rows.map((r) => {
          const widthPct = (r.count / max) * 100;
          return (
            <div key={r.key} className="flex items-center gap-2">
              <div className="text-[11.5px] text-n-700 w-32 shrink-0 truncate">{r.label}</div>
              <div className="flex-1 h-4 bg-n-75 rounded-[3px] overflow-hidden">
                <div
                  className={`h-full ${TONE_BAR[r.tone]} transition-[width]`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="text-[11.5px] font-mono text-n-700 w-14 text-right tabular-nums">
                {r.count}
                <span className="text-n-500"> · {r.pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
