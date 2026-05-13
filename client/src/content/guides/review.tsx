import type { Guide } from './types';

export const reviewGuide: Guide = {
  id: 'review',
  title: 'Review queue',
  subtitle: 'The sign-off pipeline for completed assessments',
  steps: [
    {
      title: 'Why the queue exists',
      body: (
        <p>
          A risk assessment isn't done when the assessor closes the wizard
          — it's done when a reviewer signs it off. The Review queue is
          where assessments land between submission and approval, and
          where the audit trail is built.
        </p>
      ),
    },
    {
      title: 'The five review states',
      body: (
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Pending</strong> — submitted, awaiting a reviewer.
          </li>
          <li>
            <strong>In review</strong> — picked up; reviewer is working
            through it.
          </li>
          <li>
            <strong>Revision requested</strong> — sent back to the
            assessor with notes.
          </li>
          <li>
            <strong>Rejected</strong> — terminated. Rare; usually means
            scope was wrong.
          </li>
          <li>
            <strong>Approved</strong> — signed off. Becomes part of the
            posture record.
          </li>
        </ul>
      ),
    },
    {
      title: 'What approval triggers',
      body: (
        <p>
          On approval, an immutable snapshot is captured — the assessment
          state at sign-off is preserved even if the underlying assets,
          threats, or surveys change later. Action plan items become
          tracked work; their owners and target dates are now commitments,
          not drafts.
        </p>
      ),
    },
  ],
};
