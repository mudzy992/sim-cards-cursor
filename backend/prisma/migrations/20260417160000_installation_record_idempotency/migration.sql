-- Add clientRequestId for idempotent mobile retries

ALTER TABLE `installation_records`
  ADD COLUMN `client_request_id` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `installation_records_client_request_id_key`
  ON `installation_records`(`client_request_id`);

