-- IMPROVE NOTIFICATION LOGIC
-- Purpose: Notify Super Admin (admin_hr) and Assigned Managers, not just Dept Managers.

CREATE OR REPLACE FUNCTION public.notify_managers_on_request()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_name TEXT;
    v_dept_id UUID;
    v_type_label TEXT;
    v_notif_type TEXT;
    v_link_url TEXT := '/approvals';
BEGIN
    -- Get employee name and department
    SELECT full_name, department_id INTO v_employee_name, v_dept_id 
    FROM public.profiles WHERE id = NEW.user_id;

    -- Determine label and type for the notification
    IF TG_TABLE_NAME = 'leave_requests' THEN
        v_type_label := 'Pengajuan Cuti';
        v_notif_type := 'leave_status';
    ELSIF TG_TABLE_NAME = 'overtime_requests' THEN
        v_type_label := 'Pengajuan Lembur';
        v_notif_type := 'overtime_status';
    ELSIF TG_TABLE_NAME = 'attendance_corrections' THEN
        v_type_label := 'Koreksi Absen';
        v_notif_type := 'correction_status';
    ELSIF TG_TABLE_NAME = 'reimbursements' THEN
        v_type_label := 'Klaim Reimbursement';
        v_notif_type := 'reimbursement_status';
    ELSE
        v_type_label := 'Pengajuan Baru';
        v_notif_type := 'system';
    END IF;

    -- Insert notification for TARGET USERS
    -- Targets: 
    -- 1. Managers in same department
    -- 2. Explicitly assigned managers
    -- 3. ALL Super Admins (admin_hr)
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT DISTINCT target_id, title, msg, n_type, lnk 
    FROM (
        -- 1. Department Managers
        SELECT p.id as target_id, 
               v_type_label || ' Baru' as title, 
               v_employee_name || ' mengajukan ' || v_type_label || '.' as msg,
               v_notif_type as n_type,
               v_link_url as lnk
        FROM public.profiles p
        JOIN public.user_roles ur ON p.id = ur.user_id
        WHERE ur.role = 'manager' 
          AND p.department_id = v_dept_id
          AND p.id != NEW.user_id

        UNION

        -- 2. Assigned Managers
        SELECT ma.manager_id as target_id,
               v_type_label || ' Baru' as title, 
               v_employee_name || ' (Bawahan) mengajukan ' || v_type_label || '.' as msg,
               v_notif_type as n_type,
               v_link_url as lnk
        FROM public.manager_assignments ma
        WHERE ma.employee_id = NEW.user_id

        UNION

        -- 3. Super Admins (Always loop in HR)
        SELECT ur.user_id as target_id,
               'HR: ' || v_type_label || ' Masuk' as title, 
               v_employee_name || ' mengajukan ' || v_type_label || '. Mohon dicek jika Manager tidak merespon.' as msg,
               'system' as n_type, -- Use system type for HR alerts
               v_link_url as lnk
        FROM public.user_roles ur
        WHERE ur.role = 'admin_hr' AND ur.user_id != NEW.user_id
    ) as targets;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
