import type { Guide } from './types';

export const templatesGuide: Guide = {
  id: 'templates',
  title: 'Template library',
  subtitle: 'Pre-built assets, threats, and countermeasures',
  steps: [
    {
      title: "Why it's there",
      body: (
        <p>
          The Template Library is a curated set of asset templates,
          threat templates, and countermeasure templates organized into
          packages and modules. It's the fast path from empty install to
          a populated, defensible inventory — and it's also where Design
          Basis Threat (DBT) sets live.
        </p>
      ),
    },
    {
      title: 'Packages and modules',
      body: (
        <>
          <p>
            A <strong>package</strong> is a domain bundle — typically
            industry-specific, like "Banking & Finance" or a general
            baseline. A package contains <strong>modules</strong> (e.g.
            "ATM", "Branch", "Data Centre"). Modules contain the actual
            asset / threat / countermeasure templates plus the cross-links
            between them.
          </p>
          <p>
            Those cross-links are what power "Recommended threats for this
            asset" in Step 2 of an assessment, and "Recommended
            countermeasures for this threat" in Step 7.
          </p>
        </>
      ),
    },
    {
      title: 'Using a template',
      body: (
        <>
          <p>
            From any template you can <strong>create</strong> an asset /
            threat / countermeasure prefilled with sensible defaults. The
            new instance keeps a link back to its source template so the
            recommendation engine can do its job.
          </p>
          <p>
            Admins can import additional packages as JSON bundles via
            Admin → Templates.
          </p>
        </>
      ),
    },
  ],
};
