import type {
  Prisma,
  ActionPlan,
  Assessment,
  Asset,
  AssetCluster,
  Threat,
  User,
  IrvBand,
  RiskPriority,
  VulnerabilityRating,
  TearStrategy,
  AdversaryType,
  ActionType,
} from '@prisma/client';

export interface ReportData {
  organization: { name: string };
  assessment: Assessment;
  asset: Pick<Asset, 'id' | 'name' | 'assetType' | 'criticality'> | null;
  cluster: Pick<AssetCluster, 'id' | 'name' | 'clusterType'> | null;
  leadAssessor: Pick<User, 'firstName' | 'lastName' | 'email'> | null;
  reviewer: Pick<User, 'firstName' | 'lastName' | 'email'> | null;
  scopeAssets: Pick<Asset, 'id' | 'name' | 'assetType' | 'criticality'>[];
  threats: (Threat & { targetAsset: Pick<Asset, 'id' | 'name' | 'assetType'> | null })[];
  actionPlans: ActionPlan[];
  generatedAt: Date;
}

const IRV_COLOR: Record<IrvBand, string> = {
  NEGLIGIBLE: '#94a3b8',
  LOW: '#22c55e',
  MODERATE: '#eab308',
  HIGH: '#f97316',
  EXTREME: '#dc2626',
};

const PRIORITY_COLOR: Record<RiskPriority, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  HIGHEST: '#dc2626',
};

const VULN_LABEL: Record<VulnerabilityRating, string> = {
  STRONG: 'Strong',
  BASELINE: 'Baseline',
  BARELY_ADEQUATE: 'Barely adequate',
  INADEQUATE: 'Inadequate',
};

const TEAR_LABEL: Record<TearStrategy, string> = {
  TRANSFER: 'Transfer',
  ELIMINATE: 'Eliminate',
  ACCEPT: 'Accept',
  REDUCE: 'Reduce',
};

const ADVERSARY_LABEL: Record<AdversaryType, string> = {
  CRIMINAL: 'Criminal',
  TERRORIST: 'Terrorist',
  INSIDER: 'Insider',
  COMPETITOR: 'Competitor',
  ACTIVIST: 'Activist',
  NATION_STATE: 'Nation-state',
  OPPORTUNIST: 'Opportunist',
  NATURAL: 'Natural',
};

const COMPLIANCE_TAG_LABEL: Record<string, string> = {
  ISO_31000: 'ISO 31000',
  NIS2_ART_21: 'NIS2 Art. 21',
  NIS2_ART_23: 'NIS2 Art. 23',
  CER: 'CER Directive',
  ASIS_SPC_1: 'ASIS SPC.1',
  ISO_28000: 'ISO 28000',
};
const COMPLIANCE_TAG_ORDER = [
  'ISO_31000', 'NIS2_ART_21', 'NIS2_ART_23', 'CER', 'ASIS_SPC_1', 'ISO_28000',
] as const;

const ACTION_LABEL: Record<ActionType, string> = {
  THEFT: 'Theft',
  DAMAGE: 'Damage',
  DISRUPTION: 'Disruption',
  ESPIONAGE: 'Espionage',
  SABOTAGE: 'Sabotage',
  ASSAULT: 'Assault',
  INTRUSION: 'Intrusion',
  FRAUD: 'Fraud',
  ARSON: 'Arson',
  BOMB: 'Bomb',
  CYBER: 'Cyber',
  NATURAL_DISASTER: 'Natural disaster',
};

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

