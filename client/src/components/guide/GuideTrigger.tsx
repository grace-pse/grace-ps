import { useLocation } from '@tanstack/react-router';
import { HelpCircle } from 'lucide-react';
import { useGuideStore } from '../../stores/guide';
import { routeToGuideId } from '../../content/guides/types';
import { GUIDES } from '../../content/guides';

export function GuideTrigger() {
  const location = useLocation();
  const open = useGuideStore((s) => s.open);

  const guideId = routeToGuideId(location.pathname);
  if (!guideId || !GUIDES[guideId]) return null;

  const guide = GUIDES[guideId];

  return (
    <button
      type="button"
      onClick={() => open(guideId)}
      className="w-9 h-9 flex items-center justify-center text-n-600 hover:text-a-600 hover:bg-n-100 rounded-r2 transition-colors"
      aria-label={`Open guide: ${guide.title}`}
      title={`Guide: ${guide.title}`}
    >
      <HelpCircle className="w-[18px] h-[18px]" />
    </button>
  );
}
