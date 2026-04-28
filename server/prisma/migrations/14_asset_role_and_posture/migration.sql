-- Asset role + operational posture: distinguish PROTECTED (assessment targets)
-- from PROTECTIVE (security systems performing controls) from DUAL (both).
-- Adds operational status + degraded-control-posture flag for the Step 6 panel
-- and top-of-wizard banner. All existing rows backfill to PROTECTED / OPERATIONAL.

CREATE TYPE "asset_role" AS ENUM ('PROTECTED', 'PROTECTIVE', 'DUAL');
CREATE TYPE "operational_status" AS ENUM ('OPERATIONAL', 'DEGRADED', 'FAILED', 'UNKNOWN');

ALTER TABLE "assets"
  ADD COLUMN "asset_role"               "asset_role"         NOT NULL DEFAULT 'PROTECTED',
  ADD COLUMN "operational_status"       "operational_status" NOT NULL DEFAULT 'OPERATIONAL',
  ADD COLUMN "degraded_control_posture" BOOLEAN              NOT NULL DEFAULT false,
  ADD COLUMN "degraded_control_since"   TIMESTAMP(3);

CREATE INDEX "assets_tenant_id_asset_role_idx"               ON "assets" ("tenant_id", "asset_role");
CREATE INDEX "assets_tenant_id_degraded_control_posture_idx" ON "assets" ("tenant_id", "degraded_control_posture");
