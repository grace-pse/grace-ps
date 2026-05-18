-- AssetTemplate gets a first-class `default_asset_role` column so subtypes
-- can advertise a credible role (PROTECTED / PROTECTIVE / DUAL) at template-
-- apply time. Reuses the existing `asset_role` enum from migration 14.
-- Nullable: existing rows stay NULL, the asset form falls back to PROTECTED.

ALTER TABLE "asset_templates"
  ADD COLUMN "default_asset_role" "asset_role";
