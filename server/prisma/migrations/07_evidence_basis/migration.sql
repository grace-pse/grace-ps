-- GRACE Survey Model v2 — Phase P0 (evidence basis)
-- Adds the `evidence_basis` flag to every assessment, an inert junction
-- table for future survey linking (P1 attaches its FK), and backfills
-- existing rows to the safe default: EXPERT_JUDGMENT + survey_pending.

-- ── CreateEnum: evidence_basis ─────────────────────────────
CREATE TYPE "evidence_basis" AS ENUM ('EXPERT_JUDGMENT', 'SURVEY_LINKED', 'MIXED');

-- ── AlterTable: assessments ────────────────────────────────
ALTER TABLE "assessments"
  ADD COLUMN "evidence_basis"       "evidence_basis" NOT NULL DEFAULT 'EXPERT_JUDGMENT',
  ADD COLUMN "survey_pending"       BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN "last_survey_date"     DATE,
  ADD COLUMN "expert_justification" TEXT;

-- Defensive backfill: every pre-existing row gets the same safe defaults
-- as the column default, but spelled out so `migrate diff` stays clean if
-- defaults are adjusted later.
UPDATE "assessments"
SET    "evidence_basis" = 'EXPERT_JUDGMENT',
       "survey_pending" = true
WHERE  "evidence_basis" IS NULL;

-- ── CreateTable: assessment_surveys (inert until P1) ──────
-- Junction used by P1 to link approved SurveyResponses to Assessments.
-- surveyResponse FK is intentionally omitted here — the target table
-- does not exist yet. P1's migration adds the FK once survey_responses
-- lands. Until then the table has no rows, so the missing FK is moot.
CREATE TABLE "assessment_surveys" (
  "assessment_id"          UUID        NOT NULL,
  "survey_response_id"     UUID        NOT NULL,
  "linked_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linked_by_id"           UUID        NOT NULL,
  "vulnerability_override" BOOLEAN     NOT NULL DEFAULT false,

  CONSTRAINT "assessment_surveys_pkey"
    PRIMARY KEY ("assessment_id", "survey_response_id")
);

ALTER TABLE "assessment_surveys"
  ADD CONSTRAINT "assessment_surveys_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assessment_surveys"
  ADD CONSTRAINT "assessment_surveys_linked_by_id_fkey"
  FOREIGN KEY ("linked_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
