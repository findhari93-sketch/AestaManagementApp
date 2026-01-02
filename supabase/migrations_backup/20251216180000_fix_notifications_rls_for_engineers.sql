-- Fix RLS policy to allow engineers to create notifications for admin/office users
-- This is needed when an engineer submits a settlement and needs to notify admins

-- First, check and drop existing policy if it exists
DROP POLICY IF EXISTS "Engineers can create notifications for admins" ON notifications;

-- Create policy to allow any authenticated user to insert notifications
-- The application logic ensures only valid notifications are created
CREATE POLICY "Users can create notifications for others"
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also ensure users can read their own notifications
DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
CREATE POLICY "Users can read their own notifications"
ON notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow users to update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
ON notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
ON notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
