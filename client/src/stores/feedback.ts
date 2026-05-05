import { create } from 'zustand';

interface FeedbackState {
  isOpen: boolean;
  pageHint: string | null;
  open: () => void;
  close: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  isOpen: false,
  pageHint: null,
  open: () => {
    const page =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : null;
    set({ isOpen: true, pageHint: page });
  },
  close: () => set({ isOpen: false }),
}));
