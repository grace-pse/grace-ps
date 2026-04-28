import { Outlet, Link, useLocation } from '@tanstack/react-router';
import {
  Paintbrush,
  Users as UsersIcon,
  ShieldCheck,
  Building2,
  Info,
  GitBranch,
  Hexagon,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Topbar } from '../shell/Topbar';
import { useAuthStore } from '../../stores/auth';
import { hasPermission, type Permission } from '../../lib/permissions';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  perm: Permission;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: 'Appearance',
    items: [
      { to: '/admin/settings/appearance/asset-roles', label: 'Asset roles',     icon: ShieldCheck,    perm: 'org:manage' },
      { to: '/admin/settings/appearance/asset-types', label: 'Asset types',     icon: Hexagon,        perm: 'org:manage' },
      { to: '/admin/settings/appearance/edges',       label: 'Edge styles',     icon: GitBranch,      perm: 'org:manage' },
      { to: '/admin/settings/appearance/risk-levels', label: 'Risk levels',     icon: AlertTriangle,  perm: 'org:manage' },
    ],
  },
  {
    label: 'Access',
    items: [
      { to: '/admin/settings/users', label: 'Users',             icon: UsersIcon,   perm: 'users:manage' },
      { to: '/admin/settings/roles', label: 'Roles & permissions', icon: ShieldCheck, perm: 'org:manage' },
    ],
  },
  {
    label: 'Organization',
    items: [
      { to: '/admin/settings/organization', label: 'General', icon: Building2, perm: 'org:manage' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/settings/about', label: 'About', icon: Info, perm: 'org:manage' },
    ],
  },
];

export function SettingsLayout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Settings"
        subtitle="Organization-wide configuration"
        breadcrumbs={
          <span>
            Admin <span className="text-n-300 mx-1">/</span> Settings
          </span>
        }
        actions={
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
            <Paintbrush className="w-3 h-3" />
            customizable
          </span>
        }
      />

      <div className="flex-1 grid grid-cols-[220px_1fr] overflow-hidden">
        <aside className="border-r border-n-150 bg-n-50/40 overflow-y-auto py-3">
          {NAV.map((group) => {
            const visible = group.items.filter((it) => hasPermission(user?.role, it.perm));
            if (visible.length === 0) return null;
            return (
              <div key={group.label} className="mb-3">
                <div className="px-4 mb-1 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                  {group.label}
                </div>
                {visible.map((item) => {
                  const active = location.pathname === item.to
                    || (item.to.includes('/appearance/') && location.pathname.startsWith(item.to));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={[
                        'flex items-center gap-2.5 h-8 px-3 mx-1.5 rounded-r2 text-[12.5px]',
                        active
                          ? 'bg-a-50 text-a-700 font-medium border-l-2 border-l-a-500 pl-[10px]'
                          : 'text-n-700 hover:bg-n-75',
                      ].join(' ')}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </aside>
        <main className="overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
