-- Fix Notification RLS to allow managers/admins to send notifications to other users
-- Previous policy "Users can manage own notifications" prevented inserting notifications for OTHERS.

DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;

-- 1. View/Update/Delete own notifications only (Privacy)
CREATE POLICY "View own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Delete own notifications" ON notifications FOR DELETE USING (user_id = auth.uid());

-- 2. Insert notifications: Allow authenticated users (System, Admin, manager) to send to anyone
-- This is crucial for features like Agenda Invitations where Admin inserts notifs for Employees.
CREATE POLICY "Insert notifications" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
