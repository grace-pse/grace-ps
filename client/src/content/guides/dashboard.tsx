import type { Guide } from './types';

export const dashboardGuide: Guide = {
  id: 'dashboard',
  title: 'Dashboard',
  subtitle: 'Where your organization stands right now',
  steps: [
    {
      title: 'What you see here',
      body: (
        <>
          <p>
            The dashboard is a posture snapshot derived from current data.
            Numbers come from your assets, clusters, and most recent
            assessments — no manual entry, no caching.
          </p>
          <p>
            If a tile shows zero, it's because nothing of that kind exists
            yet, not because something is broken.
          </p>
        </>
      ),
    },
    {
      title: 'How to read it',
      body: (
        <>
          <p>
            Tiles are sized by the order you'll usually attend to them:
            unscored or pending items first, sign-off bottlenecks next,
            then the broader posture.
          </p>
          <p>
            Use the dashboard as a triage screen: anything unusual here is
            a candidate for the assessments or review queue.
          </p>
        </>
      ),
    },
    {
      title: 'When numbers update',
      body: (
        <p>
          Counts reflect committed data — saves and submissions update
          immediately. Risk priorities only appear once an assessment has
          progressed through Step 7 (Treatment); earlier-stage assessments
          contribute to "in progress" counts only.
        </p>
      ),
    },
  ],
};
