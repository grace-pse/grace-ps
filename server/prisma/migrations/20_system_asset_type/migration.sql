-- Adds the SYSTEM AssetType for functional/domain container assets
-- (e.g. "IT Infrastructure", "Information & IP") that group heterogeneous
-- children under one parent for readability without overloading PROCESS
-- or ZONE semantics.

ALTER TYPE "asset_type" ADD VALUE 'SYSTEM';
