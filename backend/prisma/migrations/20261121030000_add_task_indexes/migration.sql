-- Run 5 (P2-1): Add indexes on demount_tasks and install_tasks for list, meter lookup, and active operator queues
CREATE INDEX IF NOT EXISTS "demount_tasks_meter_id_idx" ON "demount_tasks"("meter_id");
CREATE INDEX IF NOT EXISTS "demount_tasks_created_by_id_idx" ON "demount_tasks"("created_by_id");
CREATE INDEX IF NOT EXISTS "demount_tasks_assigned_to_id_status_idx" ON "demount_tasks"("assigned_to_id", "status");

CREATE INDEX IF NOT EXISTS "install_tasks_created_by_id_idx" ON "install_tasks"("created_by_id");
CREATE INDEX IF NOT EXISTS "install_tasks_assigned_to_id_status_idx" ON "install_tasks"("assigned_to_id", "status");
