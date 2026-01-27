export type AppRole = 'super_admin' | 'admin_hr' | 'manager' | 'employee';
export type WorkMode = 'wfo' | 'wfh' | 'field';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'sick';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'annual' | 'sick' | 'maternity' | 'paternity' | 'marriage' | 'bereavement' | 'unpaid';

// --- ENTERPRISE MASTER DATA TYPES ---

export interface OrganizationDirectorate {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
}

export interface OrganizationDivision {
  id: string;
  directorate_id: string;
  name: string;
  code: string | null;
  description: string | null;
  directorate?: OrganizationDirectorate;
}

// Enhanced Department type
export interface Department {
  id: string;
  name: string;
  description: string | null;
  division_id?: string | null;
  code?: string | null;
  division?: OrganizationDivision;
  created_at: string;
  updated_at: string;
}

export interface JobGrade {
  id: string;
  name: string;
  level_rank: number;
  min_salary: number;
  max_salary: number;
}

export interface JobPosition {
  id: string;
  department_id: string;
  grade_id: string;
  title: string;
  code: string | null;
  description: string | null;
  is_leadership: boolean;
  department?: Department;
  grade?: JobGrade;
}

export interface EmploymentStatus {
  id: string;
  name: string;
  category: 'permanent' | 'contract' | 'probation' | 'intern' | 'freelance';
}

export interface Bank {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface EmployeeFamily {
  id: string;
  user_id: string;
  full_name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'sibling';
  date_of_birth: string | null;
  ktp_number: string | null;
  gender: 'male' | 'female' | null;
  is_bpjs_covered: boolean;
  education_level: string | null;
  job: string | null;
}

// Updated Profile with Enterprise Fields
export interface Profile {
  id: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  position: string | null; // Legacy text field
  role: AppRole | null;
  avatar_url: string | null;
  join_date: string | null;
  is_active: boolean;

  // New Enterprise Fields
  nik_ktp: string | null;
  kk_number: string | null;
  npwp_number: string | null;
  gender: 'male' | 'female' | null;
  place_of_birth: string | null;
  date_of_birth: string | null;
  marital_status: 'single' | 'married' | 'widowed' | 'divorced' | null;
  religion: string | null;
  blood_type: string | null;
  address_ktp: string | null;
  address_domicile: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  mother_maiden_name: string | null;

  // Bank
  bank_id: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  bank?: Bank; // Joined

  // Job Links
  job_position_id: string | null;
  job_grade_id: string | null;
  employment_status_id: string | null;
  end_contract_date: string | null;
  job_position?: JobPosition;
  job_grade?: JobGrade;
  employment_status?: EmploymentStatus;
  department?: Department; // Joined

