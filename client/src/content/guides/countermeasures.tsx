import type { Guide } from './types';
import {
  SHAPE_CATEGORIES,
  SHAPE_CATEGORY_LABEL,
  PPS_FUNCTIONS,
} from '../../lib/csmp-types';

export const countermeasuresGuide: Guide = {
  id: 'countermeasures',
  title: 'Countermeasures',
  subtitle: 'The controls catalogue, organized SHAPE × PPS',
  steps: [
    {
      title: 'What a countermeasure is',
      body: (
        <p>
          A countermeasure is a control you've deployed (or plan to
          deploy) to lower likelihood, impact, or vulnerability of one or
          more threats. Together they form your protection posture, and
          they're what "Reduce" treatments in an assessment commit you to.
        </p>
      ),
    },
    {
      title: 'SHAPE — what kind of control',
      body: (
        <>
          <p>
            Every control belongs to one of five SHAPE categories:
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {SHAPE_CATEGORIES.map((c) => (
              <li key={c}>
                <span className="font-semibold text-n-800">
                  {SHAPE_CATEGORY_LABEL[c]}
                </span>
              </li>
            ))}
          </ul>
          <p>
            SHAPE forces a balanced posture — relying only on Equipment
            (cameras, locks) without Procedural and Human controls is a
            classic single-point-of-failure pattern.
          </p>
        </>
      ),
    },
    {
      title: 'PPS — what the control does',
      body: (
        <>
          <p>
            Independent of category, every control performs one or more
            PPS functions:
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {PPS_FUNCTIONS.map((f) => (
              <li key={f}>
                <span className="font-semibold text-n-800">{f}</span>
              </li>
            ))}
          </ul>
          <p>
            A useful sanity check on a high-criticality asset: do you have
            something covering Detect, Delay, and Respond? Gaps here are
            usually the cheapest risk to close.
          </p>
        </>
      ),
    },
    {
      title: 'Effectiveness, cost, status',
      body: (
        <p>
          Each control carries a current effectiveness rating (the same
          Strong / Baseline / Barely adequate / Inadequate scale used in
          assessments), a typical cost, and an implementation status. That
          metadata is what lets the executive summary show
          coverage-vs-spend and prioritise the next investment.
        </p>
      ),
    },
  ],
};
