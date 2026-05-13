import type { Guide } from './types';

export const siteMapGuide: Guide = {
  id: 'site-map',
  title: 'Site map',
  subtitle: 'Geographic placement of your assets',
  steps: [
    {
      title: "What's pinned here",
      body: (
        <p>
          Any asset with a stored latitude / longitude appears on the map.
          The pin colour reflects the asset's current criticality so a
          glance tells you where the high-impact items live.
        </p>
      ),
    },
    {
      title: 'Drilling into a site',
      body: (
        <>
          <p>
            Click a pin to open that asset. The Assets page accepts a{' '}
            <code className="text-[11.5px] font-mono bg-n-100 px-1 rounded-r1">
              ?siteId=…
            </code>{' '}
            search param that scopes the list to the pinned asset and
            everything under it in the parent hierarchy. That's how the
            Site Map and Assets page stay coordinated.
          </p>
        </>
      ),
    },
    {
      title: 'How it ties to assessments',
      body: (
        <p>
          A geographic view is mostly an orientation tool — but it's the
          quickest way to spot whether your physical footprint is being
          assessed evenly. Sites with no recent assessment activity stand
          out visually.
        </p>
      ),
    },
  ],
};
