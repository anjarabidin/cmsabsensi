-- FASE 2: Payroll Module
-- Migration untuk Salary Management, Payroll Processing, dan API Integration

-- 1. Employee Salaries Table
CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL,
  -- Allowances
  transport_allowance DECIMAL(10,2) DEFAULT 0,
  meal_allowance DECIMAL(10,2) DEFAULT 0,
  position_allowance DECIMAL(10,2) DEFAULT 0,
  housing_allowance DECIMAL(10,2) DEFAULT 0,
  other_allowances DECIMAL(10,2) DEFAULT 0,
  -- BPJS Rates (percentage)
  bpjs_kesehatan_employee_rate DECIMAL(5,2) DEFAULT 1.0,
  bpjs_kesehatan_employer_rate DECIMAL(5,2) DEFAULT 4.0,
  bpjs_tk_employee_rate DECIMAL(5,2) DEFAULT 2.0,
  bpjs_tk_employer_rate DECIMAL(5,2) DEFAULT 3.7,
  -- Tax
  ptkp_status VARCHAR(10) DEFAULT 'TK/0', -- TK/0, K/0, K/1, K/2, K/3
  npwp VARCHAR(20),
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Payroll Runs Table
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, finalized, paid, cancelled
  total_employees INTEGER DEFAULT 0,
  total_gross_salary DECIMAL(14,2) DEFAULT 0,
  total_deductions DECIMAL(14,2) DEFAULT 0,
  total_net_salary DECIMAL(14,2) DEFAULT 0,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  finalized_by UUID REFERENCES auth.users(id),
  finalized_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- 3. Payroll Details Table
CREATE TABLE IF NOT EXISTS public.payroll_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Attendance Data (from monthly_attendance_summary)
  working_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  late_count INTEGER DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  leave_days INTEGER DEFAULT 0,
  
  -- Overtime
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  overtime_pay DECIMAL(12,2) DEFAULT 0,
  
  -- Salary Components
  base_salary DECIMAL(12,2) NOT NULL,
  transport_allowance DECIMAL(10,2) DEFAULT 0,
  meal_allowance DECIMAL(10,2) DEFAULT 0,
  position_allowance DECIMAL(10,2) DEFAULT 0,
  housing_allowance DECIMAL(10,2) DEFAULT 0,
  other_allowances DECIMAL(10,2) DEFAULT 0,
  total_allowances DECIMAL(12,2) DEFAULT 0,
  gross_salary DECIMAL(12,2) DEFAULT 0,
  
  -- Deductions
  late_deduction DECIMAL(10,2) DEFAULT 0,
  absent_deduction DECIMAL(10,2) DEFAULT 0,
  bpjs_kesehatan_employee DECIMAL(10,2) DEFAULT 0,
  bpjs_tk_employee DECIMAL(10,2) DEFAULT 0,
  pph21 DECIMAL(10,2) DEFAULT 0,
  loan_deduction DECIMAL(10,2) DEFAULT 0,
  other_deductions DECIMAL(10,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  
  -- Net Salary
  net_salary DECIMAL(12,2) DEFAULT 0,
  
  -- Employer Costs (for reporting)
  bpjs_kesehatan_employer DECIMAL(10,2) DEFAULT 0,
  bpjs_tk_employer DECIMAL(10,2) DEFAULT 0,
  total_employer_cost DECIMAL(12,2) DEFAULT 0,
  
  -- Status
  slip_generated BOOLEAN DEFAULT false,
  slip_sent BOOLEAN DEFAULT false,
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed
  paid_at TIMESTAMPTZ,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_run_id, user_id)
);

