-- Block E — Assessment Snapshots
-- Captures the full AssessmentDetail payload (threats + action plans) at key
-- lifecycle transitions (submit-for-review, approve, reject) and on manual save.

CREATE TABLE "assessment_snapshots" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "assessment_id"  UUID         NOT NULL,
  "captured_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "captured_by_id" UUID         NOT NULL,
  "reason"         VARCHAR(120) NOT NULL,
  "payload"        JSONB        NOT NULL,

  CONSTRAINT "assessment_snapshots_assessment_id_fkey"
    FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
  CONSTRAINT "assessment_snapshots_captured_by_id_fkey"
    FOREIGN KEY ("captured_by_id") REFERENCES "users"("id")
);

CREATE INDEX "assessment_snapshots_assessment_id_idx"
  ON "assessment_snapshots" ("assessment_id");
CREATE INDEX "assessment_snapshots_assessment_id_captured_at_idx"
  ON "assessment_snapshots" ("assessment_id", "captured_at" DESC);
