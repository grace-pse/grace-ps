import * as React from 'react';
import type { ActionPlan } from '@prisma/client';
import { COMPLIANCE_LABEL, COMPLIANCE_ORDER } from '../constants.js';
import type { ReportThreat } from '../types.js';

function buildRows(threats: ReportThreat[], actionPlans: ActionPlan[]) {
  const total = threats.length;
  return COMPLIANCE_ORDER.map((tag) => {
    const tc = threats.filter((t) => t.complianceTags.includes(tag)).length;
    const pc = actionPlans.filter((p) => p.complianceTags.includes(tag)).length;
    return { tag, tc, pc, pct: total > 0 ? Math.round((tc / total) * 100) : 0 };
  }).filter((r) => r.tc > 0 || r.pc > 0);
}

export function ComplianceMatrix({
  threats,
  actionPlans,
}: {
  threats: ReportThreat[];
  actionPlans: ActionPlan[];
}) {
  const rows = buildRows(threats, actionPlans);
  return (
    <table className="rep-tbl rep-tbl--cmp">
      <thead>
        <tr>
          <th>Framework</th>
          <th className="rep-num">Threats tagged</th>
          <th className="rep-num">Plans tagged</th>
          <th className="rep-num">Coverage</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tag}>
            <td>
              <b>{COMPLIANCE_LABEL[r.tag] ?? r.tag}</b>
            </td>
            <td className="rep-num">{r.tc}</td>
            <td className="rep-num">{r.pc}</td>
            <td className="rep-num">
              <div className="rep-cov">
                <div className="rep-cov__bar" style={{ width: `${r.pct}%` }} />
                <span className="rep-cov__val">{r.pct}%</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ComplianceExecSummary({
  threats,
  actionPlans,
  title = 'Compliance exec summary',
}: {
  threats: ReportThreat[];
  actionPlans: ActionPlan[];
  title?: string;
}) {
  const rows = buildRows(threats, actionPlans);
  return (
    <div className="rep-cmpx">
      <div className="rep-cmpx__ti">
        <h3>{title}</h3>
        <span className="rep-kicker">
          {rows.length} frameworks · {threats.length} threats
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.tag} className="rep-cmpx__row">
          <span className="rep-cmpx__name">{COMPLIANCE_LABEL[r.tag] ?? r.tag}</span>
          <span className="rep-cmpx__num">
            {r.tc}/{r.pc}
          </span>
          <span className="rep-cmpx__bar">
            <span style={{ width: `${r.pct}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
