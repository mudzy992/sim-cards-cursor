-- ============================================================
-- Migration: meter_sim_card_state
-- Adds explicit Meter.simCardState + noSimReason
-- ============================================================

-- 1) Add sim_card_state + no_sim_reason columns
ALTER TABLE `meters`
  ADD COLUMN `sim_card_state` ENUM('INSTALLED', 'NO_SIM') NOT NULL DEFAULT 'NO_SIM',
  ADD COLUMN `no_sim_reason` TEXT NULL;

-- 2) Backfill existing rows with installed SIM
UPDATE `meters`
  SET `sim_card_state` = 'INSTALLED'
  WHERE `sim_card_id` IS NOT NULL;

