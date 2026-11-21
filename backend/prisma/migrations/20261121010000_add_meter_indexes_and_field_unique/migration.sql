-- Add missing indexes on meters (branch_id, sim_card_state) and unique key on meter_type_fields (meter_type_definition_id, name)
CREATE INDEX IF NOT EXISTS "meters_branch_id_idx" ON "meters"("branch_id");
CREATE INDEX IF NOT EXISTS "meters_sim_card_state_idx" ON "meters"("sim_card_state");
CREATE UNIQUE INDEX IF NOT EXISTS "meter_type_fields_meter_type_definition_id_name_key"
  ON "meter_type_fields"("meter_type_definition_id", "name");
