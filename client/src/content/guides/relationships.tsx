import type { Guide } from './types';
import {
  ASSET_ROLE_LABEL,
  ASSET_ROLE_DESCRIPTION,
  type AssetRole,
} from '../../lib/csmp-types';

const ROLE_ORDER: AssetRole[] = ['PROTECTED', 'PROTECTIVE', 'DUAL'];

// Static SVG diagram of a node with its four ports — used only inside
// the guide. Top-half ports are spatial (parent/child topology), bottom
// half are logical (relationship edges that drive coverage).
function PortDiagram() {
  const dot = (cx: number, cy: number, color: string, dim = false) => (
    <circle cx={cx} cy={cy} r={5} fill={color} opacity={dim ? 0.35 : 1} />
  );
  return (
    <div className="flex justify-center my-2">
      <svg viewBox="0 0 220 130" className="w-[260px] h-[150px]" aria-hidden>
        <rect
          x="40" y="30" width="140" height="70"
          rx="6" fill="#fff" stroke="#9ca3af" strokeWidth="1.5"
        />
        <text x="110" y="62" textAnchor="middle" className="fill-n-800"
              fontSize="11" fontFamily="ui-sans-serif, system-ui">
          An asset
        </text>
        <text x="110" y="80" textAnchor="middle" className="fill-n-500"
              fontSize="9" fontFamily="ui-sans-serif, system-ui">
          (one node)
        </text>
        {/* spatial ports — top */}
        {dot(80, 30, '#6366f1')}
        {dot(140, 30, '#6366f1')}
        {/* logical ports — bottom */}
        {dot(80, 100, '#f97316')}
        {dot(140, 100, '#f97316')}
        {/* labels */}
        <text x="40" y="22" fontSize="9" className="fill-n-500"
              fontFamily="ui-sans-serif, system-ui">
          ● spatial (topology)
        </text>
        <text x="40" y="120" fontSize="9" className="fill-n-500"
              fontFamily="ui-sans-serif, system-ui">
          ● logical (coverage)
        </text>
      </svg>
    </div>
  );
}

export const relationshipsGuide: Guide = {
  id: 'relationships',
  title: 'Relationships',
  subtitle: 'The dependency graph between assets',
  steps: [
    {
      title: 'What this view does',
      body: (
        <>
          <p>
            Two assets can be related in many non-hierarchical ways: one
            depends on another, one protects another, one is adjacent to
            another. This page is where you draw and read those edges.
          </p>
          <p>
            Edges are also where <strong>Protective</strong> assets do
            their job: a CCTV camera <em>protects</em> a server room; an
            access-control system <em>protects</em> a door.
          </p>
        </>
      ),
    },
    {
      title: 'Topology vs Coverage modes',
      body: (
        <>
          <p>
            The toggle at the top switches what the graph shows:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Topology</strong> — physical / logical layout. Parent
              / child plus the relationship edges you've drawn.
            </li>
            <li>
              <strong>Coverage</strong> — which Protective assets cover
              which Protected assets, including <em>implicit</em> coverage
              inferred from the parent hierarchy (a camera inside a room is
              treated as covering things in that room).
            </li>
            <li>
              <strong>Both</strong> — all edges and all ports active at
              once.
            </li>
          </ul>
          <p>
            Coverage is the more useful view when you're about to score
            Vulnerability in an assessment.
          </p>
        </>
      ),
    },
    {
      title: 'The four ports on every node',
      body: (
        <>
          <p>
            Every node exposes four connection points — one pair on top,
            one pair on the bottom. The pair you grab determines what kind
            of edge you draw.
          </p>
          <PortDiagram />
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Top ports — spatial.</strong> Drag from a top port
              to set or change the parent / child topology (the same
              hierarchy that drives CASCADE_DOWN cluster propagation and
              implicit protective coverage).
            </li>
            <li>
              <strong>Bottom ports — logical.</strong> Drag from a bottom
              port to draw a relationship edge (depends on, protects,
              monitors, …) — these are the edges that survive into the
              coverage view.
            </li>
          </ul>
          <p>
            Ports outside the active view-mode are dimmed but not removed.
            Drag from a dimmed port and the graph snaps into the matching
            mode automatically. You can restyle the ports under{' '}
            <em>Settings → Appearance → Node ports</em> if the defaults
            blend into your colour palette.
          </p>
        </>
      ),
    },
    {
      title: 'Asset roles in the graph',
      body: (
        <>
          <p>
            Each node's role determines whether it can be a target of
            threats, a protector of others, or both. Roles are also the
            single biggest visual signal in the graph — change one and
            the whole picture re-reads.
          </p>
          <ul className="space-y-2">
            {ROLE_ORDER.map((r) => (
              <li key={r}>
                <span className="font-semibold text-n-800">
                  {ASSET_ROLE_LABEL[r]}
                </span>{' '}
                — <span className="text-n-600">{ASSET_ROLE_DESCRIPTION[r]}</span>
              </li>
            ))}
          </ul>
          <p>
            Practical consequence: a camera should be <strong>Protective</strong>{' '}
            so the room it covers shows up under that room's coverage view;
            a safe is usually <strong>Dual</strong> because someone wants
            to steal it AND it protects the documents inside.
          </p>
        </>
      ),
    },
    {
      title: 'Why bother modelling edges',
      body: (
        <p>
          Edges drive two things: the suggested vulnerability picture
          surfaced in Step 6 of an assessment, and (where{' '}
          <em>impactPropagation</em> is on) the chain reaction analysis
          when one asset's compromise cascades to its dependents. Edges
          without those two purposes are mostly decorative.
        </p>
      ),
    },
  ],
};
