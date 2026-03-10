-- CreateTable
CREATE TABLE `recipient_group_users` (
    `id` VARCHAR(191) NOT NULL,
    `recipient_group_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `recipient_group_users_recipient_group_id_user_id_key`(`recipient_group_id`, `user_id`),
    INDEX `recipient_group_users_recipient_group_id_idx`(`recipient_group_id`),
    INDEX `recipient_group_users_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recipient_group_users` ADD CONSTRAINT `recipient_group_users_recipient_group_id_fkey` FOREIGN KEY (`recipient_group_id`) REFERENCES `recipient_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recipient_group_users` ADD CONSTRAINT `recipient_group_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
