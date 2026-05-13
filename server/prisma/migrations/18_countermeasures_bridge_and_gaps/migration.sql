-- Step 6 Countermeasures Bridge & Gap Analysis
-- Extends Countermeasure with effectiveness/lifecycle/ALARP fields,
-- introduces explicit CountermeasureGap records for missing/ineffective
-- controls, and an audit trail for implementation-status transitions.
-- Driven by 02-Architecture/step6-countermeasures-gap-analysis.md.

-- ── Enums ───────────────────────────────────────────────────────
CREATE TYPE "implementation_horizon"      AS ENUM ('SHORT', 'MEDIUM', 'LONG');
CREATE TYPE "countermeasure_gap_type"     AS ENUM ('NO_CONTROL', 'INEFFECTIVE', 'DEGRADED_ASSET', 'COVERAGE_MISSING');
CREATE TYPE "countermeasure_gap_severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- ── Asset freshness ─────────────────────────────────────────────
ALTER TABLE "assets"
  ADD COLUMN "last_status_check" TIMESTAMP(3);

-- ── Countermeasure extensions ───────────────────────────────────
ALTER TABLE "countermeasures"
  ADD COLUMN "is_existing"                BOOLEAN                  NOT NULL DEFAULT false,
  ADD COLUMN "effectiveness_score"        SMALLINT,
  ADD COLUMN "survey_rating_at_creation"  "vulnerability_rating",
  ADD COLUMN "survey_rating_numeric"      SMALLINT,
  ADD COLUMN "gap_delta"                  SMALLINT,
  ADD COLUMN "effectiveness_notes"        TEXT,
  ADD COLUMN "implementation_horizon"     "implementation_horizon",
  ADD COLUMN "due_date"                   TIMESTAMP(3),
  ADD COLUMN "review_date"                TIMESTAMP(3),
  ADD COLUMN "implementation_date"        TIMESTAMP(3),
  ADD COLUMN "owner_user_id"              UUID,
  ADD COLUMN "verification_survey_id"     UUID,
  ADD COLUMN "alarp_accepted_by"          UUID,
  ADD COLUMN "alarp_accepted_at"          TIMESTAMP(3);

ALTER TABLE "countermeasures"
  ADD CONSTRAINT "countermeasures_owner_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "countermeasures_alarp_acceptor_fk"
    FOREIGN KEY ("alarp_accepted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "countermeasures_tenant_id_is_existing_idx"
  ON "countermeasures" ("tenant_id", "is_existing");
CREATE INDEX "countermeasures_assigned_to_threat_id_idx"
  ON "countermeasures" ("assigned_to_threat_id");

-- ── CountermeasureGap ───────────────────────────────────────────
CREATE TABLE "countermeasure_gaps" (
  "id"                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"                   UUID NOT NULL,
  "assessment_id"               UUID NOT NULL,
  "threat_id"                   UUID NOT NULL,
  "countermeasure_id"           UUID,
  "gap_type"                    "countermeasure_gap_type"     NOT NULL,
  "gap_severity"                "countermeasure_gap_severity" NOT NULL,
  "description"                 TEXT NOT NULL,
  "recommended_action"          TEXT,
  "drives_treatment_priority"   BOOLEAN NOT NULL DEFAULT true,
  "is_open"                     BOOLEAN NOT NULL DEFAULT true,
  "closed_at"                   TIMESTAMP(3),
  "closed_by"                   UUID,
  "closing_notes"               TEXT,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"                  UUID NOT NULL,
  CONSTRAINT "countermeasure_gaps_assessment_fk"
    FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "countermeasure_gaps_threat_fk"
    FOREIGN KEY ("threat_id") REFERENCES "threats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "countermeasure_gaps_countermeasure_fk"
    FOREIGN KEY ("countermeasure_id") REFERENCES "countermeasures"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "countermeasure_gaps_created_by_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "countermeasure_gaps_closed_by_fk"
    FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE INDEX "countermeasure_gaps_tenant_id_idx"
  ON "countermeasure_gaps" ("tenant_id");
CREATE INDEX "countermeasure_gaps_assessment_open_idx"
  ON "countermeasure_gaps" ("assessment_id", "is_open");
CREATE INDEX "countermeasure_gaps_threat_id_idx"
  ON "countermeasure_gaps" ("threat_id");

-- ── CountermeasureImplementation (lifecycle audit trail) ────────
CREATE TABLE "countermeasure_implementations" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "countermeasure_id"  UUID NOT NULL,
  "from_status"        "implementation_status",
  "to_status"          "implementation_status" NOT NULL,
  "changed_by"         UUID NOT NULL,
  "changed_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"              TEXT,
  "evidence_url"       VARCHAR(500),
  CONSTRAINT "countermeasure_implementations_cm_fk"
    FOREIGN KEY ("countermeasure_id") REFERENCES "countermeasures"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "countermeasure_implementations_changed_by_fk"
    FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE INDEX "countermeasure_implementations_countermeasure_id_idx"
  ON "countermeasure_implementations" ("countermeasure_id");
