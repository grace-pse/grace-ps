import * as React from 'react';
import type { ActionPlan } from '@prisma/client';
import { ADVERSARY_LABEL, ACTION_LABEL, COMPLIANCE_LABEL, VULN_LABEL } from '../constants.js';
import type { ReportThreat } from '../types.js';
import { DecisionPill, EnumPill, IrvPill, PriorityPill } from './Pill.js';

const IMPACT_KEYS = ['people', 'property', 'operations', 'reputation', 'financial'] as const;

function statusTone(s: ActionPlan['status']): 'ok' | 'warn' | 'neutral' {
  return s === 'COMPLETED' ? 'ok' : s === 'IN_PROGRESS' ? 'warn' : 'neutral';
}

export function ThreatCard({
  t,
  idx,
  actionPlans,
  showPlans = true,
}: {
  t: ReportThreat;
  idx: number;
  actionPlans: ActionPlan[];
  showPlans?: boolean;
}) {
  const imp = (t.impactBreakdown ?? {}) as Record<string, number | undefined>;
  const plans = actionPlans.filter((p) => p.threatId === t.id);
  const target = t.targetAsset;
  return (
    <section className="rep-threat">
      <header className="rep-threat__hd">
        <div className="rep-threat__no">T{String(idx).padStart(2, '0')}</div>
        <div className="rep-threat__title-col">
          <div className="rep-threat__ti">
            {ADVERSARY_LABEL[t.adversaryType]}{' '}
            <span className="rep-threat__sep">·</span> {ACTION_LABEL[t.actionType]}
          </div>
          {target && (
            <div className="rep-threat__sub">
              Target <span className="rep-mono">{target.name}</span> ·{' '}
              {String(target.assetType).toLowerCase()} · C{target.criticality}
            </div>
          )}
        </div>
        <div className="rep-threat__badges">
          {t.irv && <IrvPill band={t.irv} />}
          {t.riskTreatmentPriority && <PriorityPill p={t.riskTreatmentPriority} />}
          {t.tearStrategy && <DecisionPill tear={t.tearStrategy} />}
        </div>
      </header>

      <div className="rep-threat__metrics">
        <div className="rep-threat__metric">
          <div className="rep-kicker">Likelihood</div>
          <div className="rep-metric__v">
            {t.likelihoodScore ?? '–'}
            <span className="rep-metric__d">/5</span>
          </div>
        </div>
        <div className="rep-threat__metric">
          <div className="rep-kicker">Impact (composite)</div>
          <div className="rep-metric__v">
            {t.impactScore ?? '–'}
            <span className="rep-metric__d">/5</span>
          </div>
        </div>
        <div className="rep-threat__metric">
          <div className="rep-kicker">IRV score</div>
          <div className="rep-metric__v">{t.irvScore || '–'}</div>
        </div>
        <div className="rep-threat__metric">
          <div className="rep-kicker">Vulnerability</div>
          <div className="rep-metric__v rep-metric__v--sm">
            {t.vulnerabilityRating ? VULN_LABEL[t.vulnerabilityRating] : '–'}
          </div>
        </div>
      </div>

      {Object.keys(imp).length > 0 && (
        <div className="rep-impact">
          <div className="rep-kicker">Impact breakdown</div>
          <div className="rep-impact__bits">
            {IMPACT_KEYS.map((k) => (
              <span key={k} className="rep-impact__kv">
                <b>{k}</b> <span className="rep-mono">{imp[k] ?? '–'}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rep-rats">
        {t.likelihoodRationale && (
          <div className="rep-rat">
            <span className="rep-rat__lbl">Likelihood</span>
            {t.likelihoodRationale}
          </div>
        )}
        {t.impactRationale && (
          <div className="rep-rat">
            <span className="rep-rat__lbl">Impact</span>
            {t.impactRationale}
          </div>
        )}
        {t.vulnerabilityRationale && (
          <div className="rep-rat">
            <span className="rep-rat__lbl">Vulnerability</span>
            {t.vulnerabilityRationale}
          </div>
        )}
        {t.alarpJustification && (
          <div className="rep-rat rep-rat--alarp">
            <span className="rep-rat__lbl">ALARP</span>
            {t.alarpJustification}
          </div>
        )}
      </div>

      {t.complianceTags.length > 0 && (
        <div className="rep-threat__tags">
          <span className="rep-kicker">Compliance</span>
          {t.complianceTags.map((tag) => (
            <EnumPill key={tag} tone="info">
              {COMPLIANCE_LABEL[tag] ?? tag}
            </EnumPill>
          ))}
        </div>
      )}

      {showPlans && plans.length > 0 && (
        <div className="rep-plans">
          <div className="rep-kicker">Action plans · {plans.length}</div>
          <table className="rep-tbl rep-tbl--plans">
            <thead>
              <tr>
                <th>Action required</th>
                <th>Owner</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>{p.actionRequired}</td>
                  <td className="rep-mono">{p.responsiblePerson ?? '–'}</td>
                  <td className="rep-mono">
                    {p.targetDate ? p.targetDate.toISOString().slice(0, 10) : '–'}
                  </td>
                  <td>
                    <EnumPill tone={statusTone(p.status)}>{p.status}</EnumPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
