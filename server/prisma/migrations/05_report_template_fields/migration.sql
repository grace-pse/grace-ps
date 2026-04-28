-- Block M — Report template data model
-- Adds fields the assessment report template consumes but that the schema
-- didn't yet expose: approver (3rd sign-off party), signed-off timestamp,
-- cover-metadata (version / period / scope description), and a per-assessment
-- recommendations catalogue. Change-log pages continue to read from
-- assessment_snapshots (already shipped in migration 3).

-- ── AlterTable: assessments ─────────────────────────────────
ALTER TABLE "assessments"
  ADD COLUMN "approver_id"       UUID,
  ADD COLUMN "signed_off_at"     TIMESTAMP(3),
  ADD COLUMN "version"           VARCHAR(16) NOT NULL DEFAULT 'v1.0',
  ADD COLUMN "period"            VARCHAR(40),
  ADD COLUMN "scope_description" TEXT;

ALTER TABLE "assessments"
  ADD CONSTRAINT "assessments_approver_id_fkey"
  FOREIGN KEY ("approver_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CreateTable: recommendations ───────────────────────────
CREATE TABLE "recommendations" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID          NOT NULL,
  "assessment_id" UUID          NOT NULL,
  "ref"           VARCHAR(8)    NOT NULL,
  "priority"      "risk_priority" NOT NULL,
  "title"         VARCHAR(255)  NOT NULL,
  "body"          TEXT          NOT NULL,
  "owner"         VARCHAR(120),
  "horizon"       VARCHAR(40),
  "cost"          VARCHAR(40),
  "sort_order"    SMALLINT      NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recommendations_assessment_id_ref_key"
  ON "recommendations" ("assessment_id", "ref");
CREATE INDEX "recommendations_assessment_id_idx"
  ON "recommendations" ("assessment_id");
CREATE INDEX "recommendations_tenant_id_idx"
  ON "recommendations" ("tenant_id");

ALTER TABLE "recommendations"
  ADD CONSTRAINT "recommendations_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
