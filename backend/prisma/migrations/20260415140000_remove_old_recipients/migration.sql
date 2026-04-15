-- Remove old recipients/approval system (replaced by branch_email_recipients + branch_moderators)

-- Step 1: Drop FK-dependent tables first (order matters)
DROP TABLE IF EXISTS `branch_approval_groups`;
DROP TABLE IF EXISTS `recipient_group_users`;
DROP TABLE IF EXISTS `recipients`;
DROP TABLE IF EXISTS `recipient_groups`;

-- Step 2: Drop the RecipientGroupType enum column type
-- MySQL enums are column-level, no separate DROP ENUM needed.
-- The enum was only used by recipient_groups.type which is now dropped.
