-- Add indexes on installation_records(installed_by_id, created_at) for faster sorting and mobile My Records queries
CREATE INDEX IF NOT EXISTS "installation_records_installed_by_id_idx" ON "installation_records"("installed_by_id");
CREATE INDEX IF NOT EXISTS "installation_records_created_at_idx" ON "installation_records"("created_at");