function assetTypeLabel(t: string): string {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

function criticalityBadge(c: number): string {
  const band: IrvBand =
    c <= 1 ? 'NEGLIGIBLE' : c === 2 ? 'LOW' : c === 3 ? 'MODERATE' : c === 4 ? 'HIGH' : 'EXTREME';
  return `<span class="pill" style="background:${IRV_COLOR[band]};color:#fff;">C${c}</span>`;
}

function irvBadge(irv: IrvBand | null): string {
  if (!irv) return '<span class="muted">—</span>';
  return `<span class="pill" style="background:${IRV_COLOR[irv]};color:#fff;">${irv}</span>`;
}

function priorityBadge(p: RiskPriority | null): string {
  if (!p) return '<span class="muted">—</span>';
  return `<span class="pill" style="background:${PRIORITY_COLOR[p]};color:#fff;">${p}</span>`;
}

function buildComplianceMatrix(
  threats: ReportData['threats'],
  actionPlans: ActionPlan[],
): string {
  const threatCounts: Record<string, number> = {};
  const planCounts: Record<string, number> = {};
  for (const t of threats) {
    for (const tag of t.complianceTags ?? []) {
      threatCounts[tag] = (threatCounts[tag] ?? 0) + 1;
    }
  }
  for (const p of actionPlans) {
    for (const tag of p.complianceTags ?? []) {
      planCounts[tag] = (planCounts[tag] ?? 0) + 1;
    }
  }
  const taggedFrameworks = COMPLIANCE_TAG_ORDER.filter(
    (tag) => (threatCounts[tag] ?? 0) > 0 || (planCounts[tag] ?? 0) > 0,
  );
  if (taggedFrameworks.length === 0) {
    return `
<h2>Compliance coverage matrix</h2>
<p class="muted">No threats or action plans have been tagged against a compliance framework.</p>`;
  }
  const totalThreats = threats.length;
  const rows = taggedFrameworks
    .map((tag) => {
      const tc = threatCounts[tag] ?? 0;
      const pc = planCounts[tag] ?? 0;
      const pct = totalThreats > 0 ? Math.round((tc / totalThreats) * 100) : 0;
      return `
      <tr>
        <td><b>${escapeHtml(COMPLIANCE_TAG_LABEL[tag] ?? tag)}</b></td>
        <td>${tc}</td>
        <td>${pc}</td>
        <td>${totalThreats > 0 ? `${pct}%` : '—'}</td>
      </tr>`;
    })
    .join('');
  return `
<h2>Compliance coverage matrix</h2>
<table>
  <thead>
    <tr>
      <th>Framework</th>
      <th>Threats tagged</th>
      <th>Action plans tagged</th>
      <th>% of threats</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

export function renderReportHtml(data: ReportData): string {
  const {
    organization, assessment, asset, cluster, leadAssessor, reviewer,
    scopeAssets, threats, actionPlans, generatedAt,
  } = data;

  const leadName = leadAssessor
    ? `${leadAssessor.firstName} ${leadAssessor.lastName}`.trim()
    : '—';
  const reviewerName = reviewer
    ? `${reviewer.firstName} ${reviewer.lastName}`.trim()
    : '—';
  const scopeLabel = asset
    ? `Asset · ${escapeHtml(asset.name)}`
    : cluster
      ? `Cluster · ${escapeHtml(cluster.name)}`
      : '—';

  const plansByThreat = new Map<string, ActionPlan[]>();
  for (const p of actionPlans) {
    const arr = plansByThreat.get(p.threatId) ?? [];
    arr.push(p);
    plansByThreat.set(p.threatId, arr);
  }

  // Executive counts
  const irvCounts: Record<IrvBand, number> = {
    NEGLIGIBLE: 0, LOW: 0, MODERATE: 0, HIGH: 0, EXTREME: 0,
  };
  const priorityCounts: Record<RiskPriority, number> = {
    LOW: 0, MEDIUM: 0, HIGH: 0, HIGHEST: 0,
  };
  const tearCounts: Record<TearStrategy, number> = {
    TRANSFER: 0, ELIMINATE: 0, ACCEPT: 0, REDUCE: 0,
  };
  for (const t of threats) {
    if (t.irv) irvCounts[t.irv]++;
    if (t.riskTreatmentPriority) priorityCounts[t.riskTreatmentPriority]++;
    if (t.tearStrategy) tearCounts[t.tearStrategy]++;
  }

  const reducePlansDone = actionPlans.filter((p) => p.status === 'COMPLETED').length;

  const assetRows = scopeAssets
    .map(
      (a) => `
    <tr>
      <td>${escapeHtml(a.name)}</td>
      <td>${escapeHtml(assetTypeLabel(a.assetType))}</td>
      <td>${criticalityBadge(a.criticality)}</td>
    </tr>`,
    )
    .join('');

  const threatSections = threats
    .map((t, idx) => {
      const plans = plansByThreat.get(t.id) ?? [];
      const impact = t.impactBreakdown as Prisma.JsonObject | null;
      const impactBits = impact
        ? (['people', 'property', 'operations', 'reputation', 'financial'] as const)
            .map((k) => `<span class="kv"><b>${k}</b>: ${impact[k] ?? '—'}</span>`)
            .join('')
        : '';
      const plansHtml =
        plans.length === 0
          ? ''
          : `
      <div class="subsection">
        <div class="subhead">Action plans (${plans.length})</div>
        <table class="plans">
          <thead>
            <tr><th>Action</th><th>Owner</th><th>Target</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${plans
              .map(
                (p) => `
              <tr>
                <td>${escapeHtml(p.actionRequired)}</td>
                <td>${escapeHtml(p.responsiblePerson) || '—'}</td>
                <td>${fmtDate(p.targetDate)}</td>
                <td>${escapeHtml(p.status)}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

      return `
    <section class="threat">
      <div class="threat-head">
        <div class="threat-no">T${idx + 1}</div>
        <div class="threat-title">
          <div class="threat-name">${escapeHtml(ADVERSARY_LABEL[t.adversaryType])} · ${escapeHtml(ACTION_LABEL[t.actionType])}</div>
          <div class="threat-sub">Target: ${escapeHtml(t.targetAsset?.name ?? '—')}</div>
        </div>
        <div class="threat-pills">
          ${irvBadge(t.irv)} ${priorityBadge(t.riskTreatmentPriority)}
        </div>
      </div>

      <div class="threat-grid">
        <div><div class="lbl">Likelihood</div><div class="val">${t.likelihoodScore ?? '—'}/5</div></div>
        <div><div class="lbl">Impact (composite)</div><div class="val">${t.impactScore ?? '—'}/5</div></div>
        <div><div class="lbl">Vulnerability</div><div class="val">${t.vulnerabilityRating ? VULN_LABEL[t.vulnerabilityRating] : '—'}</div></div>
        <div><div class="lbl">TEAR</div><div class="val">${t.tearStrategy ? TEAR_LABEL[t.tearStrategy] : '—'}</div></div>
      </div>

      ${impactBits ? `<div class="impact-bits">${impactBits}</div>` : ''}

      ${
        t.likelihoodRationale
          ? `<div class="rationale"><b>Likelihood rationale:</b> ${escapeHtml(t.likelihoodRationale)}</div>`
          : ''
      }
      ${
        t.impactRationale
          ? `<div class="rationale"><b>Impact rationale:</b> ${escapeHtml(t.impactRationale)}</div>`
          : ''
      }
      ${
        t.vulnerabilityRationale
          ? `<div class="rationale"><b>Vulnerability rationale:</b> ${escapeHtml(t.vulnerabilityRationale)}</div>`
          : ''
      }
      ${
        t.alarpJustification
          ? `<div class="rationale alarp"><b>ALARP justification:</b> ${escapeHtml(t.alarpJustification)}</div>`
          : ''
      }

      ${plansHtml}
    </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(assessment.title)} — CSMP Risk Report</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif;
    color: #0f172a;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  h1 { font-size: 22pt; margin: 0 0 4pt; font-weight: 700; letter-spacing: -0.3pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 3pt; }
  h3 { font-size: 11pt; margin: 10pt 0 4pt; font-weight: 700; color: #334155; }
  .muted { color: #64748b; }
  .pill {
    display: inline-block; padding: 1pt 6pt; border-radius: 9pt;
    font-size: 8.5pt; font-weight: 700; letter-spacing: 0.2pt;
  }

  /* cover */
  .cover {
    page-break-after: always;
    padding-top: 14mm;
  }
  .cover .kicker { font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 1.2pt; margin-bottom: 8pt; }
  .cover .meta { margin-top: 14pt; color: #334155; font-size: 10pt; }
  .cover .meta div { padding: 2pt 0; }
  .cover .meta b { color: #0f172a; display: inline-block; width: 44mm; }
  .cover .status-row { margin-top: 10pt; }

  /* exec summary cards */
  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4pt; margin: 6pt 0; }
  .card { border: 1px solid #e2e8f0; border-radius: 4pt; padding: 6pt 8pt; }
  .card .num { font-size: 18pt; font-weight: 700; color: #0f172a; line-height: 1.1; }
  .card .lbl { font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.8pt; margin-top: 2pt; }

  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; }

  /* tables */
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { text-align: left; padding: 4pt 6pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 700; color: #334155; font-size: 9pt; }

  /* threats */
  .threat {
    margin: 10pt 0;
    padding: 8pt 10pt;
    border: 1px solid #e2e8f0;
    border-radius: 5pt;
    page-break-inside: avoid;
  }
  .threat-head {
    display: grid;
    grid-template-columns: 24pt 1fr auto;
    gap: 8pt;
    align-items: center;
    margin-bottom: 6pt;
  }
  .threat-no {
    background: #1e293b; color: #fff; border-radius: 3pt;
    font-size: 9pt; font-weight: 700;
    text-align: center; padding: 2pt 0;
  }
  .threat-name { font-weight: 700; font-size: 11pt; }
  .threat-sub { font-size: 9pt; color: #64748b; margin-top: 1pt; }

  .threat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6pt; margin: 4pt 0 6pt; }
  .threat-grid .lbl { font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.8pt; }
  .threat-grid .val { font-weight: 600; font-size: 10pt; margin-top: 1pt; }

  .impact-bits { font-size: 9pt; color: #475569; margin: 2pt 0 4pt; }
  .impact-bits .kv { display: inline-block; margin-right: 10pt; }

  .rationale { font-size: 9.5pt; color: #334155; margin: 3pt 0; }
  .rationale.alarp { background: #fef3c7; border-left: 3px solid #eab308; padding: 4pt 6pt; border-radius: 2pt; }

  .subsection { margin-top: 6pt; padding-top: 4pt; border-top: 1px dashed #e2e8f0; }
  .subhead { font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.8pt; margin-bottom: 3pt; }
  .plans th, .plans td { font-size: 9pt; }

  footer {
    margin-top: 18pt; padding-top: 8pt; border-top: 1px solid #e2e8f0;
    font-size: 8pt; color: #94a3b8;
  }
</style>
</head>
<body>

<!-- ══════════ COVER ══════════ -->
<div class="cover">
  <div class="kicker">CSMP Physical Security Risk Assessment</div>
  <h1>${escapeHtml(assessment.title)}</h1>
  <div class="muted">${escapeHtml(organization.name)}</div>

  <div class="status-row">
    <span class="pill" style="background:#1e293b;color:#fff;">${escapeHtml(assessment.status)}</span>
    <span class="pill" style="background:#0ea5e9;color:#fff;">${escapeHtml(assessment.reviewStatus)}</span>
    <span class="pill" style="background:#e2e8f0;color:#334155;">${escapeHtml(assessment.assessmentType)}</span>
  </div>

  <div class="meta">
    <div><b>Scope</b> ${scopeLabel}</div>
    <div><b>Lead assessor</b> ${escapeHtml(leadName)}</div>
    <div><b>Reviewer</b> ${escapeHtml(reviewerName)}</div>
    <div><b>Started</b> ${fmtDate(assessment.startedAt)}</div>
    <div><b>Completed</b> ${fmtDate(assessment.completedAt)}</div>
    <div><b>Generated</b> ${fmtDate(generatedAt)}</div>
  </div>
</div>

<!-- ══════════ EXECUTIVE SUMMARY ══════════ -->
<h2>Executive summary</h2>

<p>
  This assessment evaluates <b>${threats.length}</b> threat scenario${threats.length === 1 ? '' : 's'}
  across <b>${scopeAssets.length}</b> asset${scopeAssets.length === 1 ? '' : 's'}
  following the 7-step CSMP methodology (3 A's · DBT · dual matrix · TEAR).
  ${actionPlans.length > 0 ? `<b>${actionPlans.length}</b> action plan${actionPlans.length === 1 ? '' : 's'} ${reducePlansDone > 0 ? `(${reducePlansDone} completed)` : ''} are tracked for REDUCE-strategy threats.` : ''}
</p>

<h3>Inherent Risk Value (IRV) distribution</h3>
<div class="cards">
  ${(['NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH', 'EXTREME'] as const)
    .map(
      (b) => `
    <div class="card" style="border-top: 3px solid ${IRV_COLOR[b]};">
      <div class="num">${irvCounts[b]}</div>
      <div class="lbl">${b}</div>
    </div>`,
    )
    .join('')}
</div>

<h3>Treatment priority</h3>
<div class="cards" style="grid-template-columns: repeat(4, 1fr);">
  ${(['LOW', 'MEDIUM', 'HIGH', 'HIGHEST'] as const)
    .map(
      (p) => `
    <div class="card" style="border-top: 3px solid ${PRIORITY_COLOR[p]};">
      <div class="num">${priorityCounts[p]}</div>
      <div class="lbl">${p}</div>
    </div>`,
    )
    .join('')}
</div>

<h3>TEAR strategy selection</h3>
<div class="cards" style="grid-template-columns: repeat(4, 1fr);">
  ${(['TRANSFER', 'ELIMINATE', 'ACCEPT', 'REDUCE'] as const)
    .map(
      (s) => `
    <div class="card">
      <div class="num">${tearCounts[s]}</div>
      <div class="lbl">${TEAR_LABEL[s]}</div>
    </div>`,
    )
    .join('')}
</div>

${buildComplianceMatrix(threats, actionPlans)}

<!-- ══════════ ASSET REGISTER ══════════ -->
<h2>Asset register</h2>
${
  scopeAssets.length === 0
    ? '<p class="muted">No assets in scope.</p>'
    : `<table>
    <thead><tr><th>Name</th><th>Type</th><th>Criticality</th></tr></thead>
    <tbody>${assetRows}</tbody>
  </table>`
}

<!-- ══════════ THREATS ══════════ -->
<h2>Threat register</h2>
${
  threats.length === 0
    ? '<p class="muted">No threats recorded.</p>'
    : threatSections
}

${
  assessment.reviewNotes
    ? `<h2>Reviewer notes</h2><p>${escapeHtml(assessment.reviewNotes)}</p>`
    : ''
}

<footer>
  Generated ${generatedAt.toISOString()} · CSMP Risk Assessment · Assessment ID ${assessment.id}
</footer>

</body>
</html>`;
}
