-- Rename _prisma_migrations rows to match the zero-padded directory
-- names introduced alongside this script. Idempotent — re-running it
-- updates 0 rows once every old name has already been padded.
--
-- Run on every database that was bootstrapped before the rename:
--   psql "$DATABASE_URL" -f server/prisma/migrations/_rename-existing-rows.sql
--
-- The trailing SELECT prints the final state for visual verification.

BEGIN;

UPDATE "_prisma_migrations" SET migration_name = '00_init'                            WHERE migration_name = '0_init';
UPDATE "_prisma_migrations" SET migration_name = '01_threat_tear'                     WHERE migration_name = '1_threat_tear';
UPDATE "_prisma_migrations" SET migration_name = '02_compliance_tags'                 WHERE migration_name = '2_compliance_tags';
UPDATE "_prisma_migrations" SET migration_name = '03_snapshots'                       WHERE migration_name = '3_snapshots';
UPDATE "_prisma_migrations" SET migration_name = '04_countermeasure_templates'        WHERE migration_name = '4_countermeasure_templates';
UPDATE "_prisma_migrations" SET migration_name = '05_report_template_fields'          WHERE migration_name = '5_report_template_fields';
UPDATE "_prisma_migrations" SET migration_name = '06_template_editor'                 WHERE migration_name = '6_template_editor';
UPDATE "_prisma_migrations" SET migration_name = '07_evidence_basis'                  WHERE migration_name = '7_evidence_basis';
UPDATE "_prisma_migrations" SET migration_name = '08_survey_templates_and_responses'  WHERE migration_name = '8_survey_templates_and_responses';
UPDATE "_prisma_migrations" SET migration_name = '09_survey_config'                   WHERE migration_name = '9_survey_config';

SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name;

COMMIT;
