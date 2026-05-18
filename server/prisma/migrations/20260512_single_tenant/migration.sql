-- Single-tenant conversion: drop all tenant_id columns, rebuild indexes,
-- rename tenant_survey_configs -> organization_survey_config, add is_system
-- to design_basis_threats.
--
-- DESTRUCTIVE: assumes the DB only holds one tenant's worth of data
-- (currently the case in dev and on the OVH demo deploys). Drops every
-- tenant_id column and FK without backfill.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Drop all tenant_id foreign-key constraints.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE survey_responses           DROP CONSTRAINT IF EXISTS "survey_responses_tenant_id_fkey";
ALTER TABLE survey_schedules           DROP CONSTRAINT IF EXISTS "survey_schedules_tenant_id_fkey";
ALTER TABLE cluster_survey_scopes      DROP CONSTRAINT IF EXISTS "cluster_survey_scopes_tenant_id_fkey";
ALTER TABLE asset_type_survey_defaults DROP CONSTRAINT IF EXISTS "asset_type_survey_defaults_tenant_id_fkey";
ALTER TABLE survey_templates           DROP CONSTRAINT IF EXISTS "survey_templates_tenant_id_fkey";
ALTER TABLE survey_questions           DROP CONSTRAINT IF EXISTS "survey_questions_tenant_id_fkey";
ALTER TABLE notifications              DROP CONSTRAINT IF EXISTS "notifications_tenant_id_fkey";
ALTER TABLE countermeasure_gaps        DROP CONSTRAINT IF EXISTS "countermeasure_gaps_tenant_id_fkey";
ALTER TABLE countermeasures            DROP CONSTRAINT IF EXISTS "countermeasures_tenant_id_fkey";
ALTER TABLE package_applications       DROP CONSTRAINT IF EXISTS "package_applications_tenant_id_fkey";
ALTER TABLE recommendations            DROP CONSTRAINT IF EXISTS "recommendations_tenant_id_fkey";
ALTER TABLE assessments                DROP CONSTRAINT IF EXISTS "assessments_tenant_id_fkey";
ALTER TABLE asset_relationships        DROP CONSTRAINT IF EXISTS "asset_relationships_tenant_id_fkey";
ALTER TABLE asset_clusters             DROP CONSTRAINT IF EXISTS "asset_clusters_tenant_id_fkey";
ALTER TABLE assets                     DROP CONSTRAINT IF EXISTS "assets_tenant_id_fkey";
ALTER TABLE design_basis_threats       DROP CONSTRAINT IF EXISTS "design_basis_threats_tenant_id_fkey";
ALTER TABLE users                      DROP CONSTRAINT IF EXISTS "users_tenant_id_fkey";

-- ─────────────────────────────────────────────────────────────
-- 2. Drop the per-tenant survey-config table entirely (replaced
--    by organization_survey_config below).
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS tenant_survey_configs;

-- ─────────────────────────────────────────────────────────────
-- 3. Drop tenant-scoped indexes / uniques.
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "users_tenant_id_email_key";
DROP INDEX IF EXISTS "users_tenant_id_idx";
DROP INDEX IF EXISTS "assets_tenant_id_idx";
DROP INDEX IF EXISTS "assets_tenant_id_asset_type_idx";
DROP INDEX IF EXISTS "assets_tenant_id_parent_id_idx";
DROP INDEX IF EXISTS "assets_tenant_id_parent_id_layout_order_idx";
DROP INDEX IF EXISTS "assets_tenant_id_asset_role_idx";
DROP INDEX IF EXISTS "assets_tenant_id_degraded_control_posture_idx";
DROP INDEX IF EXISTS "assets_tenant_id_path_idx";
DROP INDEX IF EXISTS "asset_clusters_tenant_id_idx";
DROP INDEX IF EXISTS "asset_relationships_tenant_id_idx";
DROP INDEX IF EXISTS "assessments_tenant_id_idx";
DROP INDEX IF EXISTS "assessments_tenant_id_status_idx";
DROP INDEX IF EXISTS "recommendations_tenant_id_idx";
DROP INDEX IF EXISTS "countermeasures_tenant_id_idx";
DROP INDEX IF EXISTS "countermeasures_tenant_id_shape_category_idx";
DROP INDEX IF EXISTS "countermeasures_tenant_id_is_existing_idx";
DROP INDEX IF EXISTS "countermeasure_gaps_tenant_id_idx";
DROP INDEX IF EXISTS "package_applications_tenant_id_idx";
DROP INDEX IF EXISTS "asset_type_survey_defaults_tenant_id_asset_type_survey_type_key";
DROP INDEX IF EXISTS "asset_type_survey_defaults_tenant_id_asset_type_idx";
DROP INDEX IF EXISTS "survey_templates_tenant_id_survey_type_idx";
DROP INDEX IF EXISTS "survey_responses_tenant_id_cluster_id_idx";
DROP INDEX IF EXISTS "survey_responses_tenant_id_conducted_at_idx";
DROP INDEX IF EXISTS "survey_schedules_tenant_id_next_run_at_idx";
DROP INDEX IF EXISTS "notifications_tenant_id_read_at_created_at_idx";
DROP INDEX IF EXISTS "survey_questions_tenant_id_is_active_idx";
DROP INDEX IF EXISTS "cluster_survey_scopes_tenant_id_cluster_id_status_idx";
DROP INDEX IF EXISTS "design_basis_threats_tenant_id_idx";

