import { supabase } from '@/integrations/supabase/client';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface EmailResponse {
  success: boolean;
  message: string;
  error?: string;
}

class EmailService {
  private static edgeFunctionUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/send-email';

  /**
   * Send email using Supabase Edge Function
   */
  static async sendEmail(data: EmailData): Promise<EmailResponse> {
    try {
      const { data: response, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: data.to,
          subject: data.subject,
          html: data.html,
          from: data.from || 'CMS Duta Solusi <noreply@cmsdutasolusi.com>',
          replyTo: data.replyTo
        }
      });

      if (error) {
        console.error('Email service error:', error);
        return {
          success: false,
          message: 'Failed to send email',
          error: error.message
        };
      }

      return response as EmailResponse;
    } catch (error) {
      console.error('Email service error:', error);
      return {
        success: false,
        message: 'Failed to send email',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send leave approval notification
   */
  static async sendLeaveApprovalNotification(
    employeeName: string,
    employeeEmail: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    status: 'approved' | 'rejected',
    approverName: string,
    rejectionReason?: string
  ): Promise<EmailResponse> {
    const subject = status === 'approved' 
      ? 'Pengajuan Cuti Disetujui' 
      : 'Pengajuan Cuti Ditolak';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #64748b; }
          .status { padding: 4px 12px; border-radius: 4px; font-weight: bold; display: inline-block; }
          .status.approved { background: #10b981; color: white; }
          .status.rejected { background: #ef4444; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subject}</h1>
          </div>
          <div class="content">
            <p>Halo ${employeeName},</p>
            <p>Pengajuan cuti Anda telah ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh ${approverName}.</p>
            
            <div style="margin: 20px 0;">
              <strong>Detail Pengajuan:</strong><br>
              Jenis Cuti: ${leaveType}<br>
              Periode: ${startDate} - ${endDate}
            </div>

            ${rejectionReason && status === 'rejected' ? `
            <div style="margin: 20px 0; padding: 15px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <strong>Alasan Penolakan:</strong><br>
              ${rejectionReason}
            </div>
            ` : ''}

            <div class="status ${status}">
              ${status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
            </div>
          </div>
          <div class="footer">
            <p>© 2026 CMS Duta Solusi - Enterprise System</p>
            <p>Email ini dikirim otomatis, jangan balas email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject,
      html
    });
  }

  /**
   * Send overtime approval notification
   */
  static async sendOvertimeApprovalNotification(
    employeeName: string,
    employeeEmail: string,
    date: string,
    startTime: string,
    endTime: string,
    duration: string,
    calculatedPay: number,
    status: 'approved' | 'rejected',
    approverName: string,
    rejectionReason?: string
  ): Promise<EmailResponse> {
    const subject = status === 'approved' 
      ? 'Pengajuan Lembur Disetujui' 
      : 'Pengajuan Lembur Ditolak';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #64748b; }
          .status { padding: 4px 12px; border-radius: 4px; font-weight: bold; display: inline-block; }
          .status.approved { background: #10b981; color: white; }
          .status.rejected { background: #ef4444; color: white; }
          .pay-amount { font-size: 18px; font-weight: bold; color: #10b981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subject}</h1>
          </div>
          <div class="content">
            <p>Halo ${employeeName},</p>
            <p>Pengajuan lembur Anda telah ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh ${approverName}.</p>
            
            <div style="margin: 20px 0;">
              <strong>Detail Pengajuan:</strong><br>
              Tanggal: ${date}<br>
              Jam: ${startTime} - ${endTime}<br>
              Durasi: ${duration}<br>
              Upah Lembur: <span class="pay-amount">Rp ${calculatedPay.toLocaleString('id-ID')}</span>
            </div>

            ${rejectionReason && status === 'rejected' ? `
            <div style="margin: 20px 0; padding: 15px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <strong>Alasan Penolakan:</strong><br>
              ${rejectionReason}
            </div>
            ` : ''}

            <div class="status ${status}">
              ${status === 'approved' ? '✅ Disetujui' : '❌ Ditolak'}
            </div>
          </div>
          <div class="footer">
            <p>© 2026 CMS Duta Solusi - Enterprise System</p>
            <p>Email ini dikirim otomatis, jangan balas email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject,
      html
    });
  }

  /**
   * Send payroll notification
   */
  static async sendPayrollNotification(
    employeeName: string,
    employeeEmail: string,
    payrollPeriod: string,
    netSalary: number,
    status: 'generated' | 'finalized' | 'paid'
  ): Promise<EmailResponse> {
    const subject = `Payroll ${status === 'generated' ? 'Generated' : status === 'finalized' ? 'Finalized' : 'Paid'} - ${payrollPeriod}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #64748b; }
          .status { padding: 4px 12px; border-radius: 4px; font-weight: bold; display: inline-block; margin: 10px 0; }
          .status.generated { background: #3b82f6; color: white; }
          .status.finalized { background: #10b981; color: white; }
          .status.paid { background: #059669; color: white; }
          .salary { font-size: 24px; font-weight: bold; color: #10b981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payroll ${status.charAt(0).toUpperCase() + status.slice(1)}</h1>
          </div>
          <div class="content">
            <p>Halo ${employeeName},</p>
            <p>Payroll untuk periode ${payrollPeriod} telah ${status === 'generated' ? 'dibuat' : status === 'finalized' ? 'finalisasi' : 'dibayar'}.</p>
            
            <div style="margin: 20px 0;">
              <strong>Detail Payroll:</strong><br>
              Periode: ${payrollPeriod}<br>
              Gaji Bersih: <span class="salary">Rp ${netSalary.toLocaleString('id-ID')}</span>
            </div>

            <div class="status ${status}">
              ${status === 'generated' ? '📋 Generated' : status === 'finalized' ? '✅ Finalized' : '💰 Paid'}
            </div>

            ${status === 'paid' ? `
            <p style="margin-top: 20px; padding: 15px; background: #dcfce7; border-radius: 4px;">
              <strong>Catatan:</strong> Slip gaji akan dikirim terpisah melalui email atau dapat diunduh dari sistem.
            </p>
            ` : ''}
          </div>
          <div class="footer">
            <p>© 2026 CMS Duta Solusi - Enterprise System</p>
            <p>Email ini dikirim otomatis, jangan balas email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject,
      html
    });
  }

  /**
   * Send welcome email for new users
   */
  static async sendWelcomeEmail(employeeName: string, employeeEmail: string, temporaryPassword: string): Promise<EmailResponse> {
    const subject = 'Selamat Datang di CMS Duta Solusi';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
          .footer { background: #f1f5f9; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #64748b; }
          .password { background: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; text-align: center; }
          .btn { display: inline-block; padding: 10px 20px; background: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Selamat Datang di CMS Duta Solusi!</h1>
          </div>
          <div class="content">
            <p>Halo ${employeeName},</p>
            <p>Selamat bergabung dengan tim CMS Duta Solusi! Akun Anda telah dibuat dan siap digunakan.</p>
            
            <div style="margin: 20px 0;">
              <strong>Informasi Login:</strong><br>
              Email: ${employeeEmail}<br>
              Password Sementara: <div class="password">${temporaryPassword}</div>
            </div>

            <p style="margin: 20px 0;">
              <strong>Langkah Pertama:</strong><br>
              1. Login ke sistem menggunakan email dan password di atas<br>
              2. Ganti password dengan password yang lebih aman<br>
              3. Lengkapi profil Anda jika diperlukan<br>
              4. Mulai menggunakan sistem absensi dan payroll
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${import.meta.env.VITE_SUPABASE_URL}/auth" class="btn">
                Login Sekarang
              </a>
            </div>
          </div>
          <div class="footer">
            <p>© 2026 CMS Duta Solusi - Enterprise System</p>
            <p>Jika ada pertanyaan, hubungi tim IT support.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject,
      html
    });
  }
}

export default EmailService;