-- 4. Payroll Adjustments Table (for manual adjustments)
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_detail_id UUID NOT NULL REFERENCES public.payroll_details(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(50) NOT NULL, -- bonus, penalty, reimbursement, loan, other
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PTKP (Penghasilan Tidak Kena Pajak) Reference Table
CREATE TABLE IF NOT EXISTS public.ptkp_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(10) NOT NULL UNIQUE, -- TK/0, K/0, K/1, K/2, K/3
  annual_amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  effective_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Triggers for updated_at
CREATE TRIGGER update_employee_salaries_updated_at 
  BEFORE UPDATE ON public.employee_salaries 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_runs_updated_at 
  BEFORE UPDATE ON public.payroll_runs 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_details_updated_at 
  BEFORE UPDATE ON public.payroll_details 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS Policies for employee_salaries
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own salary" 
  ON public.employee_salaries FOR SELECT 
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin HR can view all salaries" 
  ON public.employee_salaries FOR SELECT 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

CREATE POLICY "Admin HR can manage salaries" 
  ON public.employee_salaries FOR ALL 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- 8. RLS Policies for payroll_runs
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin HR can view all payroll runs" 
  ON public.payroll_runs FOR SELECT 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

CREATE POLICY "Admin HR can manage payroll runs" 
  ON public.payroll_runs FOR ALL 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- 9. RLS Policies for payroll_details
ALTER TABLE public.payroll_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payroll details" 
  ON public.payroll_details FOR SELECT 
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin HR can view all payroll details" 
  ON public.payroll_details FOR SELECT 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

CREATE POLICY "Admin HR can manage payroll details" 
  ON public.payroll_details FOR ALL 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- 10. RLS Policies for payroll_adjustments
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin HR can manage adjustments" 
  ON public.payroll_adjustments FOR ALL 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- 11. RLS Policies for ptkp_rates
ALTER TABLE public.ptkp_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PTKP rates are viewable by authenticated users" 
  ON public.ptkp_rates FOR SELECT 
  TO authenticated USING (true);

CREATE POLICY "Admin HR can manage PTKP rates" 
  ON public.ptkp_rates FOR ALL 
  TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- 12. Insert default PTKP rates (2024)
INSERT INTO public.ptkp_rates (status, annual_amount, description, effective_year) VALUES
  ('TK/0', 54000000, 'Tidak Kawin, Tanpa Tanggungan', 2024),
  ('K/0', 58500000, 'Kawin, Tanpa Tanggungan', 2024),
  ('K/1', 63000000, 'Kawin, 1 Tanggungan', 2024),
  ('K/2', 67500000, 'Kawin, 2 Tanggungan', 2024),
  ('K/3', 72000000, 'Kawin, 3 Tanggungan', 2024)
ON CONFLICT (status) DO NOTHING;

-- 13. Function to calculate PPh 21
CREATE OR REPLACE FUNCTION public.calculate_pph21(
  gross_annual DECIMAL,
  ptkp_status VARCHAR
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
  ptkp_amount DECIMAL;
  taxable_income DECIMAL;
  tax DECIMAL := 0;
BEGIN
  -- Get PTKP amount
  SELECT annual_amount INTO ptkp_amount
  FROM public.ptkp_rates
  WHERE status = ptkp_status
  LIMIT 1;
  
  IF ptkp_amount IS NULL THEN
    ptkp_amount := 54000000; -- Default TK/0
  END IF;
  
  -- Calculate taxable income
  taxable_income := gross_annual - ptkp_amount;
  
  IF taxable_income <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Progressive tax calculation (2024 rates)
  -- Layer 1: 0 - 60 juta = 5%
  IF taxable_income <= 60000000 THEN
    tax := taxable_income * 0.05;
  -- Layer 2: 60 juta - 250 juta = 15%
  ELSIF taxable_income <= 250000000 THEN
    tax := (60000000 * 0.05) + ((taxable_income - 60000000) * 0.15);
  -- Layer 3: 250 juta - 500 juta = 25%
  ELSIF taxable_income <= 500000000 THEN
    tax := (60000000 * 0.05) + (190000000 * 0.15) + ((taxable_income - 250000000) * 0.25);
  -- Layer 4: 500 juta - 5 miliar = 30%
  ELSIF taxable_income <= 5000000000 THEN
    tax := (60000000 * 0.05) + (190000000 * 0.15) + (250000000 * 0.25) + ((taxable_income - 500000000) * 0.30);
  -- Layer 5: > 5 miliar = 35%
  ELSE
    tax := (60000000 * 0.05) + (190000000 * 0.15) + (250000000 * 0.25) + (4500000000 * 0.30) + ((taxable_income - 5000000000) * 0.35);
  END IF;
  
  RETURN ROUND(tax);
END;
$$;

-- 14. Function to generate payroll for one employee
CREATE OR REPLACE FUNCTION public.generate_employee_payroll(
  p_payroll_run_id UUID,
  p_user_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payroll_detail_id UUID;
  v_salary RECORD;
  v_summary RECORD;
  v_gross_salary DECIMAL;
  v_total_allowances DECIMAL;
  v_total_deductions DECIMAL;
  v_net_salary DECIMAL;
  v_annual_gross DECIMAL;
  v_pph21_monthly DECIMAL;
BEGIN
  -- Get active salary
  SELECT * INTO v_salary
  FROM public.employee_salaries
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;
  
  IF v_salary IS NULL THEN
    RAISE EXCEPTION 'No active salary found for user %', p_user_id;
  END IF;
  
  -- Get attendance summary
  SELECT * INTO v_summary
  FROM public.monthly_attendance_summary
  WHERE user_id = p_user_id AND month = p_month AND year = p_year;
  
  -- Calculate totals
  v_total_allowances := COALESCE(v_salary.transport_allowance, 0) + 
                        COALESCE(v_salary.meal_allowance, 0) + 
                        COALESCE(v_salary.position_allowance, 0) + 
                        COALESCE(v_salary.housing_allowance, 0) + 
                        COALESCE(v_salary.other_allowances, 0);
  
  v_gross_salary := v_salary.base_salary + v_total_allowances + COALESCE(v_summary.total_overtime_pay, 0);
  
  -- Calculate annual gross for PPh 21
  v_annual_gross := v_gross_salary * 12;
  v_pph21_monthly := public.calculate_pph21(v_annual_gross, v_salary.ptkp_status) / 12;
  
  -- Calculate deductions
  v_total_deductions := 
    COALESCE(v_summary.deductions, 0) + -- late/absent deductions
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employee_rate / 100) +
    (v_salary.base_salary * v_salary.bpjs_tk_employee_rate / 100) +
    v_pph21_monthly;
  
  v_net_salary := v_gross_salary - v_total_deductions;
  
  -- Insert payroll detail
  INSERT INTO public.payroll_details (
    payroll_run_id, user_id,
    working_days, present_days, late_count, late_minutes, absent_days, leave_days,
    overtime_hours, overtime_pay,
    base_salary, transport_allowance, meal_allowance, position_allowance, 
    housing_allowance, other_allowances, total_allowances, gross_salary,
    late_deduction, absent_deduction,
    bpjs_kesehatan_employee, bpjs_tk_employee, pph21,
    total_deductions, net_salary,
    bpjs_kesehatan_employer, bpjs_tk_employer, total_employer_cost
  ) VALUES (
    p_payroll_run_id, p_user_id,
    COALESCE(v_summary.total_working_days, 0),
    COALESCE(v_summary.total_present, 0),
    COALESCE(v_summary.total_late, 0),
    COALESCE(v_summary.total_late_minutes, 0),
    COALESCE(v_summary.total_absent, 0),
    COALESCE(v_summary.total_leave_days, 0),
    COALESCE(v_summary.total_overtime_hours, 0),
    COALESCE(v_summary.total_overtime_pay, 0),
    v_salary.base_salary,
    COALESCE(v_salary.transport_allowance, 0),
    COALESCE(v_salary.meal_allowance, 0),
    COALESCE(v_salary.position_allowance, 0),
    COALESCE(v_salary.housing_allowance, 0),
    COALESCE(v_salary.other_allowances, 0),
    v_total_allowances,
    v_gross_salary,
    COALESCE(v_summary.deductions, 0),
    0, -- absent_deduction (can be customized)
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employee_rate / 100),
    (v_salary.base_salary * v_salary.bpjs_tk_employee_rate / 100),
    v_pph21_monthly,
    v_total_deductions,
    v_net_salary,
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employer_rate / 100),
    (v_salary.base_salary * v_salary.bpjs_tk_employer_rate / 100),
    (v_salary.base_salary * (v_salary.bpjs_kesehatan_employer_rate + v_salary.bpjs_tk_employer_rate) / 100)
  )
  RETURNING id INTO v_payroll_detail_id;
  
  RETURN v_payroll_detail_id;
END;
$$;
