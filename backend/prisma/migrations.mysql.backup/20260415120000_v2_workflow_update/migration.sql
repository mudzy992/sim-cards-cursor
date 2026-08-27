-- ============================================================
-- Migration: v2_workflow_update
-- Renames MODERATOR -> DIST_ADMIN, simplifies RecordStatus,
-- adds BranchModerator, BranchEmailRecipient, MeterTypeField
-- ============================================================

-- 1) UserRole enum: rename MODERATOR -> DIST_ADMIN
-- Step A: Add DIST_ADMIN to the enum (alongside MODERATOR)
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('SYSTEM_ADMIN', 'MODERATOR', 'DIST_ADMIN', 'USER') NOT NULL DEFAULT 'USER';

-- Step B: Migrate existing data
UPDATE `users` SET `role` = 'DIST_ADMIN' WHERE `role` = 'MODERATOR';

-- Step C: Remove MODERATOR from the enum
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('SYSTEM_ADMIN', 'DIST_ADMIN', 'USER') NOT NULL DEFAULT 'USER';


-- 2) RecordStatus enum: simplify workflow
-- Step A: Expand enum to include all old + new values
ALTER TABLE `installation_records` MODIFY COLUMN `status`
  ENUM('DRAFT', 'PENDING', 'SUBMIT_FAILED', 'REJECTED', 'WAITING_SEP_ACTIVATION', 'ACTIVATED_IN_SEP', 'SENT', 'SEND_FAILED', 'SEP_ACTIVATED', 'LEGACY_COMPLETED')
  NOT NULL DEFAULT 'DRAFT';

-- Step B: Migrate existing records in transitional statuses to LEGACY_COMPLETED
UPDATE `installation_records` SET `status` = 'LEGACY_COMPLETED'
  WHERE `status` IN ('PENDING', 'SUBMIT_FAILED', 'REJECTED', 'WAITING_SEP_ACTIVATION', 'ACTIVATED_IN_SEP');

-- Step C: Remove old approval-related statuses from enum
ALTER TABLE `installation_records` MODIFY COLUMN `status`
  ENUM('DRAFT', 'SENT', 'SEND_FAILED', 'SEP_ACTIVATED', 'LEGACY_COMPLETED')
  NOT NULL DEFAULT 'DRAFT';


-- 3) Add dynamic_field_values JSON column to meters
ALTER TABLE `meters` ADD COLUMN `dynamic_field_values` JSON NULL;


-- 4) Create branch_moderators table
CREATE TABLE `branch_moderators` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `branch_moderators_user_id_branch_id_key`(`user_id`, `branch_id`),
    INDEX `branch_moderators_user_id_idx`(`user_id`),
    INDEX `branch_moderators_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `branch_moderators` ADD CONSTRAINT `branch_moderators_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `branch_moderators` ADD CONSTRAINT `branch_moderators_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- 5) Create branch_email_recipients table
CREATE TABLE `branch_email_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `branch_email_recipients_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `branch_email_recipients` ADD CONSTRAINT `branch_email_recipients_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- 6) Create meter_type_fields table
CREATE TABLE `meter_type_fields` (
    `id` VARCHAR(191) NOT NULL,
    `meter_type_definition_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `field_type` ENUM('STRING', 'NUMBER', 'BOOLEAN', 'DATE') NOT NULL DEFAULT 'STRING',
    `is_required` BOOLEAN NOT NULL DEFAULT false,
    `is_operator_fillable` BOOLEAN NOT NULL DEFAULT false,
    `default_value` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `meter_type_fields_meter_type_definition_id_idx`(`meter_type_definition_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `meter_type_fields` ADD CONSTRAINT `meter_type_fields_meter_type_definition_id_fkey`
  FOREIGN KEY (`meter_type_definition_id`) REFERENCES `meter_type_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
