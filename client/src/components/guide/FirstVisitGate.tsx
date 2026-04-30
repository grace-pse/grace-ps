import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useGuideStore } from '../../stores/guide';
import { GUIDES } from '../../content/guides';
import { routeToGuideId, WELCOME_GUIDE_ID } from '../../content/guides/types';

// Watches route changes and auto-opens the appropriate guide on first
// visit. Welcome guide takes precedence on the very first app load,
// then per-page guides take over on subsequent navigations.
//
// Suppressed when a guide is already open so a route-change inside the
// guide modal doesn't immediately replace it with another.
export function FirstVisitGate() {
  const location = useLocation();
  const { isOpen, hasSeen, open } = useGuideStore();

  useEffect(() => {
    if (isOpen) return;

    if (!hasSeen(WELCOME_GUIDE_ID) && GUIDES[WELCOME_GUIDE_ID]) {
      open(WELCOME_GUIDE_ID);
      return;
    }

    const guideId = routeToGuideId(location.pathname);
    if (!guideId) return;
    if (!GUIDES[guideId]) return;
    if (hasSeen(guideId)) return;

    open(guideId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
