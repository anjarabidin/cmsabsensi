-- FASE 1: Compliance & Legal Features
-- Migration untuk Leave Balance, Overtime Calculation, Payroll Report, Sick Leave Enhancement

-- 1. Leave Balances Table
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  annual_quota INTEGER DEFAULT 12,
  annual_used INTEGER DEFAULT 0,
  annual_remaining INTEGER DEFAULT 12,
  sick_used INTEGER DEFAULT 0,
  special_leave_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year)
);

-- 2. Overtime Policies Table
CREATE TABLE IF NOT EXISTS public.overtime_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_hours_per_day INTEGER DEFAULT 3,
  max_hours_per_week INTEGER DEFAULT 14,
  weekday_multiplier_1_2_hours DECIMAL(3,1) DEFAULT 1.5,
  weekday_multiplier_3plus_hours DECIMAL(3,1) DEFAULT 2.0,
  holiday_multiplier_1_8_hours DECIMAL(3,1) DEFAULT 2.0,
  holiday_multiplier_9_10_hours DECIMAL(3,1) DEFAULT 3.0,
  holiday_multiplier_11plus_hours DECIMAL(3,1) DEFAULT 4.0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Update overtime_requests table
ALTER TABLE public.overtime_requests 
ADD COLUMN IF NOT EXISTS base_hourly_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS overtime_multiplier DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS calculated_overtime_pay DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT false;

-- 4. Update leave_requests table for sick leave enhancement
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS requires_medical_certificate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS medical_certificate_url TEXT,
ADD COLUMN IF NOT EXISTS diagnosis TEXT;

-- 5. Monthly Attendance Summary Table (for Payroll)
CREATE TABLE IF NOT EXISTS public.monthly_attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_working_days INTEGER DEFAULT 0,
  total_present INTEGER DEFAULT 0,
  total_late INTEGER DEFAULT 0,
  total_late_minutes INTEGER DEFAULT 0,
  total_absent INTEGER DEFAULT 0,
  total_leave_days INTEGER DEFAULT 0,
  total_overtime_hours DECIMAL(5,2) DEFAULT 0,
  total_overtime_pay DECIMAL(12,2) DEFAULT 0,
  deductions DECIMAL(10,2) DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- 6. Triggers for updated_at
CREATE TRIGGER update_leave_balances_updated_at 
  BEFORE UPDATE ON public.leave_balances 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_overtime_policies_updated_at 
  BEFORE UPDATE ON public.overtime_policies 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS Policies for leave_balances
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own leave balance" 
  ON public.leave_balances FOR SELECT 
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin HR can view all leave balances" 
  ON public.leave_balances FOR SELECT 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

CREATE POLICY "Admin HR can manage leave balances" 
  ON public.leave_balances FOR ALL 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- 8. RLS Policies for overtime_policies
ALTER TABLE public.overtime_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Overtime policies are viewable by authenticated users" 
  ON public.overtime_policies FOR SELECT 
  TO authenticated USING (true);

CREATE POLICY "Admin HR can manage overtime policies" 
  ON public.overtime_policies FOR ALL 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- 9. RLS Policies for monthly_attendance_summary
ALTER TABLE public.monthly_attendance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own summary" 
  ON public.monthly_attendance_summary FOR SELECT 
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin HR can view all summaries" 
  ON public.monthly_attendance_summary FOR SELECT 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

CREATE POLICY "Admin HR can manage summaries" 
  ON public.monthly_attendance_summary FOR ALL 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- 10. Function to initialize leave balance for new year
CREATE OR REPLACE FUNCTION public.initialize_leave_balance(p_user_id UUID, p_year INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.leave_balances (user_id, year, annual_quota, annual_used, annual_remaining)
  VALUES (p_user_id, p_year, 12, 0, 12)
  ON CONFLICT (user_id, year) DO NOTHING;
END;
$$;

-- 11. Function to deduct leave balance
CREATE OR REPLACE FUNCTION public.deduct_leave_balance(
  p_user_id UUID,
  p_year INTEGER,
  p_days INTEGER,
  p_leave_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Initialize balance if not exists
  PERFORM public.initialize_leave_balance(p_user_id, p_year);
  
  -- Deduct based on leave type
  IF p_leave_type = 'annual' THEN
    UPDATE public.leave_balances
    SET 
      annual_used = annual_used + p_days,
      annual_remaining = annual_quota - (annual_used + p_days),
      updated_at = now()
    WHERE user_id = p_user_id AND year = p_year;
  ELSIF p_leave_type = 'sick' THEN
    UPDATE public.leave_balances
    SET 
      sick_used = sick_used + p_days,
      updated_at = now()
    WHERE user_id = p_user_id AND year = p_year;
  ELSE
    UPDATE public.leave_balances
    SET 
      special_leave_used = special_leave_used + p_days,
      updated_at = now()
    WHERE user_id = p_user_id AND year = p_year;
  END IF;
END;
$$;

-- 12. Insert default overtime policy
INSERT INTO public.overtime_policies (
  name, 
  max_hours_per_day, 
  max_hours_per_week,
  weekday_multiplier_1_2_hours,
  weekday_multiplier_3plus_hours,
  holiday_multiplier_1_8_hours,
  holiday_multiplier_9_10_hours,
  holiday_multiplier_11plus_hours,
  is_default
)
VALUES (
  'Kebijakan Lembur Standar (UU No. 13/2003)',
  3,
  14,
  1.5,
  2.0,
  2.0,
  3.0,
  4.0,
  true
)
ON CONFLICT DO NOTHING;

-- 13. Initialize leave balances for existing users (current year)
DO $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    PERFORM public.initialize_leave_balance(user_record.id, current_year);
  END LOOP;
END $$;
