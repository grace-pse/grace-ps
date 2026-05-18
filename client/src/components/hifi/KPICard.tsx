import type { ReactNode } from 'react';
import { Card } from './Card';

interface KPICardProps {
  label: string;
  value: ReactNode;
  delta?: { value: string; tone: 'ok' | 'bad' | 'neutral' };
  sub?: ReactNode;
  onClick?: () => void;
}

export function KPICard({ label, value, delta, sub, onClick }: KPICardProps) {
  const body = (
    <>
      <div className="text-[10px] uppercase font-mono text-n-500 tracking-[0.4px]">
        {label}
      </div>
      <div className="text-[24px] font-semibold tracking-[-0.8px] leading-none mt-1.5 text-n-900">
        {value}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        {delta && (
          <span
            className={[
              'text-[11px] font-mono font-semibold',
              delta.tone === 'ok' && 'text-ok',
              delta.tone === 'bad' && 'text-bad',
              delta.tone === 'neutral' && 'text-n-500',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {delta.value}
          </span>
        )}
        {sub && <span className="text-[11px] text-n-500">{sub}</span>}
      </div>
    </>
  );

  return (
    <Card
      className={[
        'py-3 px-[14px]',
        onClick ? 'hover:shadow-sh2 transition-shadow cursor-pointer' : '',
      ].join(' ')}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-left">
          {body}
        </button>
      ) : (
        body
      )}
    </Card>
  );
}
