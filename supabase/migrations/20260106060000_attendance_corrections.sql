-- Attendance Corrections & Approval Workflow
-- Migration for Correction Requests

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.attendances(id) ON DELETE SET NULL, -- Link to existing attendance if any
  date DATE NOT NULL,
  
  -- Correction Data
  original_clock_in TIMESTAMPTZ,
  original_clock_out TIMESTAMPTZ,
  corrected_clock_in TIMESTAMPTZ,
  corrected_clock_out TIMESTAMPTZ,
  
  reason TEXT NOT NULL,
  proof_url TEXT, -- Attachment (Image/PDF)
  
  -- Approval Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  reviewer_id UUID REFERENCES auth.users(id),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_corrections_user_id ON public.attendance_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON public.attendance_corrections(status);
CREATE INDEX IF NOT EXISTS idx_corrections_date ON public.attendance_corrections(date);

-- 3. RLS Policies
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own corrections" 
  ON public.attendance_corrections FOR SELECT 
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can create corrections" 
  ON public.attendance_corrections FOR INSERT 
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins/Managers can view all corrections" 
  ON public.attendance_corrections FOR SELECT 
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin_hr') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admins/Managers can update corrections" 
  ON public.attendance_corrections FOR UPDATE 
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin_hr') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- 4. Storage for proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('correction-proofs', 'correction-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'correction-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view proofs" ON storage.objects
  FOR SELECT USING (bucket_id = 'correction-proofs');

-- 5. Function to Apply Correction to Attendance
CREATE OR REPLACE FUNCTION public.apply_approved_correction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendance_id UUID;
BEGIN
  -- Only run if status changed to 'approved'
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    
    -- Check if attendance record exists for that date
    SELECT id INTO v_attendance_id
    FROM public.attendances
    WHERE user_id = NEW.user_id AND date = NEW.date
    LIMIT 1;

    IF v_attendance_id IS NOT NULL THEN
      -- Update existing attendance
      UPDATE public.attendances
      SET 
        clock_in = COALESCE(NEW.corrected_clock_in, clock_in),
        clock_out = COALESCE(NEW.corrected_clock_out, clock_out),
        notes = COALESCE(notes, '') || ' [Correction Approved: ' || NEW.reason || ']',
        updated_at = now()
      WHERE id = v_attendance_id;
    ELSE
      -- Create new attendance record if missing
      INSERT INTO public.attendances (
        user_id, date, 
        clock_in, clock_out,
        status, notes
      ) VALUES (
        NEW.user_id, NEW.date,
        NEW.corrected_clock_in, NEW.corrected_clock_out,
        'present', 'Correction Approved: ' || NEW.reason
      );
    END IF;
    
    -- Recalculate monthly summary for that month
    PERFORM public.calculate_monthly_attendance_summary(
      NEW.user_id, 
      EXTRACT(MONTH FROM NEW.date)::INTEGER, 
      EXTRACT(YEAR FROM NEW.date)::INTEGER
    );
    
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Trigger
CREATE TRIGGER on_correction_approved
  AFTER UPDATE ON public.attendance_corrections
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_approved_correction();
