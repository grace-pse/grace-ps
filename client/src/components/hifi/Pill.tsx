import type { ReactNode } from 'react';

type PillVariant = 'default' | 'accent' | 'outline' | 'ok' | 'warn' | 'bad' | 'info';

const VARIANTS: Record<PillVariant, string> = {
  default: 'bg-n-100 text-n-700',
  accent: 'bg-a-50 text-a-700',
  outline: 'bg-transparent border border-n-200 text-n-700',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
};

interface PillProps {
  variant?: PillVariant;
  icon?: ReactNode;
  children: ReactNode;
}

export function Pill({ variant = 'default', icon, children }: PillProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 text-[10.5px] font-medium rounded-[3px] px-1.5 py-px',
        VARIANTS[variant],
      ].join(' ')}
    >
      {icon && <span className="w-2.5 h-2.5 [&>svg]:w-2.5 [&>svg]:h-2.5">{icon}</span>}
      {children}
    </span>
  );
}
