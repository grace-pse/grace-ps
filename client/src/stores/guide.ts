import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GuideState {
  seenGuides: string[];
  currentGuideId: string | null;
  isOpen: boolean;
  open: (id: string) => void;
  close: () => void;
  markSeen: (id: string) => void;
  hasSeen: (id: string) => boolean;
}

export const GUIDE_LS_KEY = 'csmp-guides';

export const useGuideStore = create<GuideState>()(
  persist(
    (set, get) => ({
      seenGuides: [],
      currentGuideId: null,
      isOpen: false,

      open: (id) => {
        set({ currentGuideId: id, isOpen: true });
      },

      close: () => {
        set({ isOpen: false });
      },

      markSeen: (id) => {
        const seen = get().seenGuides;
        if (seen.includes(id)) return;
        set({ seenGuides: [...seen, id] });
      },

      hasSeen: (id) => get().seenGuides.includes(id),
    }),
    {
      name: GUIDE_LS_KEY,
      partialize: (s) => ({ seenGuides: s.seenGuides }),
    },
  ),
);
