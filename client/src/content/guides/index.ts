import type { Guide } from './types';
import { welcomeGuide } from './welcome';
import { dashboardGuide } from './dashboard';
import { assetsGuide } from './assets';
import { clustersGuide } from './clusters';
import { relationshipsGuide } from './relationships';
import { siteMapGuide } from './site-map';
import { assessmentsGuide } from './assessments';
import { surveysGuide } from './surveys';
import { countermeasuresGuide } from './countermeasures';
import { templatesGuide } from './templates';
import { reviewGuide } from './review';

export const GUIDES: Record<string, Guide> = {
  [welcomeGuide.id]: welcomeGuide,
  [dashboardGuide.id]: dashboardGuide,
  [assetsGuide.id]: assetsGuide,
  [clustersGuide.id]: clustersGuide,
  [relationshipsGuide.id]: relationshipsGuide,
  [siteMapGuide.id]: siteMapGuide,
  [assessmentsGuide.id]: assessmentsGuide,
  [surveysGuide.id]: surveysGuide,
  [countermeasuresGuide.id]: countermeasuresGuide,
  [templatesGuide.id]: templatesGuide,
  [reviewGuide.id]: reviewGuide,
};
