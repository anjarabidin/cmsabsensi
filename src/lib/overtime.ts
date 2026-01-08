/**
 * Overtime Calculation Utilities
 * Sesuai UU Ketenagakerjaan No. 13 Tahun 2003
 */

import { OvertimePolicy } from '@/types';

export interface OvertimeCalculation {
  duration_hours: number;
  multiplier: number;
  overtime_pay: number;
  is_valid: boolean;
  validation_message?: string;
}

/**
 * Calculate overtime pay berdasarkan UU Ketenagakerjaan Indonesia
 * 
 * Rules:
 * - Hari kerja (weekday): 1.5x untuk jam 1-2, 2x untuk jam 3+
 * - Hari libur/weekend: 2x untuk jam 1-8, 3x untuk jam 9-10, 4x untuk jam 11+
 * - Maksimal 3 jam/hari untuk hari kerja
 * - Maksimal 14 jam/minggu
 */
export function calculateOvertimePay(
  startTime: string,
  endTime: string,
  baseHourlyRate: number,
  isHoliday: boolean,
  policy: OvertimePolicy
): OvertimeCalculation {
  // Parse times
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  
  // Calculate duration in hours
  const durationMs = end.getTime() - start.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  // Validation: duration must be positive
  if (durationHours <= 0) {
    return {
      duration_hours: 0,
      multiplier: 0,
      overtime_pay: 0,
      is_valid: false,
      validation_message: 'Waktu selesai harus lebih besar dari waktu mulai',
    };
  }

  // Validation: max hours per day
  if (!isHoliday && durationHours > policy.max_hours_per_day) {
    return {
      duration_hours: durationHours,
      multiplier: 0,
      overtime_pay: 0,
      is_valid: false,
      validation_message: `Lembur hari kerja maksimal ${policy.max_hours_per_day} jam/hari`,
    };
  }

  let multiplier = 0;
  let overtimePay = 0;

  if (isHoliday) {
    // Holiday/Weekend calculation
    if (durationHours <= 8) {
      multiplier = policy.holiday_multiplier_1_8_hours;
      overtimePay = durationHours * baseHourlyRate * multiplier;
    } else if (durationHours <= 10) {
      // First 8 hours at 2x
      const first8Hours = 8 * baseHourlyRate * policy.holiday_multiplier_1_8_hours;
      // Hours 9-10 at 3x
      const next2Hours = (durationHours - 8) * baseHourlyRate * policy.holiday_multiplier_9_10_hours;
      overtimePay = first8Hours + next2Hours;
      multiplier = overtimePay / (durationHours * baseHourlyRate);
    } else {
      // First 8 hours at 2x
      const first8Hours = 8 * baseHourlyRate * policy.holiday_multiplier_1_8_hours;
      // Hours 9-10 at 3x
      const hours9to10 = 2 * baseHourlyRate * policy.holiday_multiplier_9_10_hours;
      // Hours 11+ at 4x
      const hoursAfter10 = (durationHours - 10) * baseHourlyRate * policy.holiday_multiplier_11plus_hours;
      overtimePay = first8Hours + hours9to10 + hoursAfter10;
      multiplier = overtimePay / (durationHours * baseHourlyRate);
    }
  } else {
    // Weekday calculation
    if (durationHours <= 2) {
      multiplier = policy.weekday_multiplier_1_2_hours;
      overtimePay = durationHours * baseHourlyRate * multiplier;
    } else {
      // First 2 hours at 1.5x
      const first2Hours = 2 * baseHourlyRate * policy.weekday_multiplier_1_2_hours;
      // Hours 3+ at 2x
      const remainingHours = (durationHours - 2) * baseHourlyRate * policy.weekday_multiplier_3plus_hours;
      overtimePay = first2Hours + remainingHours;
      multiplier = overtimePay / (durationHours * baseHourlyRate);
    }
  }

  return {
    duration_hours: Math.round(durationHours * 100) / 100,
    multiplier: Math.round(multiplier * 100) / 100,
    overtime_pay: Math.round(overtimePay),
    is_valid: true,
  };
}

/**
 * Validate weekly overtime hours
 */
export function validateWeeklyOvertimeHours(
  currentWeekHours: number,
  newOvertimeHours: number,
  maxWeeklyHours: number
): { is_valid: boolean; message?: string } {
  const totalHours = currentWeekHours + newOvertimeHours;
  
  if (totalHours > maxWeeklyHours) {
    return {
      is_valid: false,
      message: `Total lembur minggu ini akan menjadi ${totalHours} jam. Maksimal ${maxWeeklyHours} jam/minggu.`,
    };
  }

  return { is_valid: true };
}

/**
 * Format currency to IDR
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate base hourly rate from monthly salary
 * Asumsi: 173 jam kerja per bulan (UU Ketenagakerjaan)
 */
export function calculateHourlyRate(monthlySalary: number): number {
  const workingHoursPerMonth = 173;
  return Math.round(monthlySalary / workingHoursPerMonth);
}