  // Onboarding
  onboarding_step: number;
  onboarding_status: 'draft' | 'pending_verification' | 'approved' | 'rejected';
  reports_to: string | null;
  manager?: Profile; // Joined

  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_photo_url: string | null;
  clock_out_photo_url: string | null;
  clock_in_location_id: string | null;
  clock_out_location_id: string | null;
  work_mode: WorkMode;
  status: AttendanceStatus;
  notes: string | null;
  work_hours_minutes: number | null;
  is_late: boolean;
  late_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_url: string | null;
  status: RequestStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OvertimeRequest {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  reason: string;
  status: RequestStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceCorrection {
  id: string;
  user_id: string;
  date: string;
  attendance_id: string | null;
  original_clock_in: string | null;
  original_clock_out: string | null;
  corrected_clock_in: string | null;
  corrected_clock_out: string | null;
  reason: string;
  status: RequestStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  year: number;
  annual_quota: number;
  annual_used: number;
  annual_remaining: number;
  sick_used: number;
  special_leave_used: number;
  created_at: string;
  updated_at: string;
}

export interface OvertimePolicy {
  id: string;
  name: string;
  max_hours_per_day: number;
  max_hours_per_week: number;
  weekday_multiplier_1_2_hours: number;
  weekday_multiplier_3plus_hours: number;
  holiday_multiplier_1_8_hours: number;
  holiday_multiplier_9_10_hours: number;
  holiday_multiplier_11plus_hours: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyAttendanceSummary {
  id: string;
  user_id: string;
  month: number;
  year: number;
  total_working_days: number;
  total_present: number;
  total_late: number;
  total_late_minutes: number;
  total_absent: number;
  total_leave_days: number;
  total_overtime_hours: number;
  total_overtime_pay: number;
  deductions: number;
  generated_at: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSalary {
  id: string;
  user_id: string;
  effective_date: string;
  base_salary: number;
  transport_allowance: number;
  meal_allowance: number;
  position_allowance: number;
  housing_allowance: number;
  other_allowances: number;
  bpjs_kesehatan_employee_rate: number;
  bpjs_kesehatan_employer_rate: number;
  bpjs_tk_employee_rate: number;
  bpjs_tk_employer_rate: number;
  ptkp_status: string;
  npwp: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  status: 'draft' | 'finalized' | 'paid' | 'cancelled';
  total_employees: number;
  total_gross_salary: number;
  total_deductions: number;
  total_net_salary: number;
  generated_by: string | null;
  generated_at: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollDetail {
  id: string;
  payroll_run_id: string;
  user_id: string;
  working_days: number;
  present_days: number;
  late_count: number;
  late_minutes: number;
  absent_days: number;
  leave_days: number;
  overtime_hours: number;
  overtime_pay: number;
  base_salary: number;
  transport_allowance: number;
  meal_allowance: number;
  position_allowance: number;
  housing_allowance: number;
  other_allowances: number;
  total_allowances: number;
  gross_salary: number;
  late_deduction: number;
  absent_deduction: number;
  bpjs_kesehatan_employee: number;
  bpjs_tk_employee: number;
  pph21: number;
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  bpjs_kesehatan_employer: number;
  bpjs_tk_employer: number;
  total_employer_cost: number;
  slip_generated: boolean;
  slip_sent: boolean;
  payment_status: 'pending' | 'paid' | 'failed';
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollAdjustment {
  id: string;
  payroll_detail_id: string;
  adjustment_type: 'bonus' | 'penalty' | 'reimbursement' | 'loan' | 'other';
  amount: number;
  description: string;
  created_by: string | null;
  created_at: string;
}

export interface PTKPRate {
  id: string;
  status: string;
  annual_amount: number;
  description: string | null;
  effective_year: number;
  created_at: string;
}

export interface WorkSchedule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  tolerance_minutes: number;
  clock_in_advance_minutes: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// --- NEW ENTERPRISE TYPES (TAX & SHIFT) ---

export interface PPh21TerRate {
  id: string;
  category_code: 'A' | 'B' | 'C';
  min_gross_income: number;
  max_gross_income: number;
  rate_percentage: number;
}

export interface PtkpTerMapping {
  ptkp_status: string;
  ter_category: 'A' | 'B' | 'C';
  annual_ptkp_amount: number;
}

export interface Shift {
  id: string;
  name: string;
  code: string | null;
  start_time: string; // HH:MM:SS
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  tolerance_minutes: number;
  clock_in_advance_minutes: number;
  is_night_shift: boolean;
  created_at?: string;
}

export interface EmployeeSchedule {
  id: string;
  user_id: string;
  shift_id: string | null;
  date: string;
  is_day_off: boolean;
  override_reason: string | null;
  created_at?: string;
  shift?: Shift;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface CompanyAsset {
  id: string;
  name: string;
  serial_number: string | null;
  category: 'electronics' | 'vehicle' | 'furniture' | 'tools' | 'other';
  status: 'available' | 'assigned' | 'broken' | 'lost' | 'maintenance';
  assigned_to: string | null;
  purchase_date: string | null;
  value: number | null;
  notes: string | null;
  assigned_employee?: Profile;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSkill {
  id: string;
  user_id: string;
  skill_name: string;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  is_certified: boolean;
  expiry_date: string | null;
  created_at: string;
}

export interface Agenda {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  meeting_link: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants?: AgendaParticipant[];
}

export interface AgendaParticipant {
  id: string;
  agenda_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  user?: Profile;
}

export interface Album {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  department_id: string | null;
  visibility: 'public' | 'department';
  created_at: string;
  updated_at: string;
  department?: Department;
  items?: AlbumItem[];
}

export interface AlbumItem {
  id: string;
  album_id: string;
  file_url: string;
  file_type: 'photo' | 'video';
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}
