-- Prevent duplicate open install tasks per meter
ALTER TABLE `meters`
  ADD COLUMN `has_open_install_task` BOOLEAN NOT NULL DEFAULT false;

-- Backfill from existing open install tasks
UPDATE `meters` m
SET m.`has_open_install_task` = true
WHERE EXISTS (
  SELECT 1
  FROM `install_tasks` it
  WHERE it.`meter_id` = m.`id`
    AND it.`status` IN ('PENDING', 'IN_PROGRESS')
);

