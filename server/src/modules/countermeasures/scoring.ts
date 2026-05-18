import type { VulnerabilityRating } from '@prisma/client';

// Step 6 numeric mapping for vulnerability / effectiveness ratings.
// Mirrors §2.5 of step6-countermeasures-gap-analysis.md.
//   Strong = 4 (best) → Inadequate = 1 (worst)
// effectivenessScore reuses these same buckets — a control rated STRONG
// is fully effective; a control rated INADEQUATE is ineffective.
export function vulnerabilityRatingToNumeric(r: VulnerabilityRating): number {
  switch (r) {
    case 'STRONG': return 4;
    case 'BASELINE': return 3;
    case 'BARELY_ADEQUATE': return 2;
    case 'INADEQUATE': return 1;
  }
}

// gap_delta = effectiveness − survey baseline.
// Negative → control underperforms baseline (open INEFFECTIVE gap).
// Zero/positive → control meets or beats baseline.
export function computeGapDelta(
  effectivenessScore: number,
  surveyRatingNumeric: number,
): number {
  return effectivenessScore - surveyRatingNumeric;
}

// Map gap_delta + parent IRV → gap severity for prioritisation.
// Mirrors the doc's "CRITICAL when IRV=Extreme/High + no control" guidance,
// degrading downwards as residual exposure shrinks.
import type { IrvBand } from '@prisma/client';

export function gapSeverityFromIrv(
  irv: IrvBand | null,
  gapDelta: number | null,
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const noControlOrFar = gapDelta == null || gapDelta <= -2;
  if (irv === 'EXTREME' || irv === 'HIGH') return noControlOrFar ? 'CRITICAL' : 'HIGH';
  if (irv === 'MODERATE') return noControlOrFar ? 'HIGH' : 'MEDIUM';
  if (irv === 'LOW') return 'MEDIUM';
  return 'LOW';
}

// Effective vulnerability for Step 7 priority recompute when open gaps exist.
// Mirrors §4.4 of the gap-analysis doc:
//   NO_CONTROL              → INADEQUATE (worst column)
//   INEFFECTIVE/DEGRADED    → downgrade one band from rated value
//   COVERAGE_MISSING        → assessment-driven (no-op here)
const VULN_ORDER: VulnerabilityRating[] = [
  'STRONG', 'BASELINE', 'BARELY_ADEQUATE', 'INADEQUATE',
];

function downgrade(v: VulnerabilityRating): VulnerabilityRating {
  const i = VULN_ORDER.indexOf(v);
  return VULN_ORDER[Math.min(i + 1, VULN_ORDER.length - 1)]!;
}

export type GapTypeForVuln = 'NO_CONTROL' | 'INEFFECTIVE' | 'DEGRADED_ASSET' | 'COVERAGE_MISSING';

export function effectiveVulnerability(
  rated: VulnerabilityRating,
  openGapTypes: GapTypeForVuln[],
): VulnerabilityRating {
  if (openGapTypes.includes('NO_CONTROL')) return 'INADEQUATE';
  if (openGapTypes.includes('INEFFECTIVE') || openGapTypes.includes('DEGRADED_ASSET')) {
    return downgrade(rated);
  }
  return rated;
}
