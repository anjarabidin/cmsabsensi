-- FIX OVERTIME CALCULATION IN PAYROLL GENERATION
-- The previous logic relied on pre-calculated overtime_pay which was missing.
-- This update calculates it on the fly: (Base Salary / 173) * Overtime Hours

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
  v_overtime_pay DECIMAL;
  v_hourly_rate DECIMAL;
  v_late_deduction DECIMAL := 0;
  v_late_penalty_rate DECIMAL := 50000; -- Example fixed penalty per late occurrence (Customize as needed)
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
  
  -- 4. Calculate Overtime Pay
  -- Standard formula: 1/173 * Base Salary * Hours
  IF v_salary.base_salary > 0 THEN
    v_hourly_rate := v_salary.base_salary / 173;
    v_overtime_pay := v_hourly_rate * COALESCE(v_summary.total_overtime_hours, 0);
  ELSE
    v_overtime_pay := 0;
  END IF;

  -- 5. Calculate Late Deductions (Optional Logic)
  -- Example: 50k per late arrival if late > 0
  IF COALESCE(v_summary.total_late, 0) > 0 THEN
      v_late_deduction := COALESCE(v_summary.total_late, 0) * v_late_penalty_rate;
  END IF;
  
  -- 6. Calculate totals
  v_total_allowances := COALESCE(v_salary.transport_allowance, 0) + 
                        COALESCE(v_salary.meal_allowance, 0) + 
                        COALESCE(v_salary.position_allowance, 0) + 
                        COALESCE(v_salary.housing_allowance, 0) + 
                        COALESCE(v_salary.other_allowances, 0);
  
  v_gross_salary := v_salary.base_salary + v_total_allowances + v_overtime_pay;
  
  -- Calculate annual gross for PPh 21
  v_annual_gross := v_gross_salary * 12;
  -- Use existing pph21 func if exists, else 0
  BEGIN
    v_pph21_monthly := public.calculate_pph21(v_annual_gross, v_salary.ptkp_status) / 12;
  EXCEPTION WHEN OTHERS THEN
    v_pph21_monthly := 0;
  END;
  
  -- Calculate deductions
  v_total_deductions := 
    v_late_deduction +
    COALESCE(v_summary.deductions, 0) + -- other pre-calculated deductions
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employee_rate / 100) +
    (v_salary.base_salary * v_salary.bpjs_tk_employee_rate / 100) +
    v_pph21_monthly;
  
  v_net_salary := v_gross_salary - v_total_deductions;
  
  -- 7. Insert or Update payroll detail
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
    v_overtime_pay,
    v_salary.base_salary,
    COALESCE(v_salary.transport_allowance, 0),
    COALESCE(v_salary.meal_allowance, 0),
    COALESCE(v_salary.position_allowance, 0),
    COALESCE(v_salary.housing_allowance, 0),
    COALESCE(v_salary.other_allowances, 0),
    v_total_allowances,
    v_gross_salary,
    v_late_deduction,
    0, 
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employee_rate / 100),
    (v_salary.base_salary * v_salary.bpjs_tk_employee_rate / 100),
    v_pph21_monthly,
    v_total_deductions,
    v_net_salary,
    (v_salary.base_salary * v_salary.bpjs_kesehatan_employer_rate / 100),
    (v_salary.base_salary * v_salary.bpjs_tk_employer_rate / 100),
    (v_salary.base_salary * (v_salary.bpjs_kesehatan_employer_rate + v_salary.bpjs_tk_employer_rate) / 100)
  )
  ON CONFLICT (payroll_run_id, user_id) DO UPDATE SET
    working_days = EXCLUDED.working_days,
    present_days = EXCLUDED.present_days,
    overtime_pay = EXCLUDED.overtime_pay,
    gross_salary = EXCLUDED.gross_salary,
    net_salary = EXCLUDED.net_salary,
    late_deduction = EXCLUDED.late_deduction,
    total_deductions = EXCLUDED.total_deductions,
    updated_at = now()
  RETURNING id INTO v_payroll_detail_id;
  
  RETURN v_payroll_detail_id;
END;
$$;
