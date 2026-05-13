import * as React from 'react';
import type { IrvBand, RiskPriority, TearStrategy } from '@prisma/client';
import { IRV_FILL, IRV_INK, PRIORITY_FILL, PRIORITY_INK_KEY } from '../constants.js';

type Tone = 'neutral' | 'mono' | 'info' | 'ok' | 'warn' | 'bad';

export function EnumPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`rep-pill rep-pill--${tone}`}>{children}</span>;
}

export function IrvPill({ band }: { band: IrvBand }) {
  return (
    <span
      className="rep-pill rep-pill--labelled"
      style={{ background: IRV_FILL[band], color: IRV_INK[band] }}
    >
      <span className="rep-pill__lbl">IRV</span>
      <span className="rep-pill__val">{band}</span>
    </span>
  );
}

export function PriorityPill({ p }: { p: RiskPriority }) {
  return (
    <span
      className="rep-pill rep-pill--labelled"
      style={{ background: PRIORITY_FILL[p], color: IRV_INK[PRIORITY_INK_KEY[p]] }}
    >
      <span className="rep-pill__lbl">PRI</span>
      <span className="rep-pill__val">{p}</span>
    </span>
  );
}

export function DecisionPill({ tear }: { tear: TearStrategy }) {
  return (
    <span className="rep-pill rep-pill--labelled rep-pill--decision">
      <span className="rep-pill__lbl">MITIGATION</span>
      <span className="rep-pill__val">{tear}</span>
    </span>
  );
}

export function CriticalityBadge({ c }: { c: number }) {
  const band: IrvBand =
    c <= 1 ? 'NEGLIGIBLE' : c === 2 ? 'LOW' : c === 3 ? 'MODERATE' : c === 4 ? 'HIGH' : 'EXTREME';
  const LABEL: Record<number, string> = { 1: 'Minimal', 2: 'Low', 3: 'Standard', 4: 'High', 5: 'Critical' };
  return (
    <span
      className="rep-crit"
      style={
        {
          ['--crit-fill' as string]: IRV_FILL[band],
          ['--crit-ink' as string]: IRV_INK[band],
        } as React.CSSProperties
      }
    >
      <span className="rep-crit__tier">C{c}</span>
      <span className="rep-crit__name">{LABEL[c] ?? ''}</span>
    </span>
  );
}
