import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_ASSET_ROLE_STYLES,
  DEFAULT_ASSET_TYPE_STYLES,
  DEFAULT_EDGE_STYLES,
  DEFAULT_RISK_COLORS,
  type AppearanceSettings,
  type AssetRoleStyle,
  type AssetTypeStyle,
  type EdgeStyle,
  type RiskColor,
  type RiskLevel,
} from '../lib/appearance-defaults';
import type { AssetRole, AssetType, RelationshipType } from '../lib/csmp-types';
import { orgSettingsApi } from '../lib/csmp-api';

export const APPEARANCE_LS_KEY = 'csmp-appearance';

interface AppearanceState {
  hydrated: boolean;
  appearance: AppearanceSettings;
  hydrate: () => Promise<void>;
  save: (next: AppearanceSettings) => Promise<void>;
  resetLocal: () => void;
}

function mergeWithDefaults(input: Partial<AppearanceSettings> | null | undefined): AppearanceSettings {
  if (!input) return DEFAULT_APPEARANCE;
  return {
    v: 1,
    assetRoleStyles: { ...DEFAULT_ASSET_ROLE_STYLES, ...(input.assetRoleStyles ?? {}) } as Record<AssetRole, AssetRoleStyle>,
    assetTypeStyles: { ...DEFAULT_ASSET_TYPE_STYLES, ...(input.assetTypeStyles ?? {}) } as Record<AssetType, AssetTypeStyle>,
    edgeStyles: { ...DEFAULT_EDGE_STYLES, ...(input.edgeStyles ?? {}) } as Record<RelationshipType, EdgeStyle>,
    riskColors: { ...DEFAULT_RISK_COLORS, ...(input.riskColors ?? {}) } as Record<RiskLevel, RiskColor>,
  };
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      hydrated: false,
      appearance: DEFAULT_APPEARANCE,

      hydrate: async () => {
        try {
          const res = await orgSettingsApi.get();
          set({ appearance: mergeWithDefaults(res.appearance), hydrated: true });
        } catch {
          // On failure, keep cached/default appearance and try again later.
          set({ hydrated: true });
        }
      },

      save: async (next: AppearanceSettings) => {
        const res = await orgSettingsApi.patchAppearance(next);
        set({ appearance: mergeWithDefaults(res.appearance) });
      },

      resetLocal: () => {
        set({ appearance: DEFAULT_APPEARANCE, hydrated: false });
      },
    }),
    {
      name: APPEARANCE_LS_KEY,
      partialize: (s) => ({ appearance: s.appearance }),
    },
  ),
);

// ─── selector helpers ───────────────────────────────────────

export function getAssetRoleStyle(state: AppearanceState, role: AssetRole): AssetRoleStyle {
  return state.appearance.assetRoleStyles[role] ?? DEFAULT_ASSET_ROLE_STYLES[role];
}

export function getAssetTypeStyle(state: AppearanceState, type: AssetType): AssetTypeStyle {
  return state.appearance.assetTypeStyles[type] ?? DEFAULT_ASSET_TYPE_STYLES[type];
}

export function getEdgeStyle(state: AppearanceState, relType: RelationshipType): EdgeStyle {
  return state.appearance.edgeStyles[relType] ?? DEFAULT_EDGE_STYLES[relType];
}

export function getRiskColor(state: AppearanceState, level: RiskLevel): RiskColor {
  return state.appearance.riskColors[level] ?? DEFAULT_RISK_COLORS[level];
}
