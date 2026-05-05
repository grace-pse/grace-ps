import { Link } from '@tanstack/react-router';
import { ExternalLink, X } from 'lucide-react';
import { Btn2 } from './hifi/Btn2';
import { Pill } from './hifi/Pill';
import { RiskBadge, type RiskLevel } from './hifi/RiskBadge';
import {
  COMPLIANCE_TAG_LABEL,
  type IrvBand,
  type RiskPriority,
  type ThreatCatalogItem,
} from '../lib/csmp-types';

interface Props {
  threat: ThreatCatalogItem;
  onClose: () => void;
}

const IRV_TO_LEVEL: Record<IrvBand, RiskLevel> = {
  NEGLIGIBLE: 'Negligible',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  EXTREME: 'Extreme',
};

const PRIORITY_VARIANT: Record<RiskPriority, 'default' | 'info' | 'warn' | 'bad'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warn',
  HIGHEST: 'bad',
};

const IMPACT_DIM_LABEL: Record<string, string> = {
  people: 'People',
  property: 'Property',
  operations: 'Operations',
  reputation: 'Reputation',
  financial: 'Financial',
};

export function ThreatDetailDrawer({ threat, onClose }: Props) {
  const t = threat;
  const impact = t.impactBreakdown ?? null;

  return (
    <>
      <div className="fixed inset-0 bg-n-900/30 z-30" onClick={onClose} aria-hidden />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-[560px] bg-white border-l border-n-200 shadow-sh3 z-40 flex flex-col"
        role="dialog"
        aria-labelledby="threat-detail-title"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-n-150 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Pill variant="accent">{t.adversaryType.replace('_', ' ')}</Pill>
              <Pill variant="outline">{t.actionType.replace('_', ' ')}</Pill>
            </div>
            <h2 id="threat-detail-title" className="text-[15px] font-semibold text-n-900 truncate">
              {t.targetAssetName ?? 'No target asset'}
            </h2>
            <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mt-0.5">
              ID · {t.id.slice(0, 8)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Identity */}
          {(t.adversaryDescription || t.actionDescription || t.locationContext || t.facilitatingFactors || t.timeContext) && (
            <Section title="Context">
              {t.adversaryDescription && <DefRow label="Adversary" value={t.adversaryDescription} />}
              {t.actionDescription && <DefRow label="Action" value={t.actionDescription} />}
              {t.locationContext && <DefRow label="Location" value={t.locationContext} />}
              {t.facilitatingFactors && <DefRow label="Facilitating factors" value={t.facilitatingFactors} />}
              {t.timeContext && <DefRow label="Time" value={t.timeContext} />}
            </Section>
          )}

          {/* Risk scoring */}
          <Section title="Risk scoring">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <ScoreTile label="Likelihood" value={t.likelihoodScore} max={5} />
              <ScoreTile label="Impact" value={t.impactScore} max={5} />
              <div className="bg-n-50 border border-n-150 rounded-r2 px-2 py-1.5">
                <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Vulnerability</div>
                <div className="text-[12.5px] font-medium text-n-800 mt-0.5">
                  {t.vulnerabilityRating ? t.vulnerabilityRating.replace('_', ' ') : <span className="text-n-400">—</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">IRV</span>
              {t.irv ? <RiskBadge level={IRV_TO_LEVEL[t.irv]} /> : <span className="text-n-400 text-[12px]">—</span>}
              <span className="text-n-300">·</span>
              <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">Priority</span>
              {t.riskTreatmentPriority ? (
                <Pill variant={PRIORITY_VARIANT[t.riskTreatmentPriority]}>{t.riskTreatmentPriority}</Pill>
              ) : (
                <span className="text-n-400 text-[12px]">—</span>
              )}
            </div>
            {impact && Object.keys(impact).length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-1.5">
                  Impact breakdown
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {Object.entries(impact).map(([key, val]) => (
                    <div key={key} className="bg-n-50 border border-n-150 rounded-r1 px-1.5 py-1 text-center">
                      <div className="text-[9.5px] font-mono uppercase text-n-500 tracking-[0.4px]">
                        {IMPACT_DIM_LABEL[key] ?? key}
                      </div>
                      <div className="text-[12.5px] font-semibold text-n-900 mt-0.5">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {t.likelihoodRationale && <RationaleRow label="Likelihood rationale" value={t.likelihoodRationale} />}
            {t.impactRationale && <RationaleRow label="Impact rationale" value={t.impactRationale} />}
            {t.vulnerabilityRationale && (
              <RationaleRow label="Vulnerability rationale" value={t.vulnerabilityRationale} />
            )}
          </Section>

          {/* DBT link */}
          <Section title="Design Basis Threat">
            {t.dbtReferenceId ? (
              <div className="bg-a-50 border border-a-200 rounded-r2 px-3 py-2">
                <div className="flex items-center gap-2">
                  {t.dbtCsmpUnitReference && (
                    <span className="font-mono text-[11px] text-a-700 bg-white border border-a-200 rounded-r1 px-1.5 py-0.5">
                      {t.dbtCsmpUnitReference}
                    </span>
                  )}
                  <span className="text-[12.5px] font-medium text-n-900 truncate">
                    {t.dbtScenarioName ?? 'Unnamed DBT'}
                  </span>
                </div>
                <div className="text-[11px] font-mono uppercase text-n-500 tracking-[0.4px] mt-1">
                  Linked
                </div>
              </div>
            ) : (
              <div className="bg-n-50 border border-dashed border-n-200 rounded-r2 px-3 py-2 text-[12px] text-n-500">
                Not linked to a DBT — relink from the assessment wizard to assign one.
              </div>
            )}
          </Section>

          {/* Compliance tags */}
          {t.complianceTags.length > 0 && (
            <Section title="Compliance">
              <div className="flex flex-wrap gap-1">
                {t.complianceTags.map((tag) => (
                  <Pill key={tag} variant="info">{COMPLIANCE_TAG_LABEL[tag]}</Pill>
                ))}
              </div>
            </Section>
          )}

          {/* Cross-links */}
          <Section title="Cross-links">
            <div className="grid grid-cols-2 gap-2">
              <CrossLink
                label="Countermeasures"
                value={t.countermeasureCount}
                to="/countermeasures"
                search={{ assignedToThreatId: t.id }}
              />
              <CrossLink
                label="Action plans"
                value={t.actionPlanCount}
                to={`/assessments/${t.assessmentId}`}
              />
              {t.targetAssetId && (
                <CrossLink
                  label="Target asset"
                  value={t.targetAssetName ?? '—'}
                  to="/assets"
                  search={{ assetId: t.targetAssetId }}
                />
              )}
              <CrossLink
                label="Assessment"
                value={t.assessmentTitle ?? '—'}
                to={`/assessments/${t.assessmentId}`}
              />
            </div>
          </Section>

          {/* TEAR */}
          {(t.tearStrategy || t.alarpJustification) && (
            <Section title="Treatment (Step 7)">
              {t.tearStrategy && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">TEAR</span>
                  <Pill variant="accent">{t.tearStrategy}</Pill>
                </div>
              )}
              {t.alarpJustification && (
                <div className="text-[12px] text-n-700 leading-relaxed bg-n-50 border border-n-150 rounded-r2 px-3 py-2">
                  {t.alarpJustification}
                </div>
              )}
            </Section>
          )}
        </div>

        <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
          <Btn2 variant="ghost" onClick={onClose}>Close</Btn2>
          <Link to="/assessments/$id" params={{ id: t.assessmentId }}>
            <Btn2 variant="primary" leading={<ExternalLink className="w-3.5 h-3.5" />}>
              Open in wizard
            </Btn2>
          </Link>
        </footer>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-2">{title}</h3>
      {children}
    </section>
  );
}

function DefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{label}</div>
      <div className="text-[12.5px] text-n-800 leading-relaxed">{value}</div>
    </div>
  );
}

function RationaleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2.5">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px] mb-0.5">{label}</div>
      <div className="text-[12px] text-n-700 leading-relaxed bg-n-50 border border-n-150 rounded-r2 px-2.5 py-1.5">
        {value}
      </div>
    </div>
  );
}

function ScoreTile({ label, value, max }: { label: string; value: number | null; max: number }) {
  return (
    <div className="bg-n-50 border border-n-150 rounded-r2 px-2 py-1.5">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{label}</div>
      <div className="text-[12.5px] font-medium text-n-800 mt-0.5">
        {value != null ? <>{value}<span className="text-n-400 font-normal"> / {max}</span></> : <span className="text-n-400">—</span>}
      </div>
    </div>
  );
}

function CrossLink({
  label, value, to, search,
}: {
  label: string;
  value: string | number;
  to: string;
  search?: Record<string, string>;
}) {
  const inner = (
    <div className="bg-white border border-n-150 rounded-r2 px-3 py-2 hover:bg-n-50 transition-colors h-full">
      <div className="text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">{label}</div>
      <div className="text-[12.5px] font-medium text-n-800 mt-0.5 truncate">{value}</div>
    </div>
  );
  // TanStack Router's typed Link is strict; for loose cross-links to optional
  // search params on other routes we fall back to a plain anchor.
  if (search) {
    const qs = new URLSearchParams(search).toString();
    return <a href={`${to}?${qs}`}>{inner}</a>;
  }
  return <a href={to}>{inner}</a>;
}
