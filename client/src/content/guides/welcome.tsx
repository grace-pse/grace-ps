import type { Guide } from './types';

export const welcomeGuide: Guide = {
  id: 'welcome',
  title: 'Welcome to GRACE Engine',
  subtitle: 'Methodology and system orientation in one minute',
  steps: [
    {
      title: 'What GRACE is',
      body: (
        <>
          <p>
            GRACE Engine is a physical-security risk platform built around
            three pillars: a structured <strong>asset model</strong>, a
            <strong> 3-A threat model</strong> (Adversary × Action × Asset),
            and a deterministic <strong>risk engine</strong> that turns
            judgement calls into comparable, defensible risk priorities.
          </p>
          <p>
            This app is the workbench. You build an asset register, run
            scoped assessments through a 7-step wizard, and end up with
            ranked treatments, action plans, and a sign-off trail.
          </p>
        </>
      ),
    },
    {
      title: 'How the pages fit together',
      body: (
        <>
          <p className="font-medium text-n-800">Catalog (what you protect)</p>
          <p>
            <strong>Assets</strong> is your inventory. <strong>Clusters</strong>{' '}
            group assets into spatial / operational / logical units.{' '}
            <strong>Relationships</strong> wire them into a dependency graph.{' '}
            <strong>Site map</strong> places them geographically.{' '}
            <strong>Countermeasures</strong> are the controls that protect
            them.
          </p>
          <p className="font-medium text-n-800 mt-2">Work (what you assess)</p>
          <p>
            <strong>Assessments</strong> are scoped risk reviews driven by
            the 7-step wizard. <strong>Surveys</strong> capture field
            evidence (vulnerability ratings) that link back to assessments.
          </p>
          <p className="font-medium text-n-800 mt-2">Compliance</p>
          <p>
            <strong>Review queue</strong> is the sign-off pipeline.
          </p>
        </>
      ),
    },
    {
      title: 'The 3-A threat model',
      body: (
        <>
          <p>
            Every threat in GRACE is described as three independent dimensions:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Adversary</strong> — who would do it (criminal,
              insider, terrorist, opportunist…).
            </li>
            <li>
              <strong>Action</strong> — what they would do (theft, sabotage,
              intrusion, fraud…).
            </li>
            <li>
              <strong>Asset</strong> — what they target (one of your
              registered assets).
            </li>
          </ul>
          <p>
            Naming threats this way keeps comparisons honest: two assessors
            can't accidentally score "vandalism" as different things.
          </p>
        </>
      ),
    },
    {
      title: 'How risk is calculated',
      body: (
        <>
          <p>
            The engine is two lookup matrices, intentionally — it's a
            consensus tool, not a black box.
          </p>
          <p>
            <strong>Matrix 1 — Inherent Risk Value (IRV).</strong> A 5×5
            grid of <em>Likelihood</em> × <em>Impact</em>. Yields an IRV
            band: Negligible / Low / Moderate / High / Extreme.
          </p>
          <p>
            <strong>Matrix 2 — Treatment Priority.</strong> IRV crossed
            with current <em>Vulnerability</em> (Strong / Baseline / Barely
            adequate / Inadequate). Yields a Risk Priority you can sort and
            act on.
          </p>
          <p>
            Impact itself is the maximum across five dimensions: people,
            property, operations, reputation, financial.
          </p>
        </>
      ),
    },
    {
      title: 'TEAR — what you do about it',
      body: (
        <>
          <p>Each scored threat is treated with one of four strategies:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Transfer</strong> — shift to a third party (insurance,
              outsourcing).
            </li>
            <li>
              <strong>Eliminate</strong> — remove the asset, activity, or
              exposure.
            </li>
            <li>
              <strong>Accept</strong> — tolerate; document ALARP rationale.
            </li>
            <li>
              <strong>Reduce</strong> — apply controls; drives the action
              plan.
            </li>
          </ul>
          <p>
            "Reduce" is the path that connects an assessment to specific
            countermeasures and dated, owned tasks.
          </p>
        </>
      ),
    },
    {
      title: "What's next",
      body: (
        <>
          <p>
            Each page has its own short guide — open it any time with the{' '}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-n-100 rounded-r1 text-[11px] font-mono">
              ?
            </span>{' '}
            button in the top-right corner. The first time you visit a page
            its guide opens automatically; after that it's only on demand.
          </p>
          <p>
            A reasonable starting flow if the system is empty:
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Import or create a few assets.</li>
            <li>Group critical ones into a cluster.</li>
            <li>Start an assessment scoped to that cluster.</li>
            <li>Walk the 7 steps and review the priorities at the end.</li>
          </ol>
        </>
      ),
    },
  ],
};
