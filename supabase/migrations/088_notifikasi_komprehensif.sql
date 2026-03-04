-- FIX AND CONSOLIDATE NOTIFICATION TRIGGERS
-- Target: Ensure Super Admin and admin_hr receive all request notifications.
-- Target: Consolidate logic for Leave, Overtime, Corrections, and Reimbursements.

CREATE OR REPLACE FUNCTION public.notify_managers_on_request()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_name TEXT;
    v_dept_id UUID;
    v_type_label TEXT;
    v_notif_type TEXT;
    v_link_url TEXT := '/approvals';
BEGIN
    -- 1. Get employee data
    SELECT full_name, department_id INTO v_employee_name, v_dept_id 
    FROM public.profiles WHERE id = NEW.user_id;

    -- 2. Determine labels based on table
    IF TG_TABLE_NAME = 'leave_requests' THEN
        v_type_label := 'Pengajuan Cuti';
        v_notif_type := 'leave';
    ELSIF TG_TABLE_NAME = 'overtime_requests' THEN
        v_type_label := 'Pengajuan Lembur';
        v_notif_type := 'overtime';
    ELSIF TG_TABLE_NAME = 'attendance_corrections' THEN
        v_type_label := 'Koreksi Absen';
        v_notif_type := 'system';
    ELSIF TG_TABLE_NAME = 'reimbursements' THEN
        v_type_label := 'Klaim Reimbursement';
        v_notif_type := 'system';
    ELSE
        v_type_label := 'Pengajuan Baru';
        v_notif_type := 'system';
    END IF;

    -- 3. Insert notifications for multi-level recipients
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT DISTINCT target_id, title, msg, n_type, lnk 
    FROM (
        -- Category A: Department managers
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

        -- Category B: Explicitly Assigned managers
        SELECT ma.manager_id as target_id,
               v_type_label || ' Baru (Bawahan)' as title, 
               v_employee_name || ' mengajukan ' || v_type_label || '.' as msg,
               v_notif_type as n_type,
               v_link_url as lnk
        FROM public.manager_assignments ma
        WHERE ma.employee_id = NEW.user_id AND ma.manager_id != NEW.user_id

        UNION

        -- Category C: HR & Super Admins (Full Visibility)
        SELECT ur.user_id as target_id,
               '[' || UPPER(v_type_label) || ']' as title, 
               v_employee_name || ' mengajukan ' || v_type_label || '. Perlu tindakan admin/manager.' as msg,
               v_notif_type as n_type,
               v_link_url as lnk
        FROM public.user_roles ur
        WHERE (ur.role = 'admin_hr' OR ur.role = 'super_admin') 
          AND ur.user_id != NEW.user_id
    ) as targets;


    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
