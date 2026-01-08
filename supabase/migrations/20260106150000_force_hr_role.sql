-- Force user 'anjarbdn' (assuming search by email or username) to be admin_hr only
-- This assumes the table is 'profiles' and column is 'role'

UPDATE profiles
SET role = 'admin_hr'
WHERE email LIKE '%anjarbdn%' OR full_name ILIKE '%anjar%';

-- Verify the change
SELECT email, role, full_name FROM profiles WHERE role = 'admin_hr';
