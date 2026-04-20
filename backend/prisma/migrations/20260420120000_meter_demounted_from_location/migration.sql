-- Add explicit flag for "meter demounted from location"
ALTER TABLE `meters`
  ADD COLUMN `is_demounted_from_location` BOOLEAN NOT NULL DEFAULT false;

