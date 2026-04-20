-- v2.2: demontaža ishod SIM + kategorija brojila; meter last category

ALTER TABLE `meters`
  ADD COLUMN `last_sim_demount_category` ENUM('METER_FAULTY', 'TEMPORARY_REMOVAL', 'MAINTENANCE', 'OTHER') NULL;

ALTER TABLE `demount_tasks`
  ADD COLUMN `removed_sim_disposition` ENUM('MARK_DEFECTIVE', 'RETURN_TO_STOCK') NULL,
  ADD COLUMN `meter_demount_category` ENUM('METER_FAULTY', 'TEMPORARY_REMOVAL', 'MAINTENANCE', 'OTHER') NULL;
