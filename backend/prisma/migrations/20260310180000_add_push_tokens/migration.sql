CREATE TABLE `push_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NULL,
  `device_id` VARCHAR(191) NULL,
  `is_valid` BOOLEAN NOT NULL DEFAULT true,
  `last_used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  CONSTRAINT `push_tokens_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `push_tokens_token_key` ON `push_tokens`(`token`);
CREATE INDEX `push_tokens_user_id_idx` ON `push_tokens`(`user_id`);

ALTER TABLE `push_tokens`
  ADD CONSTRAINT `push_tokens_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

