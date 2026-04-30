import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { useGuideStore } from '../../stores/guide';
import { GUIDES } from '../../content/guides';
import type { Guide } from '../../content/guides/types';

export function GuideOverlay() {
  const { isOpen, currentGuideId, close, markSeen } = useGuideStore();
  const guide = currentGuideId ? GUIDES[currentGuideId] : null;

  if (!isOpen || !guide) return null;

  // The inner dialog owns step state. The `key` ensures state is reset
  // (via remount) whenever the active guide changes, so a tall previous
  // guide can't leave a stale stepIndex that overflows a shorter one.
  return (
    <GuideDialog
      key={guide.id}
      guide={guide}
      onClose={() => {
        markSeen(guide.id);
        close();
      }}
    />
  );
}

interface GuideDialogProps {
  guide: Guide;
  onClose: () => void;
}

function GuideDialog({ guide, onClose }: GuideDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = guide.steps.length;
  const safeIndex = Math.min(Math.max(stepIndex, 0), Math.max(0, total - 1));
  const step = guide.steps[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === total - 1;

  function handleNext() {
    if (isLast) onClose();
    else setStepIndex((i) => i + 1);
  }

  function handlePrev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-n-900/40 z-50"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] bg-white rounded-r3 shadow-sh3 z-50 flex flex-col max-h-[85vh]"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150">
          <div className="min-w-0">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.6px] text-a-600">
              Guide
            </div>
            <h2
              id="guide-dialog-title"
              className="text-[15px] font-semibold text-n-900 truncate"
            >
              {guide.title}
            </h2>
            {guide.subtitle && (
              <p className="text-[11.5px] text-n-500 mt-0.5 truncate">
                {guide.subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 pl-3">
            <span className="text-[11px] font-mono text-n-500 tabular-nums">
              {safeIndex + 1} / {total}
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
              aria-label="Close guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="h-1 bg-n-100">
          <div
            className="h-full bg-a-500 transition-[width] duration-200"
            style={{ width: `${((safeIndex + 1) / total) * 100}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="text-[16px] font-semibold text-n-900 mb-3">
            {step.title}
          </h3>
          <div className="text-[13px] leading-[1.55] text-n-700 space-y-3">
            {step.body}
          </div>
        </div>

        <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-between gap-3">
          <Btn2
            type="button"
            variant="ghost"
            onClick={handlePrev}
            disabled={isFirst}
            leading={<ChevronLeft className="w-3.5 h-3.5" />}
          >
            Back
          </Btn2>
          <Btn2
            type="button"
            variant="primary"
            onClick={handleNext}
            trailing={
              isLast ? undefined : <ChevronRight className="w-3.5 h-3.5" />
            }
          >
            {isLast ? 'Finish' : 'Next'}
          </Btn2>
        </footer>
      </div>
    </>
  );
}
