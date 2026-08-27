-- AlterTable
ALTER TABLE `sim_cards` MODIFY `status` ENUM('AVAILABLE', 'ASSIGNED', 'INSTALLED', 'DEMOUNTED', 'DEFECTIVE', 'RETURNED', 'DEACTIVATED') NOT NULL DEFAULT 'AVAILABLE';

-- CreateTable
CREATE TABLE `push_campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `scope_distribution_id` VARCHAR(191) NULL,
    `scope_branch_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `deep_link` VARCHAR(191) NULL,
    `audience_type` ENUM('ALL', 'FILTER', 'USER') NOT NULL,
    `filters` JSON NULL,
    `target_user_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SENDING', 'SENT', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `sent_at` DATETIME(3) NULL,

    INDEX `push_campaigns_created_by_id_idx`(`created_by_id`),
    INDEX `push_campaigns_scope_distribution_id_idx`(`scope_distribution_id`),
    INDEX `push_campaigns_scope_branch_id_idx`(`scope_branch_id`),
    INDEX `push_campaigns_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `push_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `push_token_id` VARCHAR(191) NOT NULL,
    `expo_ticket_id` VARCHAR(191) NULL,
    `status` ENUM('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'INVALID_TOKEN') NOT NULL DEFAULT 'QUEUED',
    `error_code` VARCHAR(191) NULL,
    `error_message` TEXT NULL,
    `receipt_checked_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `push_deliveries_campaign_id_idx`(`campaign_id`),
    INDEX `push_deliveries_user_id_idx`(`user_id`),
    INDEX `push_deliveries_push_token_id_idx`(`push_token_id`),
    INDEX `push_deliveries_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `push_deliveries_campaign_id_push_token_id_key`(`campaign_id`, `push_token_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mobile_app_releases` (
    `id` VARCHAR(191) NOT NULL,
    `platform` ENUM('ANDROID') NOT NULL DEFAULT 'ANDROID',
    `version_name` VARCHAR(191) NOT NULL,
    `version_code` INTEGER NOT NULL,
    `apk_path` TEXT NOT NULL,
    `apk_file_name` VARCHAR(191) NOT NULL,
    `apk_sha256` VARCHAR(191) NOT NULL,
    `release_notes` TEXT NULL,
    `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `mandatory_after_at` DATETIME(3) NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `mobile_app_releases_platform_published_at_idx`(`platform`, `published_at`),
    UNIQUE INDEX `mobile_app_releases_platform_version_code_key`(`platform`, `version_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `push_campaigns` ADD CONSTRAINT `push_campaigns_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_campaigns` ADD CONSTRAINT `push_campaigns_scope_distribution_id_fkey` FOREIGN KEY (`scope_distribution_id`) REFERENCES `distributions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_campaigns` ADD CONSTRAINT `push_campaigns_scope_branch_id_fkey` FOREIGN KEY (`scope_branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_deliveries` ADD CONSTRAINT `push_deliveries_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `push_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_deliveries` ADD CONSTRAINT `push_deliveries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_deliveries` ADD CONSTRAINT `push_deliveries_push_token_id_fkey` FOREIGN KEY (`push_token_id`) REFERENCES `push_tokens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mobile_app_releases` ADD CONSTRAINT `mobile_app_releases_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
