-- v2.2: initiator-locked demount request fields

ALTER TABLE `demount_tasks`
  ADD COLUMN `requested_resolution` ENUM('FULL_DEMOUNT', 'REPLACE_SIM', 'REMOVE_SIM_ONLY') NULL,
  ADD COLUMN `requested_reason` TEXT NULL,
  ADD COLUMN `requested_removed_sim_disposition` ENUM('MARK_DEFECTIVE', 'RETURN_TO_STOCK') NULL,
  ADD COLUMN `requested_meter_demount_category` ENUM('METER_FAULTY', 'TEMPORARY_REMOVAL', 'MAINTENANCE', 'OTHER') NULL;

