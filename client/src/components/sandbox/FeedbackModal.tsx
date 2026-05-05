import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Btn2 } from '../hifi/Btn2';
import { useFeedbackStore } from '../../stores/feedback';
import { useAuthStore } from '../../stores/auth';
import { api, extractError } from '../../lib/api';

type Category = 'bug' | 'suggestion' | 'praise' | 'question' | 'other';

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'bug', label: 'Bug' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'praise', label: 'Praise' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
];

export function FeedbackModal() {
  const isOpen = useFeedbackStore((s) => s.isOpen);
  const close = useFeedbackStore((s) => s.close);
  const pageHint = useFeedbackStore((s) => s.pageHint);
  const userRole = useAuthStore((s) => s.user?.role);

  if (!isOpen) return null;
  return (
    <FeedbackDialog
      page={pageHint}
      role={userRole ?? null}
      onClose={close}
    />
  );
}

interface FeedbackDialogProps {
  page: string | null;
  role: string | null;
  onClose: () => void;
}

function FeedbackDialog({ page, role, onClose }: FeedbackDialogProps) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<Category>('suggestion');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < 5) {
      setError('Please write at least a few words.');
      return;
    }
    setSubmitting(true);
    try {
      await api
        .post('feedback', {
          json: {
            message: message.trim(),
            category,
            page: page ?? undefined,
            userEmail: email.trim(),
            userRole: role ?? undefined,
          },
        })
        .json();
      setDone(true);
    } catch (err) {
      setError(await extractError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-n-900/40 z-50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[520px] bg-white rounded-r3 shadow-sh3 z-50 flex flex-col max-h-[85vh]"
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-n-150">
          <div>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.6px] text-a-600">
              Sandbox feedback
            </div>
            <h2
              id="feedback-dialog-title"
              className="text-[15px] font-semibold text-n-900"
            >
              {done ? 'Thanks for the feedback' : 'Tell me what you think'}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-n-500 hover:bg-n-100 rounded-r1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {done ? (
          <div className="px-6 py-6 text-center">
            <p className="text-[13.5px] text-n-700 mb-4">
              Got it. Your feedback was delivered to the developer.
            </p>
            <Btn2 type="button" variant="primary" onClick={onClose}>
              Close
            </Btn2>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-n-700 mb-1">
                  Your email <span className="text-bad">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full text-[13px] px-2.5 py-1.5 border border-n-200 rounded-r2 focus:outline-none focus:ring-2 focus:ring-a-300"
                />
                <p className="text-[10.5px] text-n-500 mt-1">
                  Used so I can follow up if needed. Stored privately.
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-n-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full text-[13px] px-2.5 py-1.5 border border-n-200 rounded-r2 focus:outline-none focus:ring-2 focus:ring-a-300 bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-n-700 mb-1">
                  Message <span className="text-bad">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's working, what's not, what would you change?"
                  className="w-full text-[13px] px-2.5 py-1.5 border border-n-200 rounded-r2 focus:outline-none focus:ring-2 focus:ring-a-300 resize-y min-h-[120px]"
                />
                <p className="text-[10.5px] text-n-500 mt-1">
                  Page: <code className="text-n-600">{page ?? '/'}</code>
                  {role ? <> · Role: <code className="text-n-600">{role}</code></> : null}
                </p>
              </div>
              {error ? (
                <div className="text-[12px] text-bad bg-bad/10 px-3 py-2 rounded-r2">
                  {error}
                </div>
              ) : null}
            </div>

            <footer className="border-t border-n-150 px-5 py-3 flex items-center justify-end gap-2">
              <Btn2 type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </Btn2>
              <Btn2 type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send feedback'}
              </Btn2>
            </footer>
          </form>
        )}
      </div>
    </>
  );
}
