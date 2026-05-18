# GRACE Engine — Methodology

GRACE Engine implements a deterministic, repeatable physical-security risk assessment methodology rooted in the **CSMP** (Critical Site Management Programme) doctrine. The point of writing it down precisely is that **two different assessors scoring the same threat against the same asset should arrive at the same Inherent Risk Value** — judgement still goes into the inputs, but the calculation itself is a lookup, not a black box.

This page documents the model. The matrices, terms, and steps below are the source of truth — they're the values implemented in [`server/src/lib/risk-engine.ts`](../../server/src/lib/risk-engine.ts) and rendered in the per-assessment PDF report's Methodology page.

## The 7-step assessment workflow

Every assessment moves through seven sequential steps. Each step's output becomes a constraint on the next.

| Step | Name | Output |
|------|------|--------|
| 1 | **Scope** | Asset(s) or cluster in scope; period; lead assessor |
| 2 | **Threats** | A list of 3-A threats (Adversary × Action × Asset), optionally DBT-referenced |
| 3 | **Likelihood** | Per-threat likelihood score on a 1–5 scale |
| 4 | **Impact** | Per-threat impact across 5 dimensions; composite = max-of-five |
| 5 | **IRV** | Inherent Risk Value — auto-computed band from steps 3 + 4 |
| 6 | **Vulnerability** | Current control strength against each threat (Strong / Baseline / Barely adequate / Inadequate) |
| 7 | **Treatment** | TEAR strategy + action plan + ALARP rationale |

Snapshots are captured at every state transition (PENDING → IN_REVIEW → APPROVED), so the artefact at sign-off is a frozen, audit-ready record of every input and every score that produced the final priorities.

## 3-A threat model

Every threat scenario is decomposed into three independent axes:

| Axis | What it captures | Examples |
|------|------------------|----------|
| **Adversary** | Who would do it | Nation-state actor, organised criminal, insider, opportunist, terrorist |
| **Action** | What they would do | Theft, sabotage, intrusion, fraud, espionage, denial-of-service |
| **Asset** | What they target | One of your registered assets (Site → Building → Floor → Room → Equipment) |

The factoring is the point: naming a threat as `INSIDER → ESPIONAGE → Customer Database` keeps assessors honest. Two assessors can't accidentally score "vandalism" as different things, because the threat is anchored to a specific (adversary, action, asset) triple.

Optional **Design Basis Threat (DBT)** references attach intelligence-led capability and intent baselines to a threat, so the likelihood/impact scoring sits on top of evidence rather than vibes.

## Risk calculation — two matrices, no magic

GRACE's risk engine is two lookup tables. Both are deterministic, defined in the source as the canonical implementation:

### Matrix 1 — Inherent Risk Value (IRV)

A 5×5 grid of **Likelihood × Impact**. Rows are likelihood (1 = rare, 5 = near-certain), columns are composite impact (1 = negligible, 5 = catastrophic).

| L \\ I | **1 — Negligible** | **2 — Minor** | **3 — Moderate** | **4 — Major** | **5 — Catastrophic** |
|---|---|---|---|---|---|
| **5 — Almost certain** | Low | Moderate | High | Extreme | Extreme |
| **4 — Likely** | Low | Moderate | High | High | Extreme |
| **3 — Possible** | Negligible | Low | Moderate | High | High |
| **2 — Unlikely** | Negligible | Low | Low | Moderate | High |
| **1 — Rare** | Negligible | Negligible | Low | Low | Moderate |

The output bands into five categories: **Negligible / Low / Moderate / High / Extreme**.

### Matrix 2 — Treatment Priority

A 5×4 grid of **IRV × Vulnerability**. Rows are the IRV band from Matrix 1, columns are the current control posture against the threat.

| IRV \\ Vulnerability | **Strong** | **Baseline** | **Barely adequate** | **Inadequate** |
|---|---|---|---|---|
| **Extreme** | Medium | High | Highest | Highest |
| **High** | Low | Medium | High | Highest |
| **Moderate** | Low | Low | Medium | High |
| **Low** | Low | Low | Low | Medium |
| **Negligible** | Low | Low | Low | Low |