-- ─────────────────────────────────────────────────────────────
-- 4. Drop the tenant_id column on every affected table.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users                      DROP COLUMN tenant_id;
ALTER TABLE assets                     DROP COLUMN tenant_id;
ALTER TABLE asset_clusters             DROP COLUMN tenant_id;
ALTER TABLE asset_relationships        DROP COLUMN tenant_id;
ALTER TABLE assessments                DROP COLUMN tenant_id;
ALTER TABLE recommendations            DROP COLUMN tenant_id;
ALTER TABLE countermeasures            DROP COLUMN tenant_id;
ALTER TABLE countermeasure_gaps        DROP COLUMN tenant_id;
ALTER TABLE package_applications       DROP COLUMN tenant_id;
ALTER TABLE asset_type_survey_defaults DROP COLUMN tenant_id;
ALTER TABLE survey_templates           DROP COLUMN tenant_id;
ALTER TABLE survey_responses           DROP COLUMN tenant_id;
ALTER TABLE survey_schedules           DROP COLUMN tenant_id;
ALTER TABLE notifications              DROP COLUMN tenant_id;
ALTER TABLE survey_questions           DROP COLUMN tenant_id;
ALTER TABLE cluster_survey_scopes      DROP COLUMN tenant_id;
ALTER TABLE design_basis_threats       DROP COLUMN tenant_id;

-- ─────────────────────────────────────────────────────────────
-- 5. Add is_system on design_basis_threats (templates/questions
--    already have it). IF NOT EXISTS guards in this section so the
--    migration is idempotent against the OVH demo deploys where
--    `is_system` + `users_email_key` were created by earlier eras
--    (some via 00_init, some via the interim 21_email_globally_unique
--    migration). Fresh DBs are unaffected.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE design_basis_threats ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "design_basis_threats_is_system_idx" ON design_basis_threats(is_system);

-- ─────────────────────────────────────────────────────────────
-- 6. Recreate non-tenant indexes / uniques.
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON users(email);

CREATE INDEX IF NOT EXISTS "assets_asset_type_idx"               ON assets(asset_type);
CREATE INDEX IF NOT EXISTS "assets_parent_id_idx"                ON assets(parent_id);
CREATE INDEX IF NOT EXISTS "assets_parent_id_layout_order_idx"   ON assets(parent_id, layout_order);
CREATE INDEX IF NOT EXISTS "assets_asset_role_idx"               ON assets(asset_role);
CREATE INDEX IF NOT EXISTS "assets_degraded_control_posture_idx" ON assets(degraded_control_posture);
CREATE INDEX IF NOT EXISTS "assets_path_idx"                     ON assets(path);

CREATE INDEX IF NOT EXISTS "assessments_status_idx" ON assessments(status);

CREATE INDEX IF NOT EXISTS "countermeasures_shape_category_idx" ON countermeasures(shape_category);
CREATE INDEX IF NOT EXISTS "countermeasures_is_existing_idx"    ON countermeasures(is_existing);

CREATE INDEX IF NOT EXISTS "package_applications_package_id_idx" ON package_applications(package_id);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_type_survey_defaults_asset_type_survey_type_key"
  ON asset_type_survey_defaults(asset_type, survey_type);
CREATE INDEX IF NOT EXISTS "asset_type_survey_defaults_asset_type_idx"
  ON asset_type_survey_defaults(asset_type);

CREATE INDEX IF NOT EXISTS "survey_templates_survey_type_idx"  ON survey_templates(survey_type);
CREATE INDEX IF NOT EXISTS "survey_responses_cluster_id_idx"   ON survey_responses(cluster_id);
CREATE INDEX IF NOT EXISTS "survey_responses_conducted_at_idx" ON survey_responses(conducted_at DESC);
CREATE INDEX IF NOT EXISTS "survey_schedules_next_run_at_idx"  ON survey_schedules(next_run_at);

CREATE INDEX IF NOT EXISTS "notifications_read_at_created_at_idx" ON notifications(read_at, created_at);

CREATE INDEX IF NOT EXISTS "survey_questions_is_active_idx" ON survey_questions(is_active);

CREATE INDEX IF NOT EXISTS "cluster_survey_scopes_cluster_id_status_idx"
  ON cluster_survey_scopes(cluster_id, status);

-- ─────────────────────────────────────────────────────────────
-- 7. New organization_survey_config table (1-1 with Organization).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE organization_survey_config (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    enabled_types      TEXT[] NOT NULL,
    custom_types       JSONB NOT NULL DEFAULT '[]',
    built_in_overrides JSONB NOT NULL DEFAULT '[]',
    updated_at         TIMESTAMP(3) NOT NULL DEFAULT now()
);

COMMIT;
