import { Suspense } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { OfflineBanner } from './OfflineBanner';
import { InstallAppToast } from './InstallAppToast';
import { NotificationBell } from './NotificationBell';
import { GuideOverlay } from '../guide/GuideOverlay';
import { GuideTrigger } from '../guide/GuideTrigger';
import { FirstVisitGate } from '../guide/FirstVisitGate';
import { isSandbox } from '../../lib/sandbox';
import { DemoBanner } from '../sandbox/DemoBanner';
import { FeedbackTrigger } from '../sandbox/FeedbackTrigger';
import { FeedbackModal } from '../sandbox/FeedbackModal';
import { RoleSwitcher } from '../sandbox/RoleSwitcher';
import { AssetDetailDrawer } from '../AssetDetailDrawer';

export function ShellLayout() {
  const sandbox = isSandbox();
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {sandbox ? <DemoBanner /> : null}
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-n-50 relative">
          <div className="absolute top-3 right-4 z-40 flex items-center gap-1">
            {sandbox ? <RoleSwitcher /> : null}
            {sandbox ? <FeedbackTrigger /> : null}
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
      {sandbox ? <FeedbackModal /> : null}
      <AssetDetailDrawer />
    </div>
  );
}
