-- v2.2: meter status for usability rules

ALTER TABLE `meters`
  ADD COLUMN `status` ENUM('ACTIVE', 'DEFECTIVE', 'IN_CALIBRATION') NOT NULL DEFAULT 'ACTIVE',
  ADD INDEX `meters_status_idx` (`status`);

