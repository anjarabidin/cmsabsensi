
-- Migration: Add attendance_log permission to management roles

-- 1. Ensure the new navigation key is enabled for Super Admin, Admin HR, and Manager by default
-- This aligns with the new page created for monitoring attendance photos

-- Insert permissions for Super Admin
INSERT INTO role_nav_permissions (role, nav_key, is_enabled)
VALUES ('super_admin', 'attendance_log', true)
ON CONFLICT (role, nav_key) DO UPDATE SET is_enabled = true;

-- Insert permissions for Admin HR
INSERT INTO role_nav_permissions (role, nav_key, is_enabled)
VALUES ('admin_hr', 'attendance_log', true)
ON CONFLICT (role, nav_key) DO UPDATE SET is_enabled = true;

-- Insert permissions for Manager
INSERT INTO role_nav_permissions (role, nav_key, is_enabled)
VALUES ('manager', 'attendance_log', true)
ON CONFLICT (role, nav_key) DO UPDATE SET is_enabled = true;

-- Note: Employees and Drivers won't have this by default as they shouldn't see other people's photos.
