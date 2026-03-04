-- Automatic Notifications for managers
-- This script ensures that whenever an employee submits a request (Leave, Overtime, Correction, Reimbursement),
-- all managers in their respective department receive a real-time notification.

CREATE OR REPLACE FUNCTION public.notify_managers_on_request()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_name TEXT;
    v_dept_id UUID;
    v_type_label TEXT;
    v_notif_type TEXT;
BEGIN
    -- Get employee name and department
    SELECT full_name, department_id INTO v_employee_name, v_dept_id 
    FROM public.profiles WHERE id = NEW.user_id;

    -- Determine label and type for the notification
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
        v_notif_type := 'payroll';
    ELSE
        v_type_label := 'Pengajuan Baru';
        v_notif_type := 'system';
    END IF;

    -- Insert notification for all managers in the same department
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT p.id, 
           v_type_label || ' Baru', 
           v_employee_name || ' telah mengajukan ' || LOWER(v_type_label) || '.',
           v_notif_type,
           '/approvals'
    FROM public.profiles p
    JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE ur.role = 'manager' 
      AND p.department_id = v_dept_id
      AND p.id != NEW.user_id; -- Don't notify self if a manager submits a request

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for all request tables
DROP TRIGGER IF EXISTS tr_notify_manager_leave ON public.leave_requests;
CREATE TRIGGER tr_notify_manager_leave
AFTER INSERT ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_request();

DROP TRIGGER IF EXISTS tr_notify_manager_overtime ON public.overtime_requests;
CREATE TRIGGER tr_notify_manager_overtime
AFTER INSERT ON public.overtime_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_request();

DROP TRIGGER IF EXISTS tr_notify_manager_correction ON public.attendance_corrections;
CREATE TRIGGER tr_notify_manager_correction
AFTER INSERT ON public.attendance_corrections
FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_request();

DROP TRIGGER IF EXISTS tr_notify_manager_reimbursement ON public.reimbursements;
CREATE TRIGGER tr_notify_manager_reimbursement
AFTER INSERT ON public.reimbursements
FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_request();
