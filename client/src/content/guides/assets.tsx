import type { Guide } from './types';
import {
  ASSET_ROLE_LABEL,
  ASSET_ROLE_DESCRIPTION,
  type AssetRole,
} from '../../lib/csmp-types';

const ROLE_ORDER: AssetRole[] = ['PROTECTED', 'PROTECTIVE', 'DUAL'];

// Two-column row showing what each role means in the engine vs. how
// it shows up on the relationships graph. Keeps the ASSET_ROLE_*
// constants as the source of truth for the prose half.
function RoleMatrix() {
  const visualHint: Record<AssetRole, string> = {
    PROTECTED: 'Target of threats. Enters clusters. Drawn with the standard node fill.',
    PROTECTIVE: 'Excluded from clusters. Drawn distinctly so it reads as a control, not a target.',
    DUAL: 'Both — appears in clusters as a target, and its protective edges still surface in coverage.',
  };
  return (
    <div className="border border-n-150 rounded-r2 overflow-hidden text-[12px]">
      <div className="grid grid-cols-[110px_1fr] bg-n-50 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.4px] text-n-500">
        <div>Role</div>
        <div>What changes</div>
      </div>
      {ROLE_ORDER.map((r) => (
        <div
          key={r}
          className="grid grid-cols-[110px_1fr] px-3 py-2 border-t border-n-100"
        >
          <div className="font-semibold text-n-800">{ASSET_ROLE_LABEL[r]}</div>
          <div className="text-n-600">
            <div>{ASSET_ROLE_DESCRIPTION[r]}</div>
            <div className="text-n-500 mt-1 text-[11.5px]">
              <em>In the graph:</em> {visualHint[r]}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export const assetsGuide: Guide = {
  id: 'assets',
  title: 'Assets',
  subtitle: 'The inventory of what you protect — and what protects it',
  steps: [
    {
      title: 'Why the asset register matters',
      body: (
        <>
          <p>
            Everything downstream — clusters, threats, scoring,
            countermeasure coverage — refers back to assets by id. A
            careful inventory is the single biggest force-multiplier in the
            methodology.
          </p>
          <p>
            You don't need to be exhaustive on day one. Start with
            high-criticality items and the ones you actually intend to
            assess soon.
          </p>
        </>
      ),
    },
    {
      title: 'Asset roles — Protected, Protective, Dual',
      body: (
        <>
          <p>
            The single most consequential field on an asset. Role decides
            whether the engine treats this asset as a <strong>target</strong>{' '}
            of threats, a <strong>defender</strong> of other assets, or
            both — and it changes how the asset behaves in clusters,
            assessments, and the relationship graph.
          </p>
          <RoleMatrix />
          <p>
            Quick sanity check: a server room is{' '}
            <strong>Protected</strong>. The CCTV camera in it is{' '}
            <strong>Protective</strong>. A safe is usually{' '}
            <strong>Dual</strong> — someone wants the contents (target),
            and it protects the documents inside.
          </p>
          <p>
            Get the role right at creation time. Changing it later
            invalidates the asset's place in any cluster that already
            references it.
          </p>
        </>
      ),
    },
    {
      title: 'Type, category, criticality',
      body: (
        <>
          <p>
            <strong>Type</strong> is the physical / logical category (Site,
            Building, Equipment, Person, Information…). It controls which
            threat templates are suggested and how the asset can nest under
            a parent.
          </p>
          <p>
            <strong>Category</strong> is Tangible vs Intangible — used by
            reporting and some compliance tags.
          </p>
          <p>
            <strong>Criticality</strong> is your baseline 1–5 importance
            score. It feeds cluster-level criticality and is the default
            weight when nothing more specific is set.
          </p>
        </>
      ),
    },
    {
      title: 'Templates and parent / child',
      body: (
        <>
          <p>
            <strong>From template</strong> creates an asset prefilled from
            the Template Library — and crucially keeps a link back to the
            template. That link is what powers the "Recommended threats for
            this asset" panel later in the assessment wizard.
          </p>
          <p>
            <strong>Parent</strong> creates a topology: a Building inside a
            Site, a Room inside a Floor. Many things cascade through this
            hierarchy (cluster propagation, implicit protective coverage),
            so model it the way the place is actually arranged. On the{' '}
            <em>Relationships</em> page, parent / child is what the top
            (spatial) ports of every node draw.
          </p>
        </>
      ),
    },
  ],
};
