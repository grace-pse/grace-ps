-- P3: Survey schedules + notifications

-- 1. ScheduleStatus enum
CREATE TYPE "schedule_status" AS ENUM ('ACTIVE', 'PAUSED');

-- 2. survey_schedules
CREATE TABLE "survey_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "cluster_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "cron" VARCHAR(80) NOT NULL,
    "assigned_to_id" UUID NOT NULL,
    "status" "schedule_status" NOT NULL DEFAULT 'ACTIVE',
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "survey_schedules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "survey_schedules"
    ADD CONSTRAINT "survey_schedules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survey_schedules"
    ADD CONSTRAINT "survey_schedules_cluster_id_fkey"
    FOREIGN KEY ("cluster_id") REFERENCES "asset_clusters"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survey_schedules"
    ADD CONSTRAINT "survey_schedules_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "survey_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survey_schedules"
    ADD CONSTRAINT "survey_schedules_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "survey_schedules_tenant_id_next_run_at_idx"
    ON "survey_schedules"("tenant_id", "next_run_at");
CREATE INDEX "survey_schedules_status_next_run_at_idx"
    ON "survey_schedules"("status", "next_run_at");

-- 3. notifications
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "kind" VARCHAR(40) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "notifications_tenant_id_read_at_created_at_idx"
    ON "notifications"("tenant_id", "read_at", "created_at");
CREATE INDEX "notifications_user_id_read_at_idx"
    ON "notifications"("user_id", "read_at");

-- 4. survey_responses.schedule_id (nullable, FK to survey_schedules)
ALTER TABLE "survey_responses"
    ADD COLUMN "schedule_id" UUID;

ALTER TABLE "survey_responses"
    ADD CONSTRAINT "survey_responses_schedule_id_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "survey_schedules"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "survey_responses_schedule_id_conducted_at_idx"
    ON "survey_responses"("schedule_id", "conducted_at");
