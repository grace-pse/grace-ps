import { useState, useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertTriangle,
  ListTodo,
  Boxes,
  Shield,
  ShieldCheck,
  FileText,
  History,
  Users,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Network,
  GitBranch,
  Package,
  MapPin,
  LogOut,
  Inbox,
  ListTree,
} from 'lucide-react';

import { Avatar } from '../hifi/Avatar';
import { useAuthStore } from '../../stores/auth';
import { hasPermission } from '../../lib/permissions';
import type { Permission } from '../../lib/permissions';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
  requires?: Permission;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/assessments', label: 'Assessments', icon: ClipboardCheck },
      { to: '/surveys', label: 'Surveys', icon: ClipboardCheck, requires: 'surveys:read' },
      { to: '/surveys/mine', label: 'My surveys', icon: Inbox, requires: 'surveys:read' },
      { to: '/incidents', label: 'Incidents', icon: AlertTriangle, disabled: true },
      { to: '/tasks', label: 'Action plans', icon: ListTodo, disabled: true },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/assets', label: 'Assets', icon: Boxes },
      { to: '/assets/tree', label: 'Asset tree', icon: ListTree },
      { to: '/relationships', label: 'Relationships', icon: GitBranch },
      { to: '/site-map', label: 'Site map', icon: MapPin },
      { to: '/clusters', label: 'Clusters', icon: Network },
      { to: '/threats', label: 'Threats', icon: Shield },
      { to: '/countermeasures', label: 'Countermeasures', icon: ShieldCheck },
      { to: '/templates', label: 'Template library', icon: Package },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/review', label: 'Review queue', icon: ClipboardCheck, requires: 'assessments:review' },
      { to: '/reports', label: 'Reports', icon: FileText, disabled: true },
      { to: '/audit', label: 'Audit log', icon: History, disabled: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users, disabled: true, requires: 'users:manage' },
      { to: '/admin/sites', label: 'Sites', icon: Building2, disabled: true, requires: 'users:manage' },
      { to: '/admin/templates', label: 'Templates', icon: Package, requires: 'templates:manage' },
      { to: '/admin/survey-templates', label: 'Survey templates', icon: ClipboardCheck, requires: 'surveys:admin' },
      { to: '/admin/survey-config', label: 'Survey config', icon: Settings, requires: 'surveys:admin' },
      { to: '/admin/settings', label: 'Settings', icon: Settings, requires: 'org:manage' },
    ],
  },
];

const LS_KEY = 'csmp-sidebar-collapsed';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(LS_KEY) === '1',
  );
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    if (!window.confirm('Sign out of CSMP Risk Manager?')) return;
    logout();
    window.location.href = '/login';
  }

  useEffect(() => {
    localStorage.setItem(LS_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <aside
      className={[
        'h-full bg-white border-r border-n-150 flex flex-col transition-[width] duration-[180ms]',
        collapsed ? 'w-14' : 'w-[220px]',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 p-3 border-b border-n-150">
        <div
          className="w-[22px] h-[22px] rounded-[4px] shrink-0"
          style={{
            background: 'linear-gradient(135deg, #4f56e5 0%, #3436a4 100%)',
          }}
        />
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold tracking-[-0.15px] text-n-900 truncate">
              CSMP Risk Manager
            </div>
            <div className="text-[10px] font-mono text-n-500 tracking-[0.4px]">
              v2 · PHASE 0
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.requires || hasPermission(user?.role, item.requires),
          );
          if (visibleItems.length === 0) return null;
          return (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <div className="px-4 mb-1 text-[10px] font-mono uppercase text-n-500 tracking-[0.4px]">
                {group.label}
              </div>
            )}
            {visibleItems.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              const cls = [
                'flex items-center gap-2.5 h-8 px-3 mx-1.5 rounded-r2 text-[12.5px]',
                active && !item.disabled
                  ? 'bg-a-50 text-a-700 font-medium border-l-2 border-l-a-500 pl-[10px]'
                  : '',
                item.disabled
                  ? 'text-n-400 cursor-not-allowed'
                  : !active
                  ? 'text-n-700 hover:bg-n-75'
                  : '',
                collapsed ? 'justify-center px-0' : '',
              ]
                .filter(Boolean)
                .join(' ');

              const content = (
                <>
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.disabled && (
                    <span className="ml-auto text-[9px] font-mono uppercase text-n-400">
                      soon
                    </span>
                  )}
                </>
              );

              if (item.disabled) {
                return (
                  <span
                    key={item.to}
                    className={cls}
                    title={collapsed ? `${item.label} — coming soon` : 'Coming soon'}
                  >
                    {content}
                  </span>
                );
              }

              return (
                <Link key={item.to} to={item.to} className={cls}>
                  {content}
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>

      <div
        className={[
          'border-t border-n-150 p-2 flex gap-2',
          collapsed ? 'flex-col items-center' : 'items-center',
        ].join(' ')}
      >
        {user ? (
          <>
            <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-medium text-n-800 truncate">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-[10px] font-mono text-n-500 tracking-[0.4px]">
                  {user.role}
                </div>
              </div>
            )}
          </>
        ) : (
          !collapsed && <div className="text-[11px] text-n-400">Not signed in</div>
        )}
        {user && (
          <button
            type="button"
            onClick={handleLogout}
            className={[
              'w-6 h-6 flex items-center justify-center text-n-500 hover:bg-bad-bg hover:text-bad rounded-r1',
              collapsed ? '' : 'ml-auto',
            ].join(' ')}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={[
            'w-6 h-6 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1',
            !collapsed && !user ? 'ml-auto' : '',
          ].join(' ')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  );
}
