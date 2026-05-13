import type { Guide } from './types';

export const clustersGuide: Guide = {
  id: 'clusters',
  title: 'Clusters',
  subtitle: 'Group assets so you can assess them together',
  steps: [
    {
      title: 'What a cluster is',
      body: (
        <>
          <p>
            A cluster is a named group of assets you want to evaluate as a
            unit — typically because they share a location, a process, or a
            failure mode. An assessment can be scoped to a single asset or
            to a cluster; clusters are how you do the latter.
          </p>
          <p>
            Clusters never contain Protective assets. Those stay associated
            with the things they protect via relationships, and surface
            during Step 6 (Vulnerability).
          </p>
        </>
      ),
    },
    {
      title: 'The four cluster types',
      body: (
        <>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Operational</strong> — assets that share a business
              process or service.
            </li>
            <li>
              <strong>Spatial</strong> — assets co-located (a building, a
              floor, a campus).
            </li>
            <li>
              <strong>Logical</strong> — assets grouped by data
              classification, ownership, or compliance scope.
            </li>
            <li>
              <strong>Temporal</strong> — assets active in the same time
              window (e.g. an event).
            </li>
          </ul>
          <p>
            The type is descriptive — it's mainly used for filtering and
            reporting. The engine itself looks at criticality and
            propagation.
          </p>
        </>
      ),
    },
    {
      title: 'Criticality mode',
      body: (
        <>
          <p>How the cluster's criticality is computed from its members:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Highest</strong> — the cluster inherits its most
              critical member's score. Conservative; default for "treat the
              group at the level of its weakest link".
            </li>
            <li>
              <strong>Average</strong> — mean across members. Smoother;
              useful for large mixed clusters.
            </li>
            <li>
              <strong>Custom</strong> — you set it explicitly.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: 'Status propagation',
      body: (
        <>
          <p>
            How operational-status changes flow through the parent / child
            hierarchy of assets in this cluster.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>CASCADE_DOWN</strong> — a degraded parent degrades
              its descendants. Every descendant of a member is in scope.
            </li>
            <li>
              <strong>CASCADE_UP</strong> — a degraded child degrades its
              ancestors.
            </li>
            <li>
              <strong>BIDIRECTIONAL</strong> — both directions.
            </li>
            <li>
              <strong>NONE</strong> — explicit members only; no
              inheritance.
            </li>
          </ul>
          <p>
            CASCADE_DOWN is the right default when you want assessments
            scoped to a Building to also cover everything inside it.
          </p>
        </>
      ),
    },
  ],
};
