import { Link, useLocation } from '@tanstack/react-router';
import { Network, LayoutGrid } from 'lucide-react';

// Segmented control for the /relationships pages. The graph is the
// canonical view; the matrix is a parallel lens optimised for spotting
// uncovered protected assets at a glance. Active tab is driven by URL
// pathname so back/forward buttons just work.

interface Tab {
  to: string;
  label: string;
  icon: React.ReactNode;
  title: string;
}

const TABS: Tab[] = [
  {
    to: '/relationships',
    label: 'Graph',
    icon: <Network size={12} />,
    title: 'Node-link diagram with nesting and coverage edges',
  },
  {
    to: '/relationships/matrix',
    label: 'Matrix',
    icon: <LayoutGrid size={12} />,
    title: 'Coverage matrix — which protective assets cover which protected assets',
  },
];

export function RelationshipsTabBar() {
  const location = useLocation();
  const path = location.pathname;
  return (
    <div className="border-b border-n-150 bg-white px-6 py-1.5 csmp-no-export">
      <div className="inline-flex items-center rounded-r1 border border-n-200 bg-white overflow-hidden">
        {TABS.map((t, i) => {
          const active = path === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              title={t.title}
              className={[
                'inline-flex items-center gap-1.5 h-7 px-3 text-[11.5px] font-medium transition-colors',
                active ? 'bg-a-50 text-a-800' : 'text-n-600 hover:bg-n-50',
                i > 0 ? 'border-l border-n-200' : '',
              ].join(' ')}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
