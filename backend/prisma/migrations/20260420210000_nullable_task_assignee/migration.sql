-- Make task assignee nullable to support "return to initiator"

ALTER TABLE `demount_tasks` MODIFY `assigned_to_id` VARCHAR(191) NULL;
ALTER TABLE `install_tasks` MODIFY `assigned_to_id` VARCHAR(191) NULL;

