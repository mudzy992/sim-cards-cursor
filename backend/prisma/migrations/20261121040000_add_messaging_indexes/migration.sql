-- Run 6 (P2-1): Add composite indexes for notifications, push tokens, push deliveries, and branch email recipients
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");
CREATE INDEX IF NOT EXISTS "push_tokens_user_id_is_valid_idx" ON "push_tokens"("user_id", "is_valid");
CREATE INDEX IF NOT EXISTS "push_deliveries_campaign_id_status_idx" ON "push_deliveries"("campaign_id", "status");
CREATE INDEX IF NOT EXISTS "branch_email_recipients_branch_id_is_active_idx" ON "branch_email_recipients"("branch_id", "is_active");
