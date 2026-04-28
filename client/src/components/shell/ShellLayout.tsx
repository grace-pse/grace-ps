import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { OfflineBanner } from './OfflineBanner';
import { InstallAppToast } from './InstallAppToast';
import { NotificationBell } from './NotificationBell';

export function ShellLayout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-n-50 relative">
          <div className="absolute top-3 right-4 z-40">
            <NotificationBell />
          </div>
          <Outlet />
        </main>
      </div>
      <InstallAppToast />
    </div>
  );
}
