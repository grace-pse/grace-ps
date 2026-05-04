import { create } from 'zustand';

// Shared selection bus for the asset detail drawer. Any view (graph,
// tree, future matrix) calls `open(id)` to surface the same drawer; the
// drawer subscribes for `selectedId` and reads its own data.
//
// Kept deliberately tiny: just an id and open/close. Anything more (e.g.
// per-view local highlight, drag state) belongs in the calling component.

interface AssetSelectionState {
  selectedId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const useAssetSelectionStore = create<AssetSelectionState>()((set) => ({
  selectedId: null,
  open: (id) => set({ selectedId: id }),
  close: () => set({ selectedId: null }),
}));