The output is the **Risk Priority** you sort and act on: **Low / Medium / High / Highest**. Inherently extreme threats with strong existing controls drop to Medium; inherently low threats with inadequate controls still climb to Medium. The matrix encodes the principle that treatment priority should reflect *current* exposure, not just inherent danger.

## Impact: five dimensions, max-of-five

Step 4 doesn't score impact as a single number — it asks the assessor to rate consequence across five dimensions independently, on the same 1–5 scale:

| Dimension | What it covers |
|---|---|
| **People** | Injury, fatality, harm to staff/visitors/community |
| **Property** | Physical damage, asset loss, replacement cost |
| **Operations** | Downtime, mission disruption, capability loss |
| **Reputation** | Brand damage, customer trust, regulatory scrutiny |
| **Financial** | Direct monetary loss, fines, contractual penalties |

**Composite impact = max(People, Property, Operations, Reputation, Financial).** A threat with `5 / 1 / 1 / 1 / 1` is treated as catastrophic for IRV purposes, because losing a life ≠ losing a piece of property. The max-of-five rule prevents averaging from masking a single severe dimension.

## Vulnerability — the assessor's read of current controls

A 4-band rating of how well existing countermeasures hold against the specific threat:

| Rating | Meaning |
|---|---|
| **Strong** | Multi-layered defence, regularly tested, demonstrably working |
| **Baseline** | Standard controls in place, no recent test/audit findings |
| **Barely adequate** | Controls present but gaps known; survey/audit flagged issues |
| **Inadequate** | Controls missing, broken, or never implemented |

Vulnerability can come from **expert judgement**, from **survey evidence** (a structured walk-through scoring questionnaire), or **mixed**. The assessment surfaces which basis was used so reviewers know what's anchored in evidence vs. what's the assessor's call.

## TEAR — what you do about the risk

Every scored threat is treated with one of four strategies:

| Strategy | When to use |
|---|---|
| **Transfer** | Shift the risk to a third party — insurance, outsourcing, shared liability contracts |
| **Eliminate** | Remove the asset, process, or exposure pathway entirely |
| **Accept** | Tolerate the residual risk; **must** be documented as ALARP with authority sign-off |
| **Reduce** | Apply SHAPE × PPS countermeasures to lower likelihood, impact, or vulnerability |

`Reduce` is the path that connects an assessment to specific countermeasures and dated, owned action plans. Most threats end up here; `Accept` is reserved for cases where reasonable controls can't go further without disproportionate cost (the ALARP principle).

## ALARP — As Low As Reasonably Practicable

For threats treated as `Accept`, GRACE requires an **ALARP justification** in free text. The principle:

> Continue applying countermeasures **until the cost of the next reduction grossly outweighs the marginal risk reduction it would deliver**. Document the threshold and the reasoning.

ALARP isn't "we did the cheap stuff and stopped" — it's a defensible argument that further controls would be disproportionate. The free-text field is captured in the snapshot at sign-off so it's preserved as evidence in audit trails.

## SHAPE × PPS — the countermeasure lattice

Controls are categorised on a 5 × 7 lattice combining what the control *is* with what it *does*.

### SHAPE — the category axis (5)

| Category | Examples |
|---|---|
| **S**ecurity-programme | Policy, governance, risk register cadence |
| **H**uman | Guards, awareness training, vetting, key-person redundancy |
| **A**rchitectural | Fencing, walls, mantrap design, room hardening |
| **P**rocedural | Visitor management, key control, change-management procedures |
| **E**quipment | CCTV, alarms, ACS, locks, sensors, IDS |

### PPS — the function axis (7)

