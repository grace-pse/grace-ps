import type { ReactNode } from 'react';

export interface GuideStep {
  title: string;
  body: ReactNode;
}

export interface Guide {
  id: string;
  title: string;
  subtitle?: string;
  steps: GuideStep[];
}

// Maps the current pathname to a guide id. Subroutes inherit the parent
// guide so e.g. /assessments/$id and /surveys/$id reuse the conceptual
// page guide. Unknown / settings routes return null so the trigger
// button hides itself.
export function routeToGuideId(pathname: string): string | null {
  if (pathname === '/' || pathname === '') return 'dashboard';
  if (pathname.startsWith('/assets')) return 'assets';
  if (pathname.startsWith('/clusters')) return 'clusters';
  if (pathname.startsWith('/relationships')) return 'relationships';
  if (pathname.startsWith('/site-map')) return 'site-map';
  if (pathname.startsWith('/assessments')) return 'assessments';
  if (pathname.startsWith('/surveys')) return 'surveys';
  if (pathname.startsWith('/countermeasures')) return 'countermeasures';
  if (pathname.startsWith('/templates')) return 'templates';
  if (pathname.startsWith('/review')) return 'review';
  return null;
}

// Guide id auto-opened once on first app load, before any per-page guide.
export const WELCOME_GUIDE_ID = 'welcome';
