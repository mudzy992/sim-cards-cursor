-- v2.2: meter flag for open demount task

ALTER TABLE `meters`
  ADD COLUMN `has_open_demount_task` BOOLEAN NOT NULL DEFAULT false;

