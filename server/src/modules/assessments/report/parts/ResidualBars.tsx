import * as React from 'react';
import { IRV_BANDS, IRV_FILL } from '../constants.js';
import type { ReportThreat } from '../types.js';

export function ResidualBars({
  threats,
  title = 'Residual risk after treatment',
}: {
  threats: ReportThreat[];
  title?: string;
}) {
  const before = [0, 0, 0, 0, 0];
  const after = [0, 0, 0, 0, 0];
  threats.forEach((t) => {
    if (t.irv) before[IRV_BANDS.indexOf(t.irv)]!++;
    after[t.residualIrvIdx]!++;
  });
  const max = Math.max(...before, ...after, 1);
  // EXTREME → NEGLIGIBLE (severity descending).
  const ordered = [...IRV_BANDS].reverse();
  return (
    <div className="rep-resid">
      {title && <div className="rep-heat__title">{title}</div>}
      <div className="rep-resid__legend">
        <span>
          <span className="rep-resid__sw rep-resid__sw--before" /> Inherent
        </span>
        <span>
          <span className="rep-resid__sw rep-resid__sw--after" /> Residual (post-treatment)
        </span>
      </div>
      <div className="rep-resid__grid">
        {ordered.map((b) => {
          const i = IRV_BANDS.indexOf(b);
          return (
            <div className="rep-resid__row" key={b}>
              <div className="rep-resid__lbl">{b}</div>
              <div className="rep-resid__tracks">
                <div className="rep-resid__track">
                  <div
                    className="rep-resid__bar rep-resid__bar--before"
                    style={{ width: `${(before[i]! / max) * 100}%`, background: IRV_FILL[b] }}
                  />
                  <span className="rep-resid__num">{before[i]}</span>
                </div>
                <div className="rep-resid__track">
                  <div
                    className="rep-resid__bar rep-resid__bar--after"
                    style={{ width: `${(after[i]! / max) * 100}%`, background: IRV_FILL[b], opacity: 0.55 }}
                  />
                  <span className="rep-resid__num">{after[i]}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
