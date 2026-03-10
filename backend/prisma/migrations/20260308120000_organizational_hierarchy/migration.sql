-- CreateTable
CREATE TABLE `distributions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `distributions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(191) NOT NULL,
    `distribution_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `branches_distribution_id_code_key`(`distribution_id`, `code`),
    INDEX `branches_distribution_id_idx`(`distribution_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `distribution_id` VARCHAR(191) NULL,
    ADD COLUMN `branch_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `meters` ADD COLUMN `branch_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `shipments` ADD COLUMN `distribution_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `users_distribution_id_idx` ON `users`(`distribution_id`);
CREATE INDEX `users_branch_id_idx` ON `users`(`branch_id`);

-- CreateIndex
CREATE INDEX `meters_branch_id_idx` ON `meters`(`branch_id`);

-- CreateIndex
CREATE INDEX `shipments_distribution_id_idx` ON `shipments`(`distribution_id`);

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_distribution_id_fkey` FOREIGN KEY (`distribution_id`) REFERENCES `distributions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_distribution_id_fkey` FOREIGN KEY (`distribution_id`) REFERENCES `distributions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meters` ADD CONSTRAINT `meters_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_distribution_id_fkey` FOREIGN KEY (`distribution_id`) REFERENCES `distributions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
