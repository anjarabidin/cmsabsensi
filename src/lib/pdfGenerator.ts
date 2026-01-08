import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PayrollDetail } from '@/types';
import { formatCurrency } from './overtime';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface SlipGajiData {
  employee: {
    name: string;
    employeeId: string;
    position?: string;
    department?: string;
  };
  period: {
    month: number;
    year: number;
    periodStart: string;
    periodEnd: string;
  };
  payroll: PayrollDetail;
}

export function generateSlipGaji(data: SlipGajiData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Company Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CMS DUTA SOLUSI', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Slip Gaji Karyawan', pageWidth / 2, 27, { align: 'center' });
  
  // Period
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  doc.text(
    `Periode: ${months[data.period.month - 1]} ${data.period.year}`,
    pageWidth / 2,
    34,
    { align: 'center' }
  );
  
  // Line separator
  doc.setLineWidth(0.5);
  doc.line(15, 38, pageWidth - 15, 38);
  
  // Employee Information
  let yPos = 45;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMASI KARYAWAN', 15, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('Nama', 15, yPos);
  doc.text(': ' + data.employee.name, 60, yPos);
  
  yPos += 6;
  doc.text('ID Karyawan', 15, yPos);
  doc.text(': ' + data.employee.employeeId, 60, yPos);
  
  if (data.employee.position) {
    yPos += 6;
    doc.text('Jabatan', 15, yPos);
    doc.text(': ' + data.employee.position, 60, yPos);
  }
  
  if (data.employee.department) {
    yPos += 6;
    doc.text('Departemen', 15, yPos);
    doc.text(': ' + data.employee.department, 60, yPos);
  }
  
  yPos += 10;
  
  // Attendance Summary
  doc.setFont('helvetica', 'bold');
  doc.text('RINGKASAN KEHADIRAN', 15, yPos);
  
  yPos += 7;
  autoTable(doc, {
    startY: yPos,
    head: [['Keterangan', 'Jumlah']],
    body: [
      ['Hari Kerja', data.payroll.working_days + ' hari'],
      ['Hadir', data.payroll.present_days + ' hari'],
      ['Terlambat', data.payroll.late_count + ' kali'],
      ['Tidak Hadir', data.payroll.absent_days + ' hari'],
      ['Cuti', data.payroll.leave_days + ' hari'],
      ['Jam Lembur', data.payroll.overtime_hours.toFixed(1) + ' jam'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 'auto', halign: 'right' },
    },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // Salary Components
  doc.setFont('helvetica', 'bold');
  doc.text('KOMPONEN GAJI', 15, yPos);
  
  yPos += 7;
  autoTable(doc, {
    startY: yPos,
    head: [['Komponen', 'Jumlah']],
    body: [
      ['Gaji Pokok', formatCurrency(data.payroll.base_salary)],
      ['Tunjangan Transport', formatCurrency(data.payroll.transport_allowance)],
      ['Tunjangan Makan', formatCurrency(data.payroll.meal_allowance)],
      ['Tunjangan Jabatan', formatCurrency(data.payroll.position_allowance)],
      ['Tunjangan Perumahan', formatCurrency(data.payroll.housing_allowance)],
      ['Tunjangan Lainnya', formatCurrency(data.payroll.other_allowances)],
      ['Upah Lembur', formatCurrency(data.payroll.overtime_pay)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [92, 184, 92], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 'auto', halign: 'right' },
    },
    foot: [['TOTAL GAJI KOTOR', formatCurrency(data.payroll.gross_salary)]],
    footStyles: { fillColor: [92, 184, 92], fontStyle: 'bold', fontSize: 10 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // Deductions
  doc.setFont('helvetica', 'bold');
  doc.text('POTONGAN', 15, yPos);
  
  yPos += 7;
  autoTable(doc, {
    startY: yPos,
    head: [['Jenis Potongan', 'Jumlah']],
    body: [
      ['Potongan Keterlambatan', formatCurrency(data.payroll.late_deduction)],
      ['Potongan Tidak Hadir', formatCurrency(data.payroll.absent_deduction)],
      ['BPJS Kesehatan (Karyawan)', formatCurrency(data.payroll.bpjs_kesehatan_employee)],
      ['BPJS Ketenagakerjaan (Karyawan)', formatCurrency(data.payroll.bpjs_tk_employee)],
      ['PPh 21', formatCurrency(data.payroll.pph21)],
      ['Potongan Pinjaman', formatCurrency(data.payroll.loan_deduction)],
      ['Potongan Lainnya', formatCurrency(data.payroll.other_deductions)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [217, 83, 79], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 'auto', halign: 'right' },
    },
    foot: [['TOTAL POTONGAN', formatCurrency(data.payroll.total_deductions)]],
    footStyles: { fillColor: [217, 83, 79], fontStyle: 'bold', fontSize: 10 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // Net Salary (Highlighted)
  doc.setFillColor(240, 173, 78);
  doc.rect(15, yPos - 5, pageWidth - 30, 15, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('GAJI BERSIH (TAKE HOME PAY)', 20, yPos + 3);
  doc.text(formatCurrency(data.payroll.net_salary), pageWidth - 20, yPos + 3, { align: 'right' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  yPos += 20;
  
  // Employer Costs (Info only)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Biaya Perusahaan:', 15, yPos);
  yPos += 4;
  doc.text(`BPJS Kesehatan (Perusahaan): ${formatCurrency(data.payroll.bpjs_kesehatan_employer)}`, 15, yPos);
  yPos += 4;
  doc.text(`BPJS Ketenagakerjaan (Perusahaan): ${formatCurrency(data.payroll.bpjs_tk_employer)}`, 15, yPos);
  
  // Footer
  yPos = doc.internal.pageSize.getHeight() - 30;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Catatan:', 15, yPos);
  yPos += 4;
  doc.text('- Slip gaji ini adalah dokumen resmi dan bersifat rahasia', 15, yPos);
  yPos += 4;
  doc.text('- Untuk pertanyaan terkait gaji, hubungi HR Department', 15, yPos);
  
  yPos += 10;
  doc.setFontSize(7);
  doc.text(
    `Dicetak pada: ${format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: id })}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );
  
  return doc;
}

export function generateBatchSlipGaji(dataArray: SlipGajiData[]): jsPDF {
  const doc = new jsPDF();
  
  dataArray.forEach((data, index) => {
    if (index > 0) {
      doc.addPage();
    }
    
    const tempDoc = generateSlipGaji(data);
    
    // Copy content from temp doc to main doc
    // This is a simplified approach - in production, you'd merge pages properly
    const pageContent = tempDoc.output('datauristring');
    // For now, we'll generate each slip separately
  });
  
  return doc;
}

export function downloadSlipGaji(doc: jsPDF, employeeName: string, month: number, year: number) {
  const fileName = `slip_gaji_${employeeName.replace(/\s+/g, '_')}_${year}_${month.toString().padStart(2, '0')}.pdf`;
  doc.save(fileName);
}

export async function emailSlipGaji(
  doc: jsPDF,
  employeeEmail: string,
  employeeName: string,
  month: number,
  year: number
): Promise<boolean> {
  try {
    // Convert PDF to base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    
    // TODO: Call Supabase Edge Function to send email
    // For now, just return true
    console.log('Email slip gaji to:', employeeEmail);
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
