-- GRACE Survey Model v2 — Phase P1 (survey templates + responses)
-- Adds SurveyTemplate (system + tenant-custom), SurveyResponse (draft through
-- approved), wires the deferred FK on assessment_surveys.survey_response_id
-- that P0 left inert, and seeds three system templates (tenant_id = NULL).

-- ── Enums ─────────────────────────────────────────────────────
CREATE TYPE "survey_type" AS ENUM ('PHYSICAL', 'REMOTE_TECH', 'DOC_REVIEW', 'HYBRID', 'CUSTOM');
CREATE TYPE "survey_rating" AS ENUM ('STRONG', 'BASELINE', 'BARELY_ADEQUATE', 'INADEQUATE');
CREATE TYPE "survey_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- ── CreateTable: survey_templates ─────────────────────────────
CREATE TABLE "survey_templates" (
  "id"                        UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"                 UUID,                            -- NULL = system template
  "name"                      VARCHAR(255)  NOT NULL,
  "description"               TEXT,
  "survey_type"               "survey_type" NOT NULL,
  "applicable_cluster_types"  TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "applicable_asset_types"    TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requires_physical"         BOOLEAN       NOT NULL DEFAULT true,
  "is_system"                 BOOLEAN       NOT NULL DEFAULT false,
  "is_active"                 BOOLEAN       NOT NULL DEFAULT true,
  "created_by_id"             UUID,
  "schema"                    JSONB         NOT NULL,
  "created_at"                TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "survey_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "survey_templates_tenant_id_survey_type_idx"
  ON "survey_templates"("tenant_id", "survey_type");

ALTER TABLE "survey_templates"
  ADD CONSTRAINT "survey_templates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survey_templates"
  ADD CONSTRAINT "survey_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CreateTable: survey_responses ─────────────────────────────
CREATE TABLE "survey_responses" (
  "id"                  UUID            NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID            NOT NULL,
  "cluster_id"          UUID            NOT NULL,
  "template_id"         UUID            NOT NULL,
  "survey_type"         "survey_type"   NOT NULL,
  "conducted_by_id"     UUID            NOT NULL,
  "conducted_at"        TIMESTAMP(3)    NOT NULL,
  "answers"             JSONB           NOT NULL DEFAULT '{}'::JSONB,
  "score_pct"           DECIMAL(5, 2),
  "rating"              "survey_rating",
  "evidence_source"     VARCHAR(120),
  "requires_physical"   BOOLEAN         NOT NULL,
  "status"              "survey_status" NOT NULL DEFAULT 'DRAFT',
  "created_at"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "survey_responses_tenant_id_cluster_id_idx"
  ON "survey_responses"("tenant_id", "cluster_id");

CREATE INDEX "survey_responses_tenant_id_conducted_at_idx"
  ON "survey_responses"("tenant_id", "conducted_at" DESC);

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_cluster_id_fkey"
  FOREIGN KEY ("cluster_id") REFERENCES "asset_clusters"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "survey_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_conducted_by_id_fkey"
  FOREIGN KEY ("conducted_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Wire deferred FK: assessment_surveys.survey_response_id ───
ALTER TABLE "assessment_surveys"
  ADD CONSTRAINT "assessment_surveys_survey_response_id_fkey"
  FOREIGN KEY ("survey_response_id") REFERENCES "survey_responses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Seed three system templates ───────────────────────────────
-- Minimal starter content so tenants can run a real survey immediately.
-- A richer library lands in P2 via the admin console.

INSERT INTO "survey_templates" (
  "tenant_id", "name", "description", "survey_type",
  "applicable_cluster_types", "applicable_asset_types",
  "requires_physical", "is_system", "is_active",
  "schema", "updated_at"
) VALUES
(
  NULL,
  'Physical Walkthrough — Generic',
  'On-site assessor walkthrough covering perimeter, access points, and key staff behaviour. Applies to all cluster types.',
  'PHYSICAL',
  ARRAY['OPERATIONAL', 'SPATIAL', 'LOGICAL', 'TEMPORAL'],
  ARRAY[]::TEXT[],
  true,
  true,
  true,
  $${
    "questions": [
      {
        "id": "perimeter_visibility",
        "category": "Perimeter",
        "prompt": "Is the perimeter clearly delineated and observable from staffed positions?",
        "type": "yes_no_partial",
        "weight": 2,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "access_control_state",
        "category": "Access",
        "prompt": "Are all external doors secured with working access control during business hours?",
        "type": "yes_no_partial",
        "weight": 3,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "tailgating_risk",
        "category": "Access",
        "prompt": "Is tailgating into the reception / main entrance easy?",
        "type": "yes_no_partial",
        "weight": 2,
        "severityMap": {"YES": "bad", "PARTIAL": "warn", "NO": "ok"}
      },
      {
        "id": "cctv_coverage",
        "category": "Surveillance",
        "prompt": "Do cameras cover all external doors with no visible blind spots?",
        "type": "yes_no_partial",
        "weight": 2,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "staff_awareness",
        "category": "Human",
        "prompt": "Did staff challenge an unbadged visitor during the walkthrough?",
        "type": "yes_no_partial",
        "weight": 1,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "signage_visibility",
        "category": "Programme",
        "prompt": "Are emergency exits, assembly points, and security contacts clearly signposted?",
        "type": "yes_no_partial",
        "weight": 1,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      }
    ]
  }$$::JSONB,
  CURRENT_TIMESTAMP
),
(
  NULL,
  'Remote Tech — CCTV Zone Coverage',
  'Assessor-operated review of VMS dashboards, NVR retention, and camera health. No API integration — the assessor opens the vendor console themselves and fills each question.',
  'REMOTE_TECH',
  ARRAY['OPERATIONAL', 'SPATIAL', 'LOGICAL'],
  ARRAY['EQUIPMENT', 'ZONE'],
  false,
  true,
  true,
  $${
    "questions": [
      {
        "id": "cameras_recording",
        "category": "Recording",
        "prompt": "Are all cameras in the target zone currently recording?",
        "type": "yes_no_partial",
        "weight": 3,
        "hint": "Usually verified via VMS health dashboard.",
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "retention_days",
        "category": "Recording",
        "prompt": "How many days of footage are retained per the VMS configuration?",
        "type": "number",
        "weight": 2,
        "hint": "Check the active retention policy in the VMS settings pane.",
        "severityMap": {"BELOW_30": "bad", "30_TO_60": "warn", "ABOVE_60": "ok"}
      },
      {
        "id": "camera_health",
        "category": "Health",
        "prompt": "Do any cameras show a health fault (offline, signal loss, focus)?",
        "type": "yes_no_partial",
        "weight": 2,
        "hint": "Look for red/amber indicators in the device tree.",
        "severityMap": {"YES": "bad", "PARTIAL": "warn", "NO": "ok"}
      },
      {
        "id": "access_control_events",
        "category": "Access",
        "prompt": "In the last 90 days, any tailgating / denied / forced-door events worth investigating?",
        "type": "yes_no_partial",
        "weight": 2,
        "hint": "Review access-control audit report.",
        "severityMap": {"YES": "bad", "PARTIAL": "warn", "NO": "ok"}
      },
      {
        "id": "coverage_validation",
        "category": "Coverage",
        "prompt": "Does camera placement still match the current floor plan?",
        "type": "yes_no_partial",
        "weight": 2,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      }
    ]
  }$$::JSONB,
  CURRENT_TIMESTAMP
),
(
  NULL,
  'Document Review — SOPs & Certificates',
  'Desk review of security documentation: SOPs, drills, certifications, vendor contracts. Purely document-based — no site visit required.',
  'DOC_REVIEW',
  ARRAY['OPERATIONAL', 'LOGICAL', 'TEMPORAL'],
  ARRAY[]::TEXT[],
  false,
  true,
  true,
  $${
    "questions": [
      {
        "id": "sop_currency",
        "category": "Programme",
        "prompt": "Has the security SOP been reviewed in the last 12 months?",
        "type": "yes_no_partial",
        "weight": 2,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "drill_evidence",
        "category": "Drills",
        "prompt": "Is there evidence of at least one evacuation / lockdown drill in the last 12 months?",
        "type": "yes_no_partial",
        "weight": 2,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "guard_licences",
        "category": "Personnel",
        "prompt": "Are all security guard licences current (not expiring within 60 days)?",
        "type": "yes_no_partial",
        "weight": 2,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "contract_review",
        "category": "Vendors",
        "prompt": "Have key security-vendor contracts (guarding, monitoring) been reviewed this year?",
        "type": "yes_no_partial",
        "weight": 1,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      },
      {
        "id": "incident_log",
        "category": "Programme",
        "prompt": "Is a documented security-incident log being maintained?",
        "type": "yes_no_partial",
        "weight": 2,
        "severityMap": {"YES": "ok", "PARTIAL": "warn", "NO": "bad"}
      }
    ]
  }$$::JSONB,
  CURRENT_TIMESTAMP
);
