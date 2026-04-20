-- v2.2: InstallationRecord must snapshot SIM at creation time (do not depend on current Meter.simCardId)

ALTER TABLE `installation_records`
  ADD COLUMN `sim_card_id` VARCHAR(191) NULL,
  ADD INDEX `installation_records_sim_card_id_idx` (`sim_card_id`),
  ADD CONSTRAINT `installation_records_sim_card_id_fkey`
    FOREIGN KEY (`sim_card_id`) REFERENCES `sim_cards`(`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Backfill from sim_events created from installation record flow
UPDATE `installation_records` r
JOIN (
  SELECT
    se.record_id AS record_id,
    MAX(se.created_at) AS max_created_at
  FROM `sim_events` se
  WHERE se.record_id IS NOT NULL
    AND se.type IN ('INSTALLED', 'SENT', 'SEP_ACTIVATED')
  GROUP BY se.record_id
) latest
  ON latest.record_id = r.id
JOIN `sim_events` se2
  ON se2.record_id = latest.record_id
  AND se2.created_at = latest.max_created_at
SET r.sim_card_id = se2.sim_card_id
WHERE r.sim_card_id IS NULL;

