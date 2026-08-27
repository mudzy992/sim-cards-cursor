-- Dodavanje granularnih permisija na RecipientGroupUser
ALTER TABLE `recipient_group_users`
  ADD COLUMN `can_approve_from_pending` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `can_reject_from_pending` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `can_activate_sep` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `can_send_pdf` BOOLEAN NOT NULL DEFAULT FALSE;

