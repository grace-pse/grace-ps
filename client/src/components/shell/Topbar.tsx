import type { ReactNode } from 'react';

interface TopbarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
}

// Reserve space on the right edge for the floating icon stack rendered by
// ShellLayout (top-3 right-4): GuideTrigger + NotificationBell. Without this
// padding the page-level actions row collides with those icons on wide
// actions like Relationships' Arrange/Export.
const SHELL_ICON_RESERVE = 'pr-[96px]';

export function Topbar({ title, subtitle, breadcrumbs, actions }: TopbarProps) {
  return (
    <header className="border-b border-n-150 bg-white px-6 py-4">
      {breadcrumbs && (
        <div className="text-[11px] font-mono text-n-500 tracking-[0.05px] mb-1">
          {breadcrumbs}
        </div>
      )}
      <div className={`flex items-center justify-between gap-4 ${actions ? SHELL_ICON_RESERVE : ''}`}>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.4px] text-n-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11.5px] text-n-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
    </header>
  );
}
