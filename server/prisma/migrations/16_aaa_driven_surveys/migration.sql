-- AAA-driven surveys (P4)
-- New entities for cluster-level survey scopes composed from AAA tuples,
-- plus a standalone SurveyQuestion library and per-AAA score roll-ups.

-- ── Enums ───────────────────────────────────────────────────────
CREATE TYPE "question_type" AS ENUM ('yes_no_partial', 'number', 'text', 'select');
CREATE TYPE "scope_status" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');
CREATE TYPE "scope_aggregation_mode" AS ENUM ('AGGREGATE_BY_CM_TEMPLATE', 'PER_INSTANCE');
CREATE TYPE "scope_item_source" AS ENUM ('ASSET', 'THREAT', 'COUNTERMEASURE', 'COUNTERMEASURE_GROUP', 'MANUAL');

-- ── SurveyResponse extensions ──────────────────────────────────
ALTER TABLE "survey_responses"
  ALTER COLUMN "template_id" DROP NOT NULL,
  ADD COLUMN "cluster_survey_scope_id"   UUID,
  ADD COLUMN "vulnerability_score_pct"   DECIMAL(5,2),
  ADD COLUMN "vulnerability_rating"      "survey_rating",
  ADD COLUMN "likelihood_score_pct"      DECIMAL(5,2),
  ADD COLUMN "likelihood_rating"         "survey_rating";

CREATE INDEX "survey_responses_cluster_survey_scope_id_idx"
  ON "survey_responses" ("cluster_survey_scope_id");

-- ── SurveyQuestion ─────────────────────────────────────────────
CREATE TABLE "survey_questions" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"      UUID,
  "prompt"         VARCHAR(500) NOT NULL,
  "category"       VARCHAR(80),
  "hint"           VARCHAR(500),
  "type"           "question_type" NOT NULL,
  "options"        JSONB,
  "severity_map"   JSONB,
  "evidence_type"  "survey_type" NOT NULL,
  "default_weight" SMALLINT NOT NULL DEFAULT 1,
  "is_system"      BOOLEAN NOT NULL DEFAULT false,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_by_id"  UUID,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "survey_questions_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "survey_questions_creator_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);
CREATE INDEX "survey_questions_tenant_active_idx"
  ON "survey_questions" ("tenant_id", "is_active");
CREATE INDEX "survey_questions_evidence_type_idx"
  ON "survey_questions" ("evidence_type");

