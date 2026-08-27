CREATE TABLE `sim_events` (
  `id` VARCHAR(191) NOT NULL,
  `sim_card_id` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `record_id` VARCHAR(191) NULL,
  `user_id` VARCHAR(191) NULL,
  `distribution_id` VARCHAR(191) NULL,
  `branch_id` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `sim_events_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `sim_events_sim_card_id_idx` ON `sim_events`(`sim_card_id`);
CREATE INDEX `sim_events_type_idx` ON `sim_events`(`type`);
CREATE INDEX `sim_events_created_at_idx` ON `sim_events`(`created_at`);

ALTER TABLE `sim_events`
  ADD CONSTRAINT `sim_events_sim_card_id_fkey`
  FOREIGN KEY (`sim_card_id`) REFERENCES `sim_cards`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

