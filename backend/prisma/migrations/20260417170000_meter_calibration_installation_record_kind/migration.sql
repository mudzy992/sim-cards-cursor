-- AlterTable
ALTER TABLE `meters` ADD COLUMN `calibration_year` INTEGER NULL;

-- AlterTable
ALTER TABLE `installation_records` ADD COLUMN `kind` ENUM('NEW_CONNECTION', 'METER_REPLACEMENT') NOT NULL DEFAULT 'NEW_CONNECTION',
    ADD COLUMN `demounted_meter_snapshot` JSON NULL;
