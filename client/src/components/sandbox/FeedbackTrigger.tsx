import { MessageSquarePlus } from 'lucide-react';
import { useFeedbackStore } from '../../stores/feedback';

export function FeedbackTrigger() {
  const open = useFeedbackStore((s) => s.open);
  return (
    <button
      type="button"
      onClick={open}
      title="Send feedback"
      aria-label="Send feedback"
      className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
    >
      <MessageSquarePlus className="w-4 h-4" />
    </button>
  );
}
