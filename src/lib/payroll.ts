/**
 * Payroll Utilities
 * Generate monthly attendance summary untuk payroll processing
 */

import { supabase } from '@/integrations/supabase/client';
import { MonthlyAttendanceSummary } from '@/types';

export interface PayrollSummaryInput {
  userId: string;
  month: number;
  year: number;
}

export interface PayrollCalculation {
  totalWorkingDays: number;
  totalPresent: number;
  totalLate: number;
  totalLateMinutes: number;
  totalAbsent: number;
  totalLeaveDays: number;
  totalOvertimeHours: number;
  totalOvertimePay: number;
  deductions: number;
}

/**
 * Generate monthly attendance summary untuk satu user
 */
export async function generateMonthlySummary(
  input: PayrollSummaryInput
): Promise<PayrollCalculation> {
  const { userId, month, year } = input;

  // Get start and end date of month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Calculate total working days (exclude weekends)
  let totalWorkingDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      totalWorkingDays++;
    }
  }

  // Fetch attendances for the month
  const { data: attendances } = await supabase
    .from('attendances')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDateStr)
    .lte('date', endDateStr);

  // Fetch approved leave requests
  const { data: leaves } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .or(`start_date.lte.${endDateStr},end_date.gte.${startDateStr}`);

  // Fetch approved overtime requests
  const { data: overtimes } = await supabase
    .from('overtime_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .gte('date', startDateStr)
    .lte('date', endDateStr);

  // Calculate stats
  let totalPresent = 0;
  let totalLate = 0;
  let totalLateMinutes = 0;

  attendances?.forEach((att) => {
    if (att.status === 'present' || att.status === 'late') {
      totalPresent++;
    }
    if (att.is_late) {
      totalLate++;
      totalLateMinutes += att.late_minutes || 0;
    }
  });

  // Calculate leave days
  let totalLeaveDays = 0;
  leaves?.forEach((leave) => {
    const leaveStart = new Date(leave.start_date);
    const leaveEnd = new Date(leave.end_date);
    
    // Count only working days within the month
    for (let d = new Date(Math.max(leaveStart.getTime(), startDate.getTime())); 
         d <= new Date(Math.min(leaveEnd.getTime(), endDate.getTime())); 
         d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalLeaveDays++;
      }
    }
  });

  // Calculate overtime
  let totalOvertimeHours = 0;
  let totalOvertimePay = 0;

  overtimes?.forEach((ot) => {
    totalOvertimeHours += ot.duration_minutes / 60;
    totalOvertimePay += ot.calculated_overtime_pay || 0;
  });

  // Calculate absent days
  const totalAbsent = totalWorkingDays - totalPresent - totalLeaveDays;

  // Calculate deductions (example: Rp 50,000 per keterlambatan > 15 menit)
  const lateDeductionRate = 50000;
  const deductions = totalLate > 0 ? totalLate * lateDeductionRate : 0;

  return {
    totalWorkingDays,
    totalPresent,
    totalLate,
    totalLateMinutes,
    totalAbsent: Math.max(0, totalAbsent),
    totalLeaveDays,
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    totalOvertimePay,
    deductions,
  };
}

/**
 * Save monthly summary to database
 */
export async function saveMonthlySummary(
  input: PayrollSummaryInput,
  calculation: PayrollCalculation
): Promise<MonthlyAttendanceSummary | null> {
  const { userId, month, year } = input;

  const { data, error } = await supabase
    .from('monthly_attendance_summary')
    .upsert({
      user_id: userId,
      month,
      year,
      total_working_days: calculation.totalWorkingDays,
      total_present: calculation.totalPresent,
      total_late: calculation.totalLate,
      total_late_minutes: calculation.totalLateMinutes,
      total_absent: calculation.totalAbsent,
      total_leave_days: calculation.totalLeaveDays,
      total_overtime_hours: calculation.totalOvertimeHours,
      total_overtime_pay: calculation.totalOvertimePay,
      deductions: calculation.deductions,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving monthly summary:', error);
    return null;
  }

  return data as MonthlyAttendanceSummary;
}

/**
 * Generate summary untuk semua users (untuk HR)
 */
export async function generateAllUsersSummary(
  month: number,
  year: number
): Promise<MonthlyAttendanceSummary[]> {
  // Get all active users
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true);

  if (!profiles) return [];

  const summaries: MonthlyAttendanceSummary[] = [];

  for (const profile of profiles) {
    const calculation = await generateMonthlySummary({
      userId: profile.id,
      month,
      year,
    });

    const summary = await saveMonthlySummary(
      { userId: profile.id, month, year },
      calculation
    );

    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

/**
 * Export to CSV format untuk payroll software
 */
export function exportToPayrollCSV(summaries: MonthlyAttendanceSummary[]): string {
  const headers = [
    'User ID',
    'Bulan',
    'Tahun',
    'Hari Kerja',
    'Hadir',
    'Terlambat',
    'Menit Terlambat',
    'Tidak Hadir',
    'Cuti',
    'Jam Lembur',
    'Upah Lembur',
    'Potongan',
  ];

  const rows = summaries.map((s) => [
    s.user_id,
    s.month,
    s.year,
    s.total_working_days,
    s.total_present,
    s.total_late,
    s.total_late_minutes,
    s.total_absent,
    s.total_leave_days,
    s.total_overtime_hours,
    s.total_overtime_pay,
    s.deductions,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csvContent;
}
