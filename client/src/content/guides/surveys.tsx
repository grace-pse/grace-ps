import type { Guide } from './types';

export const surveysGuide: Guide = {
  id: 'surveys',
  title: 'Surveys',
  subtitle: 'Field evidence that feeds into vulnerability scoring',
  steps: [
    {
      title: 'Why surveys exist',
      body: (
        <>
          <p>
            An assessment can be scored from expert judgement alone, but
            it's stronger when it's anchored to fresh field evidence. A
            survey is a structured questionnaire conducted on a specific
            cluster — a walkdown checklist, a tech audit, a document
            review.
          </p>
          <p>
            Each survey produces a score and a vulnerability rating
            (Strong / Baseline / Barely adequate / Inadequate) that can be
            linked to one or more assessments.
          </p>
        </>
      ),
    },
    {
      title: 'Templates and types',
      body: (
        <>
          <p>Surveys come in five flavours:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Physical</strong> — walk-the-site checklist.
            </li>
            <li>
              <strong>Remote tech</strong> — desk-based tech audit.
            </li>
            <li>
              <strong>Doc review</strong> — paperwork only.
            </li>
            <li>
              <strong>Hybrid</strong> — combines the above.
            </li>
            <li>
              <strong>Custom</strong> — your own template.
            </li>
          </ul>
          <p>
            Templates live under Admin → Survey templates. They define the
            questions, weights, and severity mapping.
          </p>
        </>
      ),
    },
    {
      title: 'The lifecycle',
      body: (
        <p>
          A survey is created against a cluster, completed (often offline
          on a phone), submitted, and approved. Approved surveys can be
          linked into an assessment so Step 6 (Vulnerability) reflects
          actual evidence rather than a guess. "My surveys" shows the ones
          assigned to you.
        </p>
      ),
    },
  ],
};
