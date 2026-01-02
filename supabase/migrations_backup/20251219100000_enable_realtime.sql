-- Enable Realtime for tables that need live updates
-- This fixes the "TIMED_OUT" errors for realtime subscriptions

-- Add tables to the supabase_realtime publication
-- Note: Supabase automatically creates this publication

-- Enable realtime for daily_attendance
ALTER PUBLICATION supabase_realtime ADD TABLE daily_attendance;

-- Enable realtime for client_payments
ALTER PUBLICATION supabase_realtime ADD TABLE client_payments;

-- Enable realtime for market_laborer_attendance (also used in attendance page)
ALTER PUBLICATION supabase_realtime ADD TABLE market_laborer_attendance;

-- Enable realtime for expenses (for live expense updates)
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;

-- Enable realtime for notifications (for live notification updates)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
