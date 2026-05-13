import type { Guide } from './types';
import { STEP_LABELS, STEP_KICKERS, TEAR_LABEL, TEAR_BLURB, VULN_LABEL } from '../../lib/risk-ui';
import type { TearStrategy, VulnerabilityRating } from '../../lib/csmp-types';

const TEAR_ORDER: TearStrategy[] = ['REDUCE', 'TRANSFER', 'ACCEPT', 'ELIMINATE'];
const VULN_ORDER: VulnerabilityRating[] = ['STRONG', 'BASELINE', 'BARELY_ADEQUATE', 'INADEQUATE'];

export const assessmentsGuide: Guide = {
  id: 'assessments',
  title: 'Assessments',
  subtitle: 'The 7-step risk assessment wizard',
  steps: [
    {
      title: 'Scope first, then everything else',
      body: (
        <>
          <p>
            An assessment is a snapshot of risk for a defined scope at a
            point in time. Decide the scope first — a single asset, or a
            cluster — because every other step is anchored to it.
          </p>
          <p>
            Saves are autosaved as you move through the wizard, and a
            snapshot is captured on each step transition. You can reopen
            any past assessment at the step you left off.
          </p>
        </>
      ),
    },
    {
      title: 'The seven steps',
      body: (
        <>
          <p>The wizard always runs in this order:</p>
          <ol className="space-y-1.5">
            {STEP_LABELS.map((label, i) => (
              <li key={label} className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-n-500 tabular-nums w-5 shrink-0">
                  {i + 1}.
                </span>
                <div>
                  <span className="font-semibold text-n-800">{label}</span>{' '}
                  <span className="text-n-500 text-[12px]">
                    — {STEP_KICKERS[i]}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </>
      ),
    },
    {
      title: 'Steps 1–2 — Scope and Threats',
      body: (
        <>
          <p>
            <strong>Step 1 (Scope).</strong> Confirm the assets in scope
            and their parent / cluster context. CASCADE_DOWN clusters
            automatically pull descendants in.
          </p>
          <p>
            <strong>Step 2 (Threats).</strong> Add 3-A threats: pick a
            target asset, an adversary type, and an action type. Any asset
            created from a template surfaces a "Recommended threats"
            panel — accept the relevant ones to seed the list quickly.
          </p>
        </>
      ),
    },
    {
      title: 'Steps 3–5 — Likelihood, Impact, IRV',
      body: (
        <>
          <p>
            <strong>Step 3 (Likelihood).</strong> Score each threat 1–5.
            Cite evidence — "we've had two near-misses this year" beats
            "feels like a 4".
          </p>
          <p>
            <strong>Step 4 (Impact).</strong> Score across five dimensions:
            people, property, operations, reputation, financial. The
            engine takes the maximum as the composite impact.
          </p>
          <p>
            <strong>Step 5 (IRV).</strong> The first matrix runs:
            Likelihood × Impact → IRV band. Read it. If the result feels
            off, adjust Step 3 or 4 — don't override the matrix.
          </p>
        </>
      ),
    },
    {
      title: 'Step 6 — Vulnerability',
      body: (
        <>
          <p>
            Rate how well your current controls are doing against this
            specific threat. Linked surveys can populate this rating
            automatically.
          </p>
          <ul className="space-y-1">
            {VULN_ORDER.map((v) => (
              <li key={v}>
                <span className="font-semibold text-n-800">
                  {VULN_LABEL[v]}
                </span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      title: 'Step 7 — Treatment (TEAR)',
      body: (
        <>
          <p>
            The second matrix runs: IRV × Vulnerability → Risk Priority.
            Decide a treatment strategy for each threat:
          </p>
          <ul className="space-y-1.5">
            {TEAR_ORDER.map((t) => (
              <li key={t}>
                <span className="font-semibold text-n-800">
                  {TEAR_LABEL[t]}
                </span>{' '}
                — <span className="text-n-600">{TEAR_BLURB[t]}</span>
              </li>
            ))}
          </ul>
          <p>
            Choosing <strong>Reduce</strong> is what spawns specific
            countermeasures and dated action plan items. Choosing{' '}
            <strong>Accept</strong> requires an ALARP justification —
            that's the audit trail that says "we knew, and here's why
            it's tolerable".
          </p>
        </>
      ),
    },
    {
      title: 'After the wizard',
      body: (
        <p>
          A finished assessment shows an executive summary: posture
          counts, IRV / priority distributions, top threats, action plan
          status, and recommendations. From there it goes into the Review
          queue for sign-off.
        </p>
      ),
    },
  ],
};
