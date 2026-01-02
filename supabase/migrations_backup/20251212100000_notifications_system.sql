-- Migration: Push Subscriptions for Notifications
-- Creates table for web push notification subscriptions
-- Note: notifications table already exists with: id, user_id, title, message,
--       notification_type, is_read, read_at, action_url, related_id (site_id),
--       related_table, expires_at, created_at

-- ============================================
-- Table: push_subscriptions
-- Stores web push notification subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  CONSTRAINT unique_push_endpoint UNIQUE(endpoint)
);

-- Index for fetching active subscriptions by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON push_subscriptions(user_id) WHERE is_active = TRUE;

-- ============================================
-- RLS Policies for push_subscriptions table
-- ============================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON push_subscriptions;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert their own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Users can update their own subscriptions
CREATE POLICY "Users can update their own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ============================================
-- Add indexes to existing notifications table for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_id, related_table);
