-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'DIST_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SimCardStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'INSTALLED', 'DEMOUNTED', 'DEFECTIVE', 'RETURNED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "MeterSimCardState" AS ENUM ('INSTALLED', 'NO_SIM');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'DEFECTIVE', 'IN_CALIBRATION', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('SINGLE_PHASE', 'THREE_PHASE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'SENT', 'SEND_FAILED', 'SEP_ACTIVATED', 'LEGACY_COMPLETED');

-- CreateEnum
CREATE TYPE "InstallationRecordKind" AS ENUM ('NEW_CONNECTION', 'METER_REPLACEMENT');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PushCampaignAudienceType" AS ENUM ('ALL', 'FILTER', 'USER');

-- CreateEnum
CREATE TYPE "PushCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'INVALID_TOKEN');

-- CreateEnum
CREATE TYPE "MobileAppPlatform" AS ENUM ('ANDROID');

-- CreateEnum
CREATE TYPE "DemountTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DemountTaskType" AS ENUM ('DEMOUNT_METER', 'DEMOUNT_SIM');

-- CreateEnum
CREATE TYPE "DemountCompletionResolution" AS ENUM ('FULL_DEMOUNT', 'REPLACE_SIM', 'REMOVE_SIM_ONLY');

-- CreateEnum
CREATE TYPE "RemovedSimDisposition" AS ENUM ('MARK_DEFECTIVE', 'RETURN_TO_STOCK');

-- CreateEnum
CREATE TYPE "MeterDemountCategory" AS ENUM ('METER_FAULTY', 'TEMPORARY_REMOVAL', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "InstallTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeterFieldType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE');

-- CreateTable
CREATE TABLE "distributions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "distribution_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "avatar" TEXT,
    "refresh_token" TEXT,
    "distribution_id" TEXT,
    "branch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "received_date" TIMESTAMP(3) NOT NULL,
    "total_cards" INTEGER NOT NULL DEFAULT 0,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "original_file_name" TEXT,
    "distribution_id" TEXT,
    "imported_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_cards" (
    "id" TEXT NOT NULL,
    "iccid" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "public_ip_address" TEXT,
    "status" "SimCardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "phone_number" TEXT,
    "apn" TEXT,
    "shipment_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sim_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meters" (
    "id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "branch_id" TEXT,
    "meter_type_definition_id" TEXT NOT NULL,
    "status" "MeterStatus" NOT NULL DEFAULT 'ACTIVE',
    "sim_card_id" TEXT,
    "sim_card_state" "MeterSimCardState" NOT NULL DEFAULT 'NO_SIM',
    "no_sim_reason" TEXT,
    "last_sim_demount_category" "MeterDemountCategory",
    "is_demounted_from_location" BOOLEAN NOT NULL DEFAULT false,
    "has_open_install_task" BOOLEAN NOT NULL DEFAULT false,
    "has_open_demount_task" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER,
    "calibration_year" INTEGER,
    "notes" TEXT,
    "installation_address" TEXT,
    "installation_date" TIMESTAMP(3),
    "city" TEXT,
    "municipality" TEXT,
    "measuring_point" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "dynamic_field_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_type_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "type" "MeterType" NOT NULL DEFAULT 'SINGLE_PHASE',
    "max_current" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_type_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_records" (
    "id" TEXT NOT NULL,
    "record_number" TEXT NOT NULL,
    "client_request_id" TEXT,
    "kind" "InstallationRecordKind" NOT NULL DEFAULT 'NEW_CONNECTION',
    "demounted_meter_snapshot" JSONB,
    "meter_id" TEXT NOT NULL,
    "sim_card_id" TEXT,
    "installed_by_id" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "sent_to_email" TEXT,
    "sent_at" TIMESTAMP(3),
    "pdf_path" TEXT,
    "notes" TEXT,
    "photos" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "device_id" TEXT,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_campaigns" (
    "id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "scope_distribution_id" TEXT,
    "scope_branch_id" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "deep_link" TEXT,
    "audience_type" "PushCampaignAudienceType" NOT NULL,
    "filters" JSONB,
    "target_user_id" TEXT,
    "status" "PushCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "push_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_deliveries" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "push_token_id" TEXT NOT NULL,
    "expo_ticket_id" TEXT,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "error_code" TEXT,
    "error_message" TEXT,
    "receipt_checked_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_app_releases" (
    "id" TEXT NOT NULL,
    "platform" "MobileAppPlatform" NOT NULL DEFAULT 'ANDROID',
    "version_name" TEXT NOT NULL,
    "version_code" INTEGER NOT NULL,
    "apk_path" TEXT NOT NULL,
    "apk_file_name" TEXT NOT NULL,
    "apk_sha256" TEXT NOT NULL,
    "release_notes" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mandatory_after_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_events" (
    "id" TEXT NOT NULL,
    "sim_card_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "record_id" TEXT,
    "user_id" TEXT,
    "distribution_id" TEXT,
    "branch_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demount_tasks" (
    "id" TEXT NOT NULL,
    "meter_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "status" "DemountTaskStatus" NOT NULL DEFAULT 'PENDING',
    "task_type" "DemountTaskType" NOT NULL DEFAULT 'DEMOUNT_SIM',
    "requested_resolution" "DemountCompletionResolution",
    "requested_reason" TEXT,
    "requested_removed_sim_disposition" "RemovedSimDisposition",
    "requested_meter_demount_category" "MeterDemountCategory",
    "completion_resolution" "DemountCompletionResolution",
    "completion_reason" TEXT,
    "removed_sim_disposition" "RemovedSimDisposition",
    "meter_demount_category" "MeterDemountCategory",
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demount_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "install_tasks" (
    "id" TEXT NOT NULL,
    "meter_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "status" "InstallTaskStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "installation_record_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "install_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_moderators" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_moderators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_email_recipients" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_email_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_type_fields" (
    "id" TEXT NOT NULL,
    "meter_type_definition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" "MeterFieldType" NOT NULL DEFAULT 'STRING',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_operator_fillable" BOOLEAN NOT NULL DEFAULT false,
    "default_value" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_type_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "distributions_code_key" ON "distributions"("code");

-- CreateIndex
CREATE INDEX "branches_distribution_id_idx" ON "branches"("distribution_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_distribution_id_code_key" ON "branches"("distribution_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sim_cards_iccid_key" ON "sim_cards"("iccid");

-- CreateIndex
CREATE INDEX "sim_cards_iccid_idx" ON "sim_cards"("iccid");

-- CreateIndex
CREATE INDEX "sim_cards_ip_address_idx" ON "sim_cards"("ip_address");

-- CreateIndex
CREATE INDEX "sim_cards_status_idx" ON "sim_cards"("status");

-- CreateIndex
CREATE UNIQUE INDEX "meters_serial_number_key" ON "meters"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "meters_sim_card_id_key" ON "meters"("sim_card_id");

-- CreateIndex
CREATE INDEX "meters_serial_number_idx" ON "meters"("serial_number");

-- CreateIndex
CREATE INDEX "meters_meter_type_definition_id_idx" ON "meters"("meter_type_definition_id");

-- CreateIndex
CREATE INDEX "meters_sim_card_id_idx" ON "meters"("sim_card_id");

-- CreateIndex
CREATE INDEX "meters_status_idx" ON "meters"("status");

-- CreateIndex
CREATE UNIQUE INDEX "installation_records_record_number_key" ON "installation_records"("record_number");

-- CreateIndex
CREATE UNIQUE INDEX "installation_records_client_request_id_key" ON "installation_records"("client_request_id");

-- CreateIndex
CREATE INDEX "installation_records_record_number_idx" ON "installation_records"("record_number");

-- CreateIndex
CREATE INDEX "installation_records_status_idx" ON "installation_records"("status");

-- CreateIndex
CREATE INDEX "installation_records_meter_id_idx" ON "installation_records"("meter_id");

-- CreateIndex
CREATE INDEX "installation_records_sim_card_id_idx" ON "installation_records"("sim_card_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_entity_entity_id_idx" ON "activity_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_campaigns_created_by_id_idx" ON "push_campaigns"("created_by_id");

-- CreateIndex
CREATE INDEX "push_campaigns_scope_distribution_id_idx" ON "push_campaigns"("scope_distribution_id");

-- CreateIndex
CREATE INDEX "push_campaigns_scope_branch_id_idx" ON "push_campaigns"("scope_branch_id");

-- CreateIndex
CREATE INDEX "push_campaigns_status_created_at_idx" ON "push_campaigns"("status", "created_at");

-- CreateIndex
CREATE INDEX "push_deliveries_campaign_id_idx" ON "push_deliveries"("campaign_id");

-- CreateIndex
CREATE INDEX "push_deliveries_user_id_idx" ON "push_deliveries"("user_id");

-- CreateIndex
CREATE INDEX "push_deliveries_push_token_id_idx" ON "push_deliveries"("push_token_id");

-- CreateIndex
CREATE INDEX "push_deliveries_status_created_at_idx" ON "push_deliveries"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_deliveries_campaign_id_push_token_id_key" ON "push_deliveries"("campaign_id", "push_token_id");

-- CreateIndex
CREATE INDEX "mobile_app_releases_platform_published_at_idx" ON "mobile_app_releases"("platform", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_app_releases_platform_version_code_key" ON "mobile_app_releases"("platform", "version_code");

-- CreateIndex
CREATE INDEX "sim_events_sim_card_id_idx" ON "sim_events"("sim_card_id");

-- CreateIndex
CREATE INDEX "sim_events_type_idx" ON "sim_events"("type");

-- CreateIndex
CREATE INDEX "sim_events_created_at_idx" ON "sim_events"("created_at");

-- CreateIndex
CREATE INDEX "demount_tasks_assigned_to_id_idx" ON "demount_tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "demount_tasks_status_idx" ON "demount_tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "install_tasks_installation_record_id_key" ON "install_tasks"("installation_record_id");

-- CreateIndex
CREATE INDEX "install_tasks_assigned_to_id_idx" ON "install_tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "install_tasks_status_idx" ON "install_tasks"("status");

-- CreateIndex
CREATE INDEX "install_tasks_meter_id_idx" ON "install_tasks"("meter_id");

-- CreateIndex
CREATE INDEX "branch_moderators_user_id_idx" ON "branch_moderators"("user_id");

-- CreateIndex
CREATE INDEX "branch_moderators_branch_id_idx" ON "branch_moderators"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_moderators_user_id_branch_id_key" ON "branch_moderators"("user_id", "branch_id");

-- CreateIndex
CREATE INDEX "branch_email_recipients_branch_id_idx" ON "branch_email_recipients"("branch_id");

-- CreateIndex
CREATE INDEX "meter_type_fields_meter_type_definition_id_idx" ON "meter_type_fields"("meter_type_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_cards" ADD CONSTRAINT "sim_cards_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_cards" ADD CONSTRAINT "sim_cards_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_meter_type_definition_id_fkey" FOREIGN KEY ("meter_type_definition_id") REFERENCES "meter_type_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_sim_card_id_fkey" FOREIGN KEY ("sim_card_id") REFERENCES "sim_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_records" ADD CONSTRAINT "installation_records_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_records" ADD CONSTRAINT "installation_records_sim_card_id_fkey" FOREIGN KEY ("sim_card_id") REFERENCES "sim_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_records" ADD CONSTRAINT "installation_records_installed_by_id_fkey" FOREIGN KEY ("installed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_records" ADD CONSTRAINT "installation_records_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_scope_distribution_id_fkey" FOREIGN KEY ("scope_distribution_id") REFERENCES "distributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_scope_branch_id_fkey" FOREIGN KEY ("scope_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "push_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_push_token_id_fkey" FOREIGN KEY ("push_token_id") REFERENCES "push_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_app_releases" ADD CONSTRAINT "mobile_app_releases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_events" ADD CONSTRAINT "sim_events_sim_card_id_fkey" FOREIGN KEY ("sim_card_id") REFERENCES "sim_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demount_tasks" ADD CONSTRAINT "demount_tasks_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demount_tasks" ADD CONSTRAINT "demount_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demount_tasks" ADD CONSTRAINT "demount_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "install_tasks" ADD CONSTRAINT "install_tasks_meter_id_fkey" FOREIGN KEY ("meter_id") REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "install_tasks" ADD CONSTRAINT "install_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "install_tasks" ADD CONSTRAINT "install_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "install_tasks" ADD CONSTRAINT "install_tasks_installation_record_id_fkey" FOREIGN KEY ("installation_record_id") REFERENCES "installation_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_moderators" ADD CONSTRAINT "branch_moderators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_moderators" ADD CONSTRAINT "branch_moderators_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_email_recipients" ADD CONSTRAINT "branch_email_recipients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_type_fields" ADD CONSTRAINT "meter_type_fields_meter_type_definition_id_fkey" FOREIGN KEY ("meter_type_definition_id") REFERENCES "meter_type_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