| Function | Effect |
|---|---|
| **Deter** | Discourage attempt before it starts (visible CCTV, lighting, signage) |
| **Detect** | Recognise an in-progress attempt (motion sensors, anomaly alerts) |
| **Delay** | Slow attacker progress to buy response time (locks, fences, mantrap) |
| **Deny** | Block access entirely (vault, sealed perimeter, air-gap) |
| **Disrupt** | Interrupt the attack mid-stream (response teams, lockdown procedures) |
| **Defeat** | End the attack (containment, neutralisation, arrest) |
| **Recover** | Restore operations after the event (backups, redundancy, IR plans) |

### Depth-in-defence rule

For every threat that scores **Extreme** in the IRV matrix, GRACE expects the countermeasure register to show coverage across **at least three SHAPE layers**. A single layer (e.g. Equipment-only) is brittle; depth means a determined adversary has to defeat multiple disjoint controls in series.

## Compliance frameworks supported

Every threat and action plan can be tagged with one or more compliance frameworks. The PDF report's Compliance Coverage page rolls these up into a single matrix:

- **ISO 31000** — Risk management — guidelines
- **NIS2 Art. 21** — Cybersecurity risk-management measures
- **NIS2 Art. 23** — Reporting obligations
- **CER Directive** — EU 2022/2557 — Critical entity resilience
- **ASIS SPC.1** — Resilience: Maturity Model and Continual Improvement
- **ISO 28000** — Security and resilience — Security management systems

Tags are advisory — GRACE doesn't enforce specific control mappings, it just lets you label and report on coverage.

## Glossary

| Term | Definition |
|---|---|
| **3-A** | Adversary × Action × Asset — the threat-scenario factoring used throughout the methodology. |
| **ALARP** | As Low As Reasonably Practicable — the demonstrable-benefit/cost threshold for residual risk acceptance. |
| **CSMP** | Critical Site Management Programme — the originating doctrine GRACE Engine implements. |
| **DBT** | Design Basis Threat — intelligence-led baseline of adversary capability and intent. |
| **IRV** | Inherent Risk Value — 5-band score produced by the 5×5 likelihood × impact matrix. |
| **CASCADE_DOWN** | Cluster status-propagation policy: child asset inherits parent assessment scope. |
| **CER** | EU Directive (EU) 2022/2557 on the resilience of critical entities. |
| **NIS2** | EU Directive (EU) 2022/2555 on a high common level of cybersecurity across the Union. |
| **PPS** | Physical Protection System — Deter / Detect / Delay / Deny / Disrupt / Defeat / Recover. |
| **SHAPE** | Security-programme · Human · Architectural · Procedural · Equipment — the countermeasure category axis. |
| **TEAR** | Transfer / Eliminate / Accept / Reduce — the four treatment strategies. |

## Source-of-truth references

| Concept | Where it lives in the codebase |
|---|---|
| IRV matrix + Priority matrix | [`server/src/lib/risk-engine.ts`](../../server/src/lib/risk-engine.ts) |
| Composite impact (max-of-five) | [`server/src/lib/risk-engine.ts`](../../server/src/lib/risk-engine.ts) — `compositeImpact()` |
| PDF Methodology page | [`server/src/modules/assessments/report/parts/Methodology.tsx`](../../server/src/modules/assessments/report/parts/Methodology.tsx) |
| First-visit onboarding guide | [`client/src/content/guides/welcome.tsx`](../../client/src/content/guides/welcome.tsx) |
| TEAR enum | [`server/src/modules/assessments/schema.ts`](../../server/src/modules/assessments/schema.ts) |
| SHAPE × PPS enums | [`server/src/modules/countermeasures/schema.ts`](../../server/src/modules/countermeasures/schema.ts) |

## Further reading

- ISO 31000:2018 — *Risk management — Guidelines*
- ASIS SPC.1-2009 — *Organizational Resilience: Security, Preparedness, and Continuity Management Systems*
- NIS2 Directive — [EUR-Lex 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555/oj)
- CER Directive — [EUR-Lex 2022/2557](https://eur-lex.europa.eu/eli/dir/2022/2557/oj)
- "Design Basis Threat (DBT)" — IAEA Nuclear Security Series No. 10, 2009, for the canonical formulation of DBT methodology adapted across physical-security domains
