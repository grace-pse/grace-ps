import { Suspense } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { OfflineBanner } from './OfflineBanner';
import { InstallAppToast } from './InstallAppToast';
import { NotificationBell } from './NotificationBell';
import { GuideOverlay } from '../guide/GuideOverlay';
import { GuideTrigger } from '../guide/GuideTrigger';
import { FirstVisitGate } from '../guide/FirstVisitGate';
import { AssetDetailDrawer } from '../AssetDetailDrawer';
import { MobileNotSupportedOverlay } from './MobileNotSupportedOverlay';

export function ShellLayout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-n-50 relative">
          <div className="absolute top-3 right-4 z-40 flex items-center gap-1">
            <GuideTrigger />
            <NotificationBell />
          </div>
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-[12.5px] text-n-500">
                Loading…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      <InstallAppToast />
      <FirstVisitGate />
      <GuideOverlay />
      <AssetDetailDrawer />
      <MobileNotSupportedOverlay />
    </div>
  );
}
