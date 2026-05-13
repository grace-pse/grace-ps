import { Link } from '@tanstack/react-router';
import { ShieldCheck, Hexagon, GitBranch, AlertTriangle, Anchor, type LucideIcon } from 'lucide-react';
import { Card } from '../../components/hifi/Card';

interface Tile {
  to: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
}

const TILES: Tile[] = [
  {
    to: '/admin/settings/appearance/asset-roles',
    title: 'Asset roles',
    blurb: 'Border, icon and chip color for PROTECTED · PROTECTIVE · DUAL roles in the relationships graph.',
    icon: ShieldCheck,
  },
  {
    to: '/admin/settings/appearance/asset-types',
    title: 'Asset types',
    blurb: 'Color, abbreviation and icon for the 13 asset types — applied to nodes in the relationships graph.',
    icon: Hexagon,
  },
  {
    to: '/admin/settings/appearance/edges',
    title: 'Edge styles',
    blurb: 'Stroke color, width, dash pattern and label visibility per relationship type (8 total).',
    icon: GitBranch,
  },
  {
    to: '/admin/settings/appearance/node-ports',
    title: 'Node ports',
    blurb: 'Size, shape, color, border and disabled opacity for the four connection ports on every node in the graph.',
    icon: Anchor,
  },
  {
    to: '/admin/settings/appearance/risk-levels',
    title: 'Risk levels',
    blurb: 'Background and ink color per risk level — affects relationships graph node tints and the site map markers.',
    icon: AlertTriangle,
  },
];

export function AppearanceIndexPage() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-[16px] font-semibold text-n-900">Appearance</h2>
      <p className="text-[12.5px] text-n-600 mt-1 mb-4">
        Customize how nodes and edges render in the relationships graph and on the site map.
        Changes apply organization-wide and persist for everyone in your workspace.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.to} to={tile.to} className="block">
              <Card className="p-4 hover:shadow-sh2 transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-r2 bg-a-50 text-a-700 grid place-items-center shrink-0">
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold text-n-900">{tile.title}</div>
                    <div className="text-[11.5px] text-n-600 mt-0.5">{tile.blurb}</div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
