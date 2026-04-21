import * as React from 'react';
import type { AssetType } from '@prisma/client';
import {
  ChangeLog,
  ComplianceExecSummary,
  ComplianceMatrix,
  CriticalityBadge,
  DecisionPill,
  EnumPill,
  Ftr,
  Glossary,
  Hdr,
  Heatmap5x5,
  IrvPill,
  Logo,
  Methodology,
  PriorityPill,
  ResidualBars,
  SignOff,
  ThreatCard,
} from '../parts/index.js';
import {
  ADVERSARY_LABEL,
  ACTION_LABEL,
  CLUSTER_LABEL,
  CLUSTER_ORDER,
  IRV_BANDS,
  IRV_FILL,
  PRIORITIES,
  TEARS,
} from '../constants.js';
import type { ReportData, ReportThreat, ScopeAsset } from '../types.js';

export const SECTION_KEYS = [
  'cover',
  'toc',
  'summary',
  'posture',
  'compliance',
  'assets',
  'threats',
  'recommendations',
  'methodology',
  'changelog',
  'glossary',
  'signoff',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface AnalystReportProps {
  data: ReportData;
  sections?: Partial<Record<SectionKey, boolean>>;
  paper?: 'A4' | 'Letter';
}

function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

function fullNameWithRole(u: ReportData['leadAssessor']): string {
  if (!u) return '—';
  const name = `${u.firstName} ${u.lastName}`.trim();
  return u.role ? `${name} · ${u.role}` : name;
}

function groupScopeAssets(scopeAssets: ScopeAsset[]): { key: AssetType; rows: ScopeAsset[] }[] {
  const grouped = new Map<AssetType, ScopeAsset[]>();
  for (const a of scopeAssets) {
    const list = grouped.get(a.assetType) ?? [];
    list.push(a);
    grouped.set(a.assetType, list);
  }
  return CLUSTER_ORDER.flatMap((key) => {
    const rows = grouped.get(key);
    if (!rows || rows.length === 0) return [];
    return [{ key, rows }];
  });
}

export function AnalystReport({ data, sections = {}, paper = 'A4' }: AnalystReportProps) {
  const { assessment, organization, scope, threats, actionPlans, recommendations, scopeAssets, changeLog } = data;
  const irvCounts = IRV_BANDS.map((b) => threats.filter((t) => t.irv === b).length);
  const residualExtreme = threats.filter((t) => t.residualIrv === 'EXTREME').length;
  const priCounts = PRIORITIES.map((p) => threats.filter((t) => t.riskTreatmentPriority === p).length);
  const tearCounts = TEARS.map((s) => threats.filter((t) => t.tearStrategy === s).length);
  const sheetClass = `sheet sheet--${paper.toLowerCase()}`;
  const firstCardCount = Math.min(4, threats.length);
  const firstCards = threats.slice(0, firstCardCount);
  const restThreats = threats.slice(firstCardCount);
  const clusters = groupScopeAssets(scopeAssets);
  const shortId = assessment.id.slice(0, 8);
  const title = assessment.title;
  const footer = <Ftr orgName={organization.name} generatedAt={data.generatedAt} assessmentShortId={shortId} />;
  const statusDate = isoDate(data.generatedAt);

  const enabled = (k: SectionKey): boolean => sections[k] !== false;

  return (
    <div className="an-report">
      {enabled('cover') && (
        <div className={`${sheetClass} sheet--cover`}>
          <div className="an-cover">
            <div className="an-cover__dataline">
              <span>
                Assessment <span className="rep-mono">{shortId}</span>
              </span>
              <span>
                Period <span className="rep-mono">{assessment.period ?? (assessment.startedAt ? String(assessment.startedAt.getFullYear()) : '—')}</span>
              </span>
              <span>
                Version <span className="rep-mono">{assessment.version}</span>
              </span>
              <span style={{ marginLeft: 'auto' }}>
                Generated <span className="rep-mono">{statusDate}</span>
              </span>
            </div>
            <div className="an-cover__title-block">
              <div className="an-cover__kicker">CSMP Physical Security Risk Assessment · Analyst Report</div>
              <h1 className="an-cover__title">{title}</h1>
              <div className="an-cover__org">{organization.name}</div>
              <div className="an-cover__statline">
                <EnumPill tone="mono">{assessment.status}</EnumPill>
                <EnumPill tone="ok">{assessment.reviewStatus}</EnumPill>
                <EnumPill>{assessment.assessmentType}</EnumPill>
              </div>
              {scope.description && (
                <p style={{ marginTop: 10, fontSize: '10.5pt', color: 'var(--n-700)', maxWidth: '160mm' }}>
                  {scope.description}
                </p>
              )}
            </div>
            <div className="an-cover__grid">
              <div className="an-cover__hero">
                <div className="an-cover__herolabel">Threats in scope</div>
                <div className="an-cover__heronum">{threats.length}</div>
                <div className="an-cover__herosub">
                  {irvCounts[4]} Extreme · {irvCounts[3]} High · {irvCounts[2]} Moderate · {irvCounts[1]} Low · {irvCounts[0]} Negligible
                </div>
              </div>
              <div className="an-cover__hero">
                <div className="an-cover__herolabel">Action plans tracked</div>
                <div className="an-cover__heronum">{actionPlans.length}</div>
                <div className="an-cover__herosub">
                  {actionPlans.filter((p) => p.status === 'COMPLETED').length} completed ·{' '}
                  {actionPlans.filter((p) => p.status === 'IN_PROGRESS').length} in progress ·{' '}
                  {actionPlans.filter((p) => p.status === 'PENDING').length} pending
                </div>
              </div>
              <div className="an-cover__hero" style={{ gridColumn: 'span 2' }}>
                <div className="an-cover__herolabel">Assessment meta</div>
                <div className="an-cover__meta" style={{ marginTop: 8 }}>
                  <b>Scope</b>
                  <span>{scope.label}</span>
                  <b>Lead assessor</b>
                  <span>{fullNameWithRole(data.leadAssessor)}</span>
                  <b>Reviewer</b>
                  <span>{fullNameWithRole(data.reviewer)}</span>
                  <b>Approver</b>
                  <span>{fullNameWithRole(data.approver)}</span>
                  <b>Started</b>
                  <span className="rep-mono">{isoDate(assessment.startedAt)}</span>
                  <b>Completed</b>
                  <span className="rep-mono">{isoDate(assessment.completedAt)}</span>
                  <b>Signed off</b>
                  <span className="rep-mono">{isoDate(assessment.signedOffAt)}</span>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <ComplianceExecSummary threats={threats} actionPlans={actionPlans} />
              </div>
            </div>
            <div
              className="an-cover__dataline"
              style={{ borderBottom: 'none', borderTop: '0.5pt solid var(--n-300)', paddingTop: 6 }}
            >
              <Logo />
              <span style={{ marginLeft: 'auto' }}>CSMP 3-A · DBT · IRV 5×5 · TEAR · SHAPE × PPS</span>
            </div>
          </div>
        </div>
      )}

      {enabled('toc') && (
        <div className={sheetClass}>
          <Hdr title={title} page="01" />
          <h2 className="rep-h2">Contents</h2>
          <div className="rep-toc">
            {[
              ['1.0', 'Executive summary'],
              ['2.0', 'Risk posture (IRV matrix · Residual)'],
              ['3.0', 'Compliance coverage'],
              ['4.0', 'Asset register'],
              ['5.0', 'Threat register'],
              ['6.0', 'Recommendations'],
              ['A', 'Methodology appendix'],
              ['B', 'Change log'],
              ['C', 'Glossary'],
              ['D', 'Sign-off'],
            ].map(([n, t]) => (
              <div key={n} className="rep-toc__item">
                <span>
                  <span className="rep-mono" style={{ color: 'var(--n-500)', marginRight: 8 }}>
                    {n}
                  </span>
                  {t}
                </span>
              </div>
            ))}
          </div>
          {footer}
        </div>
      )}

      {enabled('summary') && (
        <div className={sheetClass}>
          <Hdr title={title} page="03" />
          <div className="rep-kicker">1.0</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>Executive summary</h2>
          <p>
            This assessment evaluates <b>{threats.length}</b> threat scenarios across <b>{scopeAssets.length}</b>{' '}
            in-scope assets following the 7-step CSMP methodology (3-A · DBT · dual matrix · TEAR · SHAPE × PPS).{' '}
            <b>{actionPlans.length}</b> action plans are tracked for REDUCE-strategy threats; residual risk after
            treatment moves <b>{Math.max(0, (irvCounts[4] ?? 0) - residualExtreme)}</b> threats out of the Extreme band.
          </p>

          <h3 className="rep-h3">Inherent Risk Value</h3>
          <div className="rep-cards">
            {IRV_BANDS.map((b, i) => (
              <div className="rep-card" key={b}>
                <div className="rep-card__strip" style={{ background: IRV_FILL[b] }} />
                <div className="rep-card__n">{irvCounts[i]}</div>
                <div className="rep-card__l">{b}</div>
              </div>
            ))}
          </div>

          <h3 className="rep-h3">Treatment priority</h3>
          <div className="rep-cards rep-cards--4">
            {PRIORITIES.map((p, i) => (
              <div className="rep-card" key={p}>
                <div className="rep-card__n">{priCounts[i]}</div>
                <div className="rep-card__l">{p}</div>
              </div>
            ))}
          </div>

          <h3 className="rep-h3">TEAR strategy mix</h3>
          <div className="rep-cards rep-cards--4">
            {TEARS.map((t, i) => (
              <div className="rep-card" key={t}>
                <div className="rep-card__n">{tearCounts[i]}</div>
                <div className="rep-card__l">{t}</div>
              </div>
            ))}
          </div>
          {footer}
        </div>
      )}

      {enabled('posture') && (
        <div className={sheetClass}>
          <Hdr title={title} page="04" />
          <div className="rep-kicker">2.0</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>Risk posture</h2>
          <Heatmap5x5 threats={threats} />
          <div style={{ height: 10 }} />
          <ResidualBars threats={threats} />
          {footer}
        </div>
      )}

      {enabled('compliance') && (
        <div className={sheetClass}>
          <Hdr title={title} page="05" />
          <div className="rep-kicker">3.0</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>Compliance coverage matrix</h2>
          <ComplianceMatrix threats={threats} actionPlans={actionPlans} />
          {footer}
        </div>
      )}

      {enabled('assets') && (
        <div className={sheetClass}>
          <Hdr title={title} page="06" />
          <div className="rep-kicker">4.0</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>
            Asset register · {scopeAssets.length} assets
          </h2>
          <p className="rep-muted" style={{ fontSize: '9.5pt', margin: '0 0 6pt' }}>
            Grouped by asset type (Site → Building → Floor → Room → Zone → Equipment). Criticality per CSMP C1–C5 scale.
          </p>
          {clusters.map(({ key, rows }) => {
            const avg = rows.reduce((s, r) => s + r.criticality, 0) / rows.length;
            return (
              <div key={key} className="rep-cluster">
                <div className="rep-cluster__hd">
                  <span className="rep-cluster__name">{CLUSTER_LABEL[key] ?? key}</span>
                  <span className="rep-cluster__meta">
                    <span className="rep-mono">{rows.length}</span> assets
                    <span className="rep-cluster__sep">·</span>
                    avg criticality <span className="rep-mono">C{Math.round(avg)}</span>
                  </span>
                </div>
                <table className="rep-tbl rep-tbl--plans">
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id}>
                        <td style={{ width: '60%' }}>
                          <b>{a.name}</b>
                        </td>
                        <td
                          className="rep-mono"
                          style={{ color: 'var(--n-500)', fontSize: '8.5pt' }}
                        >
                          {a.id.slice(0, 8)}
                        </td>
                        <td className="rep-num" style={{ width: 120 }}>
                          <CriticalityBadge c={a.criticality} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {footer}
        </div>
      )}

      {enabled('threats') && threats.length > 0 && (
        <div className={sheetClass}>
          <Hdr title={title} page="08" />
          <div className="rep-kicker">5.0</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>
            Threat register · {threats.length} scenarios
          </h2>
          <p className="rep-muted" style={{ fontSize: '10pt' }}>
            Each threat is presented as a standalone card: 3-A factoring, likelihood/impact scores, composite IRV,
            treatment priority, vulnerability rating, TEAR strategy, rationales, impact breakdown, ALARP
            justification where relevant, and associated action plans.
          </p>
          <ComplianceExecSummary
            threats={threats}
            actionPlans={actionPlans}
            title="Compliance exec summary (scope coverage)"
          />
          {firstCards.map((t, i) => (
            <ThreatCard key={t.id} t={t} idx={i + 1} actionPlans={actionPlans} />
          ))}
          {footer}
        </div>
      )}

      {enabled('threats') && restThreats.length > 0 && (
        <div className={sheetClass}>
          <Hdr title={title} page="14" />
          <h2 className="rep-h2">
            Threat register · condensed index · T{String(firstCardCount + 1).padStart(2, '0')}–T
            {String(threats.length).padStart(2, '0')}
          </h2>
          <table className="rep-tbl rep-tbl--dense">
            <colgroup>
              <col className="c-ref" />
              <col />
              <col />
              <col className="c-sc" />
              <col className="c-sc" />
              <col className="c-badge" />
              <col className="c-badge" />
              <col className="c-badge" />
              <col className="c-sc" />
            </colgroup>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Adversary · Action</th>
                <th>Target</th>
                <th>L</th>
                <th>I</th>
                <th>IRV</th>
                <th>Priority</th>
                <th>TEAR</th>
                <th className="rep-num" title="Number of mitigation action plans attached to this threat">
                  Plans
                </th>
              </tr>
            </thead>
            <tbody>
              {restThreats.map((t: ReportThreat, i) => (
                <tr key={t.id}>
                  <td className="rep-mono">T{String(firstCardCount + i + 1).padStart(2, '0')}</td>
                  <td>
                    {ADVERSARY_LABEL[t.adversaryType]} · {ACTION_LABEL[t.actionType]}
                  </td>
                  <td style={{ fontSize: '8pt', color: 'var(--n-600)' }}>
                    {t.targetAsset?.name ?? '—'}
                  </td>
                  <td className="rep-mono">{t.likelihoodScore ?? '–'}</td>
                  <td className="rep-mono">{t.impactScore ?? '–'}</td>
                  <td>{t.irv && <IrvPill band={t.irv} />}</td>
                  <td>{t.riskTreatmentPriority && <PriorityPill p={t.riskTreatmentPriority} />}</td>
                  <td>{t.tearStrategy && <DecisionPill tear={t.tearStrategy} />}</td>
                  <td className="rep-num">
                    {actionPlans.filter((p) => p.threatId === t.id).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {footer}
        </div>
      )}

      {enabled('recommendations') && recommendations.length > 0 && (
        <div className={sheetClass}>
          <Hdr title={title} page="22" />
          <div className="rep-kicker">6.0</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>
            Recommendations &amp; next steps
          </h2>
          {recommendations.map((r, i) => (
            <div key={r.id} className="rep-threat" style={{ pageBreakInside: 'avoid' }}>
              <div className="rep-threat__hd">
                <div className="rep-threat__no">{r.ref || `R${String(i + 1).padStart(2, '0')}`}</div>
                <div className="rep-threat__title-col">
                  <div className="rep-threat__ti">{r.title}</div>
                  <div className="rep-threat__sub">
                    {r.owner && (
                      <>
                        Owner <span className="rep-mono">{r.owner}</span>
                      </>
                    )}
                    {r.horizon && (
                      <>
                        {' '}
                        · Horizon <span className="rep-mono">{r.horizon}</span>
                      </>
                    )}
                    {r.cost && (
                      <>
                        {' '}
                        · Cost <span className="rep-mono">{r.cost}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="rep-threat__badges rep-threat__badges--solo">
                  <PriorityPill p={r.priority} />
                </div>
              </div>
              <p style={{ fontSize: '10pt', color: 'var(--n-700)', margin: 0 }}>{r.body}</p>
            </div>
          ))}
          {footer}
        </div>
      )}

      {enabled('methodology') && (
        <div className={sheetClass}>
          <Hdr title={title} page="25" />
          <div className="rep-kicker">Appendix A</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>Methodology</h2>
          <Methodology />
          {footer}
        </div>
      )}

      {enabled('changelog') && (
        <div className={sheetClass}>
          <Hdr title={title} page="27" />
          <div className="rep-kicker">Appendix B</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>Change log</h2>
          <ChangeLog entries={changeLog} />
          {footer}
        </div>
      )}

      {enabled('glossary') && (
        <div className={sheetClass}>
          <Hdr title={title} page="28" />
          <div className="rep-kicker">Appendix C</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>Glossary</h2>
          <Glossary />
          {footer}
        </div>
      )}

      {enabled('signoff') && (
        <div className={sheetClass}>
          <Hdr title={title} page="29" />
          <div className="rep-kicker">Appendix D</div>
          <h2 className="rep-h2" style={{ marginTop: 2 }}>Sign-off</h2>
          {assessment.reviewNotes && (
            <p style={{ fontSize: '10pt', color: 'var(--n-700)', margin: '0 0 12pt' }}>
              {assessment.reviewNotes}
            </p>
          )}
          <SignOff
            assessment={assessment}
            leadAssessor={data.leadAssessor}
            reviewer={data.reviewer}
            approver={data.approver}
          />
          {footer}
        </div>
      )}
    </div>
  );
}
