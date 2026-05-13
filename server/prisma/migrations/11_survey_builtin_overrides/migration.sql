-- Migration 11 — Built-in survey-type overrides
--
-- Lets tenants rename / tweak the 4 built-in SurveyTypes (PHYSICAL,
-- REMOTE_TECH, DOC_REVIEW, HYBRID) without having to declare a whole
-- new customType. Stored as sparse JSONB — only entries for built-ins
-- the tenant actually changed are present.

ALTER TABLE "tenant_survey_configs"
  ADD COLUMN "built_in_overrides" JSONB NOT NULL DEFAULT '[]'::jsonb;
