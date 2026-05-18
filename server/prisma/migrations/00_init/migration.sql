-- CreateEnum
CREATE TYPE "subscription_tier" AS ENUM ('FREE', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'LEAD_ASSESSOR', 'ASSESSOR', 'REVIEWER', 'STAKEHOLDER');

-- CreateEnum
CREATE TYPE "asset_type" AS ENUM ('SITE', 'BUILDING', 'FLOOR', 'ROOM', 'ZONE', 'EQUIPMENT', 'VEHICLE', 'PERSON', 'INFORMATION', 'IP', 'PROCESS', 'REPUTATION', 'CONTINUITY');

-- CreateEnum
CREATE TYPE "asset_category" AS ENUM ('TANGIBLE', 'INTANGIBLE');

-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('ACTIVE', 'DECOMMISSIONED', 'UNDER_REVIEW', 'COMPROMISED');

-- CreateEnum
CREATE TYPE "cluster_type" AS ENUM ('OPERATIONAL', 'SPATIAL', 'LOGICAL', 'TEMPORAL');

-- CreateEnum
CREATE TYPE "criticality_mode" AS ENUM ('HIGHEST', 'AVERAGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "propagation_mode" AS ENUM ('CASCADE_DOWN', 'CASCADE_UP', 'BIDIRECTIONAL', 'NONE');

-- CreateEnum
CREATE TYPE "relationship_type" AS ENUM ('DEPENDS_ON', 'PROTECTS', 'SERVES', 'CONTAINS', 'COMMUNICATES_WITH', 'ADJACENT_TO', 'SUPPLIES');

-- CreateEnum
CREATE TYPE "rel_direction" AS ENUM ('UNIDIRECTIONAL', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "assessment_type" AS ENUM ('FULL_SRA', 'VULNERABILITY_ASSESSMENT', 'THREAT_ASSESSMENT', 'SURVEY', 'AUDIT');

-- CreateEnum
CREATE TYPE "assessment_status" AS ENUM ('DRAFT', 'STEP_1_ASSETS', 'STEP_2_THREATS', 'STEP_3_LIKELIHOOD', 'STEP_4_IMPACT', 'STEP_5_IRV', 'STEP_6_VULNERABILITY', 'STEP_7_TREATMENT', 'REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "adversary_type" AS ENUM ('CRIMINAL', 'TERRORIST', 'INSIDER', 'COMPETITOR', 'ACTIVIST', 'NATION_STATE', 'OPPORTUNIST', 'NATURAL');

-- CreateEnum
CREATE TYPE "action_type" AS ENUM ('THEFT', 'DAMAGE', 'DISRUPTION', 'ESPIONAGE', 'SABOTAGE', 'ASSAULT', 'INTRUSION', 'FRAUD', 'ARSON', 'BOMB', 'CYBER', 'NATURAL_DISASTER');

-- CreateEnum
CREATE TYPE "irv_band" AS ENUM ('NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH', 'EXTREME');

-- CreateEnum
CREATE TYPE "vulnerability_rating" AS ENUM ('STRONG', 'BASELINE', 'BARELY_ADEQUATE', 'INADEQUATE');

-- CreateEnum
CREATE TYPE "risk_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'HIGHEST');

-- CreateEnum
CREATE TYPE "relevance" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "shape_category" AS ENUM ('SECURITY_PROGRAMME', 'HUMAN', 'ARCHITECTURAL', 'PROCEDURAL', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "pps_function" AS ENUM ('DETER', 'DETECT', 'DELAY', 'DENY', 'DISRUPT', 'DEFEAT', 'RECOVER');

-- CreateEnum
CREATE TYPE "protection_domain" AS ENUM ('PERIMETER', 'BUILDING', 'ACCESS', 'SURVEILLANCE', 'INFORMATION', 'PERSONNEL', 'COUNTERTERRORISM');

-- CreateEnum
CREATE TYPE "implementation_status" AS ENUM ('PROPOSED', 'APPROVED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "tear_strategy" AS ENUM ('TRANSFER', 'ELIMINATE', 'ACCEPT', 'REDUCE');

-- CreateEnum
CREATE TYPE "action_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "subscription_tier" "subscription_tier" NOT NULL DEFAULT 'FREE',
    "settings" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'ASSESSOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "asset_type" "asset_type" NOT NULL,
    "category" "asset_category" NOT NULL,
    "description" TEXT,
    "criticality" SMALLINT NOT NULL DEFAULT 3,
    "status" "asset_status" NOT NULL DEFAULT 'ACTIVE',
    "location" JSONB,
    "metadata" JSONB DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_template_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_clusters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "cluster_type" "cluster_type" NOT NULL,
    "criticality_mode" "criticality_mode" NOT NULL DEFAULT 'HIGHEST',
    "status_propagation" "propagation_mode" NOT NULL DEFAULT 'CASCADE_UP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_cluster_memberships" (
    "cluster_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "role_in_cluster" VARCHAR(100),
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "dependency_weight" DECIMAL(3,2) NOT NULL DEFAULT 0.5,

    CONSTRAINT "asset_cluster_memberships_pkey" PRIMARY KEY ("cluster_id","asset_id")
);

-- CreateTable
CREATE TABLE "asset_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_asset_id" UUID NOT NULL,
    "target_asset_id" UUID NOT NULL,
    "relationship_type" "relationship_type" NOT NULL,
    "direction" "rel_direction" NOT NULL DEFAULT 'UNIDIRECTIONAL',
    "impact_propagation" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,

    CONSTRAINT "asset_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID,
    "cluster_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "assessment_type" "assessment_type" NOT NULL DEFAULT 'FULL_SRA',
    "status" "assessment_status" NOT NULL DEFAULT 'DRAFT',
    "current_step" SMALLINT NOT NULL DEFAULT 1,
    "lead_assessor_id" UUID NOT NULL,
    "review_status" "review_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "review_notes" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "next_review_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threats" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "target_asset_id" UUID NOT NULL,
    "adversary_type" "adversary_type" NOT NULL,
    "adversary_description" TEXT,
    "action_type" "action_type" NOT NULL,
    "action_description" TEXT,
    "location_context" TEXT,
    "facilitating_factors" TEXT,
    "time_context" TEXT,
    "dbt_reference_id" UUID,
    "likelihood_score" SMALLINT,
    "likelihood_rationale" TEXT,
    "impact_score" SMALLINT,
    "impact_rationale" TEXT,
    "impact_breakdown" JSONB,
    "irv" "irv_band",
    "vulnerability_rating" "vulnerability_rating",
    "vulnerability_rationale" TEXT,
    "risk_treatment_priority" "risk_priority",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_basis_threats" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "scenario_name" VARCHAR(255) NOT NULL,
    "adversary_profile" JSONB NOT NULL,
    "typical_actions" TEXT[],
    "target_types" TEXT[],
    "indicators" TEXT[],
    "recommended_countermeasures" JSONB,
    "csmp_unit_reference" VARCHAR(50),
    "source_template_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_basis_threats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_packages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "industry" VARCHAR(100),
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "region_scope" VARCHAR(100),
    "description" TEXT,
    "compliance_refs" TEXT[],
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_modules" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_templates" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "asset_type" "asset_type" NOT NULL,
    "category" "asset_category" NOT NULL,
    "default_criticality" SMALLINT NOT NULL DEFAULT 3,
    "description" TEXT,
    "parent_slug" VARCHAR(150),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attributes" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threat_templates" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "scenario_name" VARCHAR(255) NOT NULL,
    "adversary_type" "adversary_type" NOT NULL,
    "action_type" "action_type" NOT NULL,
    "adversary_profile" JSONB,
    "typical_actions" TEXT[],
    "target_asset_types" TEXT[],
    "indicators" TEXT[],
    "recommended_countermeasures" JSONB,
    "suggested_likelihood" SMALLINT,
    "csmp_unit_reference" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "threat_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_template_threats" (
    "asset_template_id" UUID NOT NULL,
    "threat_template_id" UUID NOT NULL,
    "relevance" "relevance" NOT NULL DEFAULT 'MEDIUM',
    "rationale" TEXT,

    CONSTRAINT "asset_template_threats_pkey" PRIMARY KEY ("asset_template_id","threat_template_id")
);

-- CreateTable
CREATE TABLE "package_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_by" UUID NOT NULL,
    "assets_created" INTEGER NOT NULL DEFAULT 0,
    "dbts_created" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "package_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applied_modules" (
    "application_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "assets_created" INTEGER NOT NULL DEFAULT 0,
    "dbts_created" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "applied_modules_pkey" PRIMARY KEY ("application_id","module_id")
);

-- CreateTable
CREATE TABLE "countermeasures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "shape_category" "shape_category" NOT NULL,
    "pps_functions" "pps_function"[],
    "domain" "protection_domain" NOT NULL,
    "implementation_status" "implementation_status" NOT NULL DEFAULT 'PROPOSED',
    "cost_estimate" DECIMAL(12,2),
    "annual_cost" DECIMAL(12,2),
    "effectiveness_rating" "vulnerability_rating",
    "assigned_to_asset_id" UUID,
    "assigned_to_threat_id" UUID,
    "tear_strategy" "tear_strategy",
    "alarp_justification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countermeasures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_plans" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "threat_id" UUID NOT NULL,
    "risk_priority" "risk_priority" NOT NULL,
    "action_required" TEXT NOT NULL,
    "responsible_person" VARCHAR(255),
    "target_date" DATE,
    "status" "action_status" NOT NULL DEFAULT 'PENDING',
    "completion_date" DATE,
    "evidence" TEXT,
    "roi_estimate" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "assets_tenant_id_idx" ON "assets"("tenant_id");

-- CreateIndex
CREATE INDEX "assets_tenant_id_asset_type_idx" ON "assets"("tenant_id", "asset_type");

-- CreateIndex
CREATE INDEX "assets_tenant_id_parent_id_idx" ON "assets"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "asset_clusters_tenant_id_idx" ON "asset_clusters"("tenant_id");

-- CreateIndex
CREATE INDEX "asset_relationships_tenant_id_idx" ON "asset_relationships"("tenant_id");

-- CreateIndex
CREATE INDEX "asset_relationships_source_asset_id_idx" ON "asset_relationships"("source_asset_id");

-- CreateIndex
CREATE INDEX "asset_relationships_target_asset_id_idx" ON "asset_relationships"("target_asset_id");

-- CreateIndex
CREATE INDEX "assessments_tenant_id_idx" ON "assessments"("tenant_id");

-- CreateIndex
CREATE INDEX "assessments_tenant_id_status_idx" ON "assessments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "threats_assessment_id_idx" ON "threats"("assessment_id");

-- CreateIndex
CREATE INDEX "design_basis_threats_tenant_id_idx" ON "design_basis_threats"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_packages_slug_key" ON "template_packages"("slug");

-- CreateIndex
CREATE INDEX "template_modules_package_id_idx" ON "template_modules"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_modules_package_id_slug_key" ON "template_modules"("package_id", "slug");

-- CreateIndex
CREATE INDEX "asset_templates_asset_type_idx" ON "asset_templates"("asset_type");

-- CreateIndex
CREATE INDEX "asset_templates_category_idx" ON "asset_templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "asset_templates_module_id_slug_key" ON "asset_templates"("module_id", "slug");

-- CreateIndex
CREATE INDEX "threat_templates_adversary_type_idx" ON "threat_templates"("adversary_type");

-- CreateIndex
CREATE UNIQUE INDEX "threat_templates_module_id_slug_key" ON "threat_templates"("module_id", "slug");

-- CreateIndex
CREATE INDEX "package_applications_tenant_id_idx" ON "package_applications"("tenant_id");

-- CreateIndex
CREATE INDEX "countermeasures_tenant_id_idx" ON "countermeasures"("tenant_id");

-- CreateIndex
CREATE INDEX "countermeasures_tenant_id_shape_category_idx" ON "countermeasures"("tenant_id", "shape_category");

-- CreateIndex
CREATE INDEX "action_plans_assessment_id_idx" ON "action_plans"("assessment_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "asset_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_clusters" ADD CONSTRAINT "asset_clusters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_cluster_memberships" ADD CONSTRAINT "asset_cluster_memberships_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "asset_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_cluster_memberships" ADD CONSTRAINT "asset_cluster_memberships_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_target_asset_id_fkey" FOREIGN KEY ("target_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "asset_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_lead_assessor_id_fkey" FOREIGN KEY ("lead_assessor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threats" ADD CONSTRAINT "threats_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threats" ADD CONSTRAINT "threats_target_asset_id_fkey" FOREIGN KEY ("target_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threats" ADD CONSTRAINT "threats_dbt_reference_id_fkey" FOREIGN KEY ("dbt_reference_id") REFERENCES "design_basis_threats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_basis_threats" ADD CONSTRAINT "design_basis_threats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_basis_threats" ADD CONSTRAINT "design_basis_threats_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "threat_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_modules" ADD CONSTRAINT "template_modules_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "template_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_templates" ADD CONSTRAINT "asset_templates_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "template_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_templates" ADD CONSTRAINT "threat_templates_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "template_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_template_threats" ADD CONSTRAINT "asset_template_threats_asset_template_id_fkey" FOREIGN KEY ("asset_template_id") REFERENCES "asset_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_template_threats" ADD CONSTRAINT "asset_template_threats_threat_template_id_fkey" FOREIGN KEY ("threat_template_id") REFERENCES "threat_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_applications" ADD CONSTRAINT "package_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_applications" ADD CONSTRAINT "package_applications_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "template_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_applications" ADD CONSTRAINT "package_applications_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_modules" ADD CONSTRAINT "applied_modules_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "package_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_modules" ADD CONSTRAINT "applied_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "template_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countermeasures" ADD CONSTRAINT "countermeasures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countermeasures" ADD CONSTRAINT "countermeasures_assigned_to_asset_id_fkey" FOREIGN KEY ("assigned_to_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countermeasures" ADD CONSTRAINT "countermeasures_assigned_to_threat_id_fkey" FOREIGN KEY ("assigned_to_threat_id") REFERENCES "threats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_threat_id_fkey" FOREIGN KEY ("threat_id") REFERENCES "threats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

