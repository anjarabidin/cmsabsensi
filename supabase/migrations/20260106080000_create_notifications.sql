-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL, -- leave, overtime, payroll, system
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own notifications" 
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger to create mock notification on leave request creation (for demo purpose)
CREATE OR REPLACE FUNCTION public.notify_on_new_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role UUID;
  v_admin_users UUID[];
BEGIN
  -- Notify the user themselves (confirmation)
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (NEW.user_id, 'Pengajuan Cuti Terkirim', 'Permintaan cuti Anda sedang diproses.', 'leave', '/leave');

  -- In real app, we would notify admins here
  -- For now, we rely on client-side fetching for Admins seeing Requests
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_leave_created
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_leave();

-- Trigger for status updates (Approval/Rejection)
CREATE OR REPLACE FUNCTION public.notify_on_leave_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.user_id, 
      CASE WHEN NEW.status = 'approved' THEN 'Cuti Disetujui' ELSE 'Cuti Ditolak' END,
      'Status pengajuan cuti Anda telah diperbarui.', 
      'leave', 
      '/leave'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_leave_status_change
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_leave_update();
