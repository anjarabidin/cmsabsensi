-- Create a function to calculate PPh 21 using TER method (Monthly)
CREATE OR REPLACE FUNCTION public.calculate_pph21_ter(
  p_gross_income DECIMAL,
  p_ptkp_status VARCHAR
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ter_category VARCHAR;
  v_rate DECIMAL;
BEGIN
  -- 1. Get TER Category for the PTKP status
  SELECT ter_category INTO v_ter_category
  FROM public.ptkp_ter_mappings
  WHERE ptkp_status = p_ptkp_status;

  IF v_ter_category IS NULL THEN
    RETURN 0;
  END IF;

  -- 2. Find the applicable rate for the gross income in that category
  -- Rate is stored as 0.05 for 5%
  SELECT rate_percentage INTO v_rate
  FROM public.pph21_ter_rates
  WHERE category_code = v_ter_category
    AND min_gross_income <= p_gross_income
    AND max_gross_income >= p_gross_income
  ORDER BY rate_percentage DESC
  LIMIT 1;

  IF v_rate IS NULL THEN
    RETURN 0;
  END IF;

  RETURN floor(p_gross_income * v_rate);
END;
$$;

-- Update the generate_employee_payroll to use the new TER method
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
  v_pph21_ter_amount DECIMAL;
BEGIN
  -- 1. Ensure attendance summary is up to date
  PERFORM public.calculate_monthly_attendance_summary(p_user_id, p_month, p_year);

  -- 2. Get active salary
  SELECT * INTO v_salary
  FROM public.employee_salaries
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;
  
  IF v_salary IS NULL THEN
    RAISE NOTICE 'No active salary found for user %, skipping.', p_user_id;
    RETURN NULL;
  END IF;
  
  -- 3. Get attendance summary
  SELECT * INTO v_summary
  FROM public.monthly_attendance_summary
  WHERE user_id = p_user_id AND month = p_month AND year = p_year;
  
  -- 4. Calculate totals
  v_total_allowances := COALESCE(v_salary.transport_allowance, 0) + 
                        COALESCE(v_salary.meal_allowance, 0) + 
                        COALESCE(v_salary.position_allowance, 0) + 
                        COALESCE(v_salary.housing_allowance, 0) + 
                        COALESCE(v_salary.other_allowances, 0);
  
  -- Gross = Base + Allowances + Overtime Pay
  v_gross_salary := v_salary.base_salary + v_total_allowances + COALESCE(v_summary.total_overtime_pay, 0);
  
  -- Calculate PPh 21 using TER method
  v_pph21_ter_amount := public.calculate_pph21_ter(v_gross_salary, v_salary.ptkp_status);
  
  -- Calculate deductions
  v_total_deductions := 
    COALESCE(v_summary.deductions, 0) + -- late/absent deductions
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employee_rate / 100) +
    (v_salary.base_salary * v_salary.bpjs_tk_employee_rate / 100) +
    v_pph21_ter_amount;
  
  v_net_salary := v_gross_salary - v_total_deductions;
  
  -- 5. Insert or Update payroll detail
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
    0, 
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employee_rate / 100),
    (v_salary.base_salary * v_salary.bpjs_tk_employee_rate / 100),
    v_pph21_ter_amount,
    v_total_deductions,
    v_net_salary,
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employer_rate / 100),
    (v_salary.base_salary * v_salary.bpjs_tk_employer_rate / 100),
    (v_salary.base_salary * (v_salary.bpjs_kesehatan_employer_rate + v_salary.bpjs_tk_employer_rate) / 100)
  )
  ON CONFLICT (payroll_run_id, user_id) DO UPDATE SET
    working_days = EXCLUDED.working_days,
    present_days = EXCLUDED.present_days,
    overtime_hours = EXCLUDED.overtime_hours,
    overtime_pay = EXCLUDED.overtime_pay,
    total_allowances = EXCLUDED.total_allowances,
    gross_salary = EXCLUDED.gross_salary,
    late_deduction = EXCLUDED.late_deduction,
    pph21 = EXCLUDED.pph21,
    total_deductions = EXCLUDED.total_deductions,
    net_salary = EXCLUDED.net_salary,
    updated_at = now()
  RETURNING id INTO v_payroll_detail_id;
  
  RETURN v_payroll_detail_id;
END;
$$;