-- ── AAA-template ↔ question link tables ───────────────────────
CREATE TABLE "asset_template_questions" (
  "asset_template_id" UUID NOT NULL,
  "question_id"       UUID NOT NULL,
  "weight"            SMALLINT,
  "sort_order"        SMALLINT NOT NULL DEFAULT 0,
  "rationale"         TEXT,
  CONSTRAINT "asset_template_questions_pk"
    PRIMARY KEY ("asset_template_id", "question_id"),
  CONSTRAINT "asset_template_questions_template_fk"
    FOREIGN KEY ("asset_template_id") REFERENCES "asset_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "asset_template_questions_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "asset_template_questions_question_idx"
  ON "asset_template_questions" ("question_id");

CREATE TABLE "threat_template_questions" (
  "threat_template_id" UUID NOT NULL,
  "question_id"        UUID NOT NULL,
  "weight"             SMALLINT,
  "sort_order"         SMALLINT NOT NULL DEFAULT 0,
  "rationale"          TEXT,
  CONSTRAINT "threat_template_questions_pk"
    PRIMARY KEY ("threat_template_id", "question_id"),
  CONSTRAINT "threat_template_questions_template_fk"
    FOREIGN KEY ("threat_template_id") REFERENCES "threat_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "threat_template_questions_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "threat_template_questions_question_idx"
  ON "threat_template_questions" ("question_id");

CREATE TABLE "countermeasure_template_questions" (
  "countermeasure_template_id" UUID NOT NULL,
  "question_id"                UUID NOT NULL,
  "weight"                     SMALLINT,
  "sort_order"                 SMALLINT NOT NULL DEFAULT 0,
  "rationale"                  TEXT,
  CONSTRAINT "countermeasure_template_questions_pk"
    PRIMARY KEY ("countermeasure_template_id", "question_id"),
  CONSTRAINT "countermeasure_template_questions_template_fk"
    FOREIGN KEY ("countermeasure_template_id") REFERENCES "countermeasure_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "countermeasure_template_questions_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "countermeasure_template_questions_question_idx"
  ON "countermeasure_template_questions" ("question_id");

-- ── ClusterSurveyScope ────────────────────────────────────────
CREATE TABLE "cluster_survey_scopes" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"        UUID NOT NULL,
  "cluster_id"       UUID NOT NULL,
  "name"             VARCHAR(255) NOT NULL,
  "description"      TEXT,
  "evidence_types"   "survey_type"[] NOT NULL DEFAULT '{}',
  "aggregation_mode" "scope_aggregation_mode" NOT NULL DEFAULT 'AGGREGATE_BY_CM_TEMPLATE',
  "status"           "scope_status" NOT NULL DEFAULT 'DRAFT',
  "version"          INT NOT NULL DEFAULT 1,
  "supersedes_id"    UUID,
  "created_by_id"    UUID NOT NULL,
  "approved_by_id"   UUID,
  "approved_at"      TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cluster_survey_scopes_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scopes_cluster_fk"
    FOREIGN KEY ("cluster_id") REFERENCES "asset_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scopes_creator_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scopes_approver_fk"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scopes_supersedes_fk"
    FOREIGN KEY ("supersedes_id") REFERENCES "cluster_survey_scopes"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);
CREATE INDEX "cluster_survey_scopes_tenant_cluster_status_idx"
  ON "cluster_survey_scopes" ("tenant_id", "cluster_id", "status");

-- Wire SurveyResponse → ClusterSurveyScope FK now that the table exists.
ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_scope_fk"
  FOREIGN KEY ("cluster_survey_scope_id") REFERENCES "cluster_survey_scopes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── ClusterSurveyScopeItem ────────────────────────────────────
CREATE TABLE "cluster_survey_scope_items" (
  "id"                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scope_id"                            UUID NOT NULL,
  "question_id"                         UUID NOT NULL,
  "source_type"                         "scope_item_source" NOT NULL,
  "source_asset_id"                     UUID,
  "source_threat_id"                    UUID,
  "source_countermeasure_id"            UUID,
  "source_countermeasure_template_id"   UUID,
  "weight_override"                     SMALLINT,
  "sort_order"                          SMALLINT NOT NULL DEFAULT 0,
  "added_by_id"                         UUID NOT NULL,
  "added_at"                            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cluster_survey_scope_items_scope_fk"
    FOREIGN KEY ("scope_id") REFERENCES "cluster_survey_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scope_items_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scope_items_asset_fk"
    FOREIGN KEY ("source_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scope_items_threat_fk"
    FOREIGN KEY ("source_threat_id") REFERENCES "threats"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scope_items_cm_fk"
    FOREIGN KEY ("source_countermeasure_id") REFERENCES "countermeasures"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scope_items_cm_template_fk"
    FOREIGN KEY ("source_countermeasure_template_id") REFERENCES "countermeasure_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "cluster_survey_scope_items_added_by_fk"
    FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);
CREATE INDEX "cluster_survey_scope_items_scope_idx"
  ON "cluster_survey_scope_items" ("scope_id");
CREATE INDEX "cluster_survey_scope_items_question_idx"
  ON "cluster_survey_scope_items" ("question_id");

-- ── SurveyResponseAaaScore ────────────────────────────────────
CREATE TABLE "survey_response_aaa_scores" (
  "id"                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "response_id"                         UUID NOT NULL,
  "source_type"                         "scope_item_source" NOT NULL,
  "source_asset_id"                     UUID,
  "source_threat_id"                    UUID,
  "source_countermeasure_id"            UUID,
  "source_countermeasure_template_id"   UUID,
  "score_pct"                           DECIMAL(5,2),
  "rating"                              "survey_rating",
  "answered_count"                      SMALLINT NOT NULL DEFAULT 0,
  "total_count"                         SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT "survey_response_aaa_scores_response_fk"
    FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "survey_response_aaa_scores_asset_fk"
    FOREIGN KEY ("source_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "survey_response_aaa_scores_threat_fk"
    FOREIGN KEY ("source_threat_id") REFERENCES "threats"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "survey_response_aaa_scores_cm_fk"
    FOREIGN KEY ("source_countermeasure_id") REFERENCES "countermeasures"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "survey_response_aaa_scores_cm_template_fk"
    FOREIGN KEY ("source_countermeasure_template_id") REFERENCES "countermeasure_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "survey_response_aaa_scores_response_idx"
  ON "survey_response_aaa_scores" ("response_id");
CREATE INDEX "survey_response_aaa_scores_cm_idx"
  ON "survey_response_aaa_scores" ("source_countermeasure_id");
CREATE INDEX "survey_response_aaa_scores_threat_idx"
  ON "survey_response_aaa_scores" ("source_threat_id");
