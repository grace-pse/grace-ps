export type RiskLevel = 'Negligible' | 'Low' | 'Moderate' | 'High' | 'Extreme';

const STYLES: Record<RiskLevel, string> = {
  Negligible: 'bg-r-neg text-r-negInk',
  Low: 'bg-r-low text-r-lowInk',
  Moderate: 'bg-r-mod text-r-modInk',
  High: 'bg-r-high text-r-highInk',
  Extreme: 'bg-r-ext text-r-extInk',
};

interface RiskBadgeProps {
  level: RiskLevel;
  value?: string | number;
  block?: boolean;
}

export function RiskBadge({ level, value, block }: RiskBadgeProps) {
  return (
    <span
      aria-label={`Risk level: ${level}`}
      className={[
        'inline-flex items-center justify-center gap-1 text-[10.5px] font-semibold rounded-[3px] px-2 py-0.5',
        STYLES[level],
        block ? 'w-full py-1' : '',
      ].join(' ')}
    >
      {level}
      {value != null && <span className="font-mono opacity-80">· {value}</span>}
    </span>
  );
}
