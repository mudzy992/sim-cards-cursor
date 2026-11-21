-- Add missing PostgreSQL indexes on sim_cards for shipment lookups, user assignments, and 8,500+ Excel duplicate checks
CREATE INDEX IF NOT EXISTS "sim_cards_public_ip_address_idx" ON "sim_cards"("public_ip_address");
CREATE INDEX IF NOT EXISTS "sim_cards_phone_number_idx" ON "sim_cards"("phone_number");
CREATE INDEX IF NOT EXISTS "sim_cards_shipment_id_idx" ON "sim_cards"("shipment_id");
CREATE INDEX IF NOT EXISTS "sim_cards_assigned_to_id_idx" ON "sim_cards"("assigned_to_id");
