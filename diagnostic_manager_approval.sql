-- Query Diagnostic untuk Manager Approval

-- 1. Cek Manager Assignment
SELECT 
    ma.manager_id,
    m.full_name as manager_name,
    ma.employee_id,
    e.full_name as employee_name,
    e.department_id
FROM manager_assignments ma
JOIN profiles m ON ma.manager_id = m.id
JOIN profiles e ON ma.employee_id = e.id
WHERE m.role = 'manager'
ORDER BY m.full_name;

-- 2. Cek Leave Requests yang Pending
SELECT 
    lr.id,
    lr.user_id,
    p.full_name,
    p.department_id,
    d.name as department_name,
    lr.leave_type,
    lr.status,
    lr.created_at
FROM leave_requests lr
JOIN profiles p ON lr.user_id = p.id
LEFT JOIN departments d ON p.department_id = d.id
WHERE lr.status = 'pending'
ORDER BY lr.created_at DESC;

-- 3. Cek apakah user yang login adalah manager
SELECT 
    id,
    full_name,
    email,
    role,
    department_id
FROM profiles
WHERE role = 'manager';

-- 4. Cek semua assignment untuk debugging
SELECT COUNT(*) as total_assignments FROM manager_assignments;
