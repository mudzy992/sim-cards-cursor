-- CreateTable
CREATE TABLE `install_tasks` (
  `id` VARCHAR(191) NOT NULL,
  `meter_id` VARCHAR(191) NOT NULL,
  `assigned_to_id` VARCHAR(191) NOT NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `notes` TEXT NULL,
  `installation_record_id` VARCHAR(191) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `install_tasks_assigned_to_id_idx`(`assigned_to_id`),
  INDEX `install_tasks_status_idx`(`status`),
  INDEX `install_tasks_meter_id_idx`(`meter_id`),
  UNIQUE INDEX `install_tasks_installation_record_id_key`(`installation_record_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `install_tasks` ADD CONSTRAINT `install_tasks_meter_id_fkey` FOREIGN KEY (`meter_id`) REFERENCES `meters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `install_tasks` ADD CONSTRAINT `install_tasks_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `install_tasks` ADD CONSTRAINT `install_tasks_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `install_tasks` ADD CONSTRAINT `install_tasks_installation_record_id_fkey` FOREIGN KEY (`installation_record_id`) REFERENCES `installation_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

