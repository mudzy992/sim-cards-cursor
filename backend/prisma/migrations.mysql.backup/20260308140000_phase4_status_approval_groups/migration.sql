-- AlterTable: Add type and distribution_id to recipient_groups
ALTER TABLE `recipient_groups` ADD COLUMN `type` ENUM('APPROVAL', 'PDF') NOT NULL DEFAULT 'PDF';
ALTER TABLE `recipient_groups` ADD COLUMN `distribution_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `recipient_groups_distribution_id_idx` ON `recipient_groups`(`distribution_id`);

-- AddForeignKey
ALTER TABLE `recipient_groups` ADD CONSTRAINT `recipient_groups_distribution_id_fkey` FOREIGN KEY (`distribution_id`) REFERENCES `distributions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: branch_approval_groups
CREATE TABLE `branch_approval_groups` (
    `id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `recipient_group_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `branch_approval_groups_branch_id_key`(`branch_id`),
    INDEX `branch_approval_groups_recipient_group_id_idx`(`recipient_group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `branch_approval_groups` ADD CONSTRAINT `branch_approval_groups_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `branch_approval_groups` ADD CONSTRAINT `branch_approval_groups_recipient_group_id_fkey` FOREIGN KEY (`recipient_group_id`) REFERENCES `recipient_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add new RecordStatus enum values first
ALTER TABLE `installation_records` MODIFY COLUMN `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SENT', 'SUBMIT_FAILED', 'WAITING_SEP_ACTIVATION', 'ACTIVATED_IN_SEP') NOT NULL DEFAULT 'DRAFT';

-- Migrate RecordStatus: APPROVED -> WAITING_SEP_ACTIVATION
UPDATE `installation_records` SET `status` = 'WAITING_SEP_ACTIVATION' WHERE `status` = 'APPROVED';

-- AlterTable: Remove APPROVED from RecordStatus enum
ALTER TABLE `installation_records` MODIFY COLUMN `status` ENUM('DRAFT', 'PENDING', 'SUBMIT_FAILED', 'REJECTED', 'WAITING_SEP_ACTIVATION', 'ACTIVATED_IN_SEP', 'SENT') NOT NULL DEFAULT 'DRAFT';
