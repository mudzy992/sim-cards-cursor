-- DropForeignKey
ALTER TABLE `installation_records` DROP FOREIGN KEY `installation_records_meter_id_fkey`;

-- AddForeignKey
ALTER TABLE `installation_records` ADD CONSTRAINT `installation_records_meter_id_fkey` FOREIGN KEY (`meter_id`) REFERENCES `meters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
