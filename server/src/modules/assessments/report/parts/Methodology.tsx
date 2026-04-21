import * as React from 'react';

export function Methodology() {
  return (
    <div className="rep-meth">
      <div className="rep-meth__block">
        <h3 className="rep-h3">3-A threat model</h3>
        <p>
          The CSMP doctrine decomposes every threat scenario into three axes — <b>Adversary</b> (who),{' '}
          <b>Action</b> (how), <b>Asset</b> (target). Optional Design Basis Threat (DBT) references ground each
          scenario in intelligence-led capability/intent baselines.
        </p>
      </div>
      <div className="rep-meth__block">
        <h3 className="rep-h3">IRV &amp; Priority matrices</h3>
        <p>
          The Inherent Risk Value is derived from a 5×5 Likelihood × Impact matrix and banded into five
          categories (Negligible → Extreme). Treatment priority is a 5×4 derivation factoring vulnerability
          weighting. Both matrices are risk-engine deterministic; scores are not rounded in storage.
        </p>
      </div>
      <div className="rep-meth__block">
        <h3 className="rep-h3">TEAR treatment strategies</h3>
        <ul className="rep-ul">
          <li>
            <b>Transfer</b> — shift risk to a third party (insurance, outsourcing, shared liability).
          </li>
          <li>
            <b>Eliminate</b> — remove the asset, process, or exposure pathway.
          </li>
          <li>
            <b>Accept</b> — document residual risk as ALARP and retain with authority sign-off.
          </li>
          <li>
            <b>Reduce</b> — apply SHAPE × PPS countermeasures to lower likelihood, impact, or vulnerability.
          </li>
        </ul>
      </div>
      <div className="rep-meth__block">
        <h3 className="rep-h3">SHAPE × PPS countermeasure lattice</h3>
        <p>
          Controls are mapped across a 5 × 7 lattice: Security-Programme · Human · Architectural · Procedural
          · Equipment by Deter / Detect / Delay / Deny / Disrupt / Defeat / Recover. Depth-in-defence requires
          coverage across at least three SHAPE layers per EXTREME-band threat.
        </p>
      </div>
    </div>
  );
}

const GLOSSARY: readonly (readonly [string, string])[] = [
  ['3-A', 'Adversary × Action × Asset — the threat-scenario factoring used throughout CSMP.'],
  ['ALARP', 'As Low As Reasonably Practicable — the demonstrable-benefit/cost threshold for residual risk acceptance.'],
  ['DBT', 'Design Basis Threat — intelligence-led baseline of adversary capability and intent.'],
  ['IRV', 'Inherent Risk Value — 5-band score produced by the 5×5 likelihood × impact matrix.'],
  ['SHAPE', 'Security-programme · Human · Architectural · Procedural · Equipment — the countermeasure axis.'],
  ['PPS', 'Physical Protection System — Deter / Detect / Delay / Deny / Disrupt / Defeat / Recover.'],
  ['TEAR', 'Transfer / Eliminate / Accept / Reduce — the four treatment strategies.'],
  ['IN_REVIEW', 'Workflow state: assessment has been submitted and is awaiting reviewer decision.'],
  ['CASCADE_DOWN', 'Cluster status-propagation policy: child asset inherits parent assessment scope.'],
  ['NIS2', 'EU Directive (EU) 2022/2555 on a high common level of cybersecurity across the Union.'],
  ['CER', 'EU Directive (EU) 2022/2557 on the resilience of critical entities.'],
];

export function Glossary() {
  return (
    <dl className="rep-glossary">
      {GLOSSARY.map(([t, d]) => (
        <React.Fragment key={t}>
          <dt className="rep-mono">{t}</dt>
          <dd>{d}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
