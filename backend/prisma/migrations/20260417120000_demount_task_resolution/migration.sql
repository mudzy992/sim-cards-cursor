-- Demount task: task type, completion resolution, completion reason

ALTER TABLE `demount_tasks`
  ADD COLUMN `task_type` ENUM('DEMOUNT_METER', 'DEMOUNT_SIM') NOT NULL DEFAULT 'DEMOUNT_SIM',
  ADD COLUMN `completion_resolution` ENUM('FULL_DEMOUNT', 'REPLACE_SIM', 'REMOVE_SIM_ONLY') NULL,
  ADD COLUMN `completion_reason` TEXT NULL;
