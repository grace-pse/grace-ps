import * as React from 'react';
import type { IrvBand } from '@prisma/client';
import { IRV_BANDS, IRV_FILL, IRV_INK } from '../constants.js';
import type { ReportThreat } from '../types.js';

const LIK_LABEL: Record<number, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost certain',
};
const IMP_LABEL: Record<number, string> = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Severe',
};

function bandForCell(l: number, i: number): IrvBand {
  const s = (l + 1) * (i + 1);
  return s <= 3 ? 'NEGLIGIBLE' : s <= 6 ? 'LOW' : s <= 12 ? 'MODERATE' : s <= 18 ? 'HIGH' : 'EXTREME';
}

export function Heatmap5x5({
  threats,
  title = 'Inherent Risk Value (5×5 matrix)',
  compact = false,
}: {
  threats: ReportThreat[];
  title?: string;
  compact?: boolean;
}) {
  const cells: ReportThreat[][][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, (): ReportThreat[] => []),
  );
  threats.forEach((t) => {
    const l = (t.likelihoodScore || 1) - 1;
    const i = (t.impactScore || 1) - 1;
    if (l >= 0 && l < 5 && i >= 0 && i < 5) cells[l]![i]!.push(t);
  });
  const cellSize = compact ? 42 : 58;
  return (
    <div className="rep-heat">
      {title && <div className="rep-heat__title">{title}</div>}
      <div
        className="rep-heat2"
        style={{ ['--cell' as string]: `${cellSize}px` } as React.CSSProperties}
      >
        <div className="rep-heat2__yaxis">Likelihood</div>
        <div className="rep-heat2__yticks">
          {[5, 4, 3, 2, 1].map((l) => (
            <div key={l} className="rep-heat2__ytick">
              <span className="rep-heat2__num">{l}</span>
              <span className="rep-heat2__lbl">{LIK_LABEL[l]}</span>
            </div>
          ))}
        </div>
        <div className="rep-heat2__matrix">
          {[5, 4, 3, 2, 1].map((lRow) => (
            <div className="rep-heat2__row" key={lRow}>
              {[1, 2, 3, 4, 5].map((iCol) => {
                const band = bandForCell(lRow - 1, iCol - 1);
                const list = cells[lRow - 1]![iCol - 1]!;
                return (
                  <div
                    key={iCol}
                    className="rep-heat2__cell"
                    style={{ background: IRV_FILL[band], color: IRV_INK[band] }}
                  >
                    <span className="rep-heat2__count">{list.length || ''}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="rep-heat2__xticks">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rep-heat2__xtick">
              <span className="rep-heat2__num">{i}</span>
              <span className="rep-heat2__lbl">{IMP_LABEL[i]}</span>
            </div>
          ))}
        </div>
        <div className="rep-heat2__xaxis">Impact</div>
      </div>
      <div className="rep-heat__legend">
        {IRV_BANDS.map((b) => (
          <span key={b} className="rep-heat__key">
            <span className="rep-heat__kdot" style={{ background: IRV_FILL[b] }} />
            <span className="rep-heat__klbl">{b}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
