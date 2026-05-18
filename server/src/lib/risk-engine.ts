// CSMP 3-A risk engine. Pure lookups; no I/O.
// Ported from csmp-run/server.py lines 30-54, 162-169.

export type IrvBand = 'NEGLIGIBLE' | 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type Vulnerability = 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE';
export type RiskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';

// Rows = likelihood 1..5, cols = impact 1..5
const IRV_MATRIX: IrvBand[][] = [
  ['NEGLIGIBLE', 'NEGLIGIBLE', 'LOW',      'LOW',      'MODERATE'],
  ['NEGLIGIBLE', 'LOW',        'LOW',      'MODERATE', 'HIGH'],
  ['NEGLIGIBLE', 'LOW',        'MODERATE', 'HIGH',     'HIGH'],
  ['LOW',        'MODERATE',   'HIGH',     'HIGH',     'EXTREME'],
  ['LOW',        'MODERATE',   'HIGH',     'EXTREME',  'EXTREME'],
];

// Rows = IRV band, cols = vulnerability rating
const PRIORITY_MATRIX: RiskPriority[][] = [
  ['LOW',    'LOW',    'LOW',     'LOW'],     // NEGLIGIBLE
  ['LOW',    'LOW',    'LOW',     'MEDIUM'],  // LOW
  ['LOW',    'LOW',    'MEDIUM',  'HIGH'],    // MODERATE
  ['LOW',    'MEDIUM', 'HIGH',    'HIGHEST'], // HIGH
  ['MEDIUM', 'HIGH',   'HIGHEST', 'HIGHEST'], // EXTREME
];

const IRV_IDX: Record<IrvBand, number> = { NEGLIGIBLE: 0, LOW: 1, MODERATE: 2, HIGH: 3, EXTREME: 4 };
const VULN_IDX: Record<Vulnerability, number> = { STRONG: 0, BASELINE: 1, BARELY_ADEQUATE: 2, INADEQUATE: 3 };

export function calculateIrv(likelihood: number, impact: number): IrvBand {
  const l = Math.max(1, Math.min(5, likelihood)) - 1;
  const i = Math.max(1, Math.min(5, impact)) - 1;
  return IRV_MATRIX[l]![i]!;
}

export function calculatePriority(irv: IrvBand, vulnerability: Vulnerability): RiskPriority {
  return PRIORITY_MATRIX[IRV_IDX[irv]]![VULN_IDX[vulnerability]]!;
}

export interface ImpactBreakdown {
  people: number;
  property: number;
  operations: number;
  reputation: number;
  financial: number;
}

// Composite impact = max across the five dimensions (csmp-run convention).
export function compositeImpact(b: ImpactBreakdown): number {
  return Math.max(b.people, b.property, b.operations, b.reputation, b.financial);
}
