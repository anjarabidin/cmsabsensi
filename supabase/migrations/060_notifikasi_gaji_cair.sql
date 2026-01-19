-- Trigger untuk mengirim notifikasi saat status Payroll berubah menjadi 'paid'

CREATE OR REPLACE FUNCTION notify_employees_on_salary_paid()
RETURNS TRIGGER AS $$
DECLARE
    v_month_name TEXT;
BEGIN
    -- Hanya jalankan jika status berubah menjadi 'paid'
    IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
        
        -- Konversi nomor bulan ke nama bulan Indonesia (manual case agar simpel)
        v_month_name := CASE NEW.month
            WHEN 1 THEN 'Januari'
            WHEN 2 THEN 'Februari'
            WHEN 3 THEN 'Maret'
            WHEN 4 THEN 'April'
            WHEN 5 THEN 'Mei'
            WHEN 6 THEN 'Juni'
            WHEN 7 THEN 'Juli'
            WHEN 8 THEN 'Agustus'
            WHEN 9 THEN 'September'
            WHEN 10 THEN 'Oktober'
            WHEN 11 THEN 'November'
            WHEN 12 THEN 'Desember'
            ELSE 'Bulan Ini'
        END;

        -- Insert notifikasi masal ke semua pegawai yang ada di payroll ini
        -- Perbaikan: Pake kolom 'read' bukan 'is_read'
        INSERT INTO notifications (user_id, title, message, type, link, read)
        SELECT 
            user_id,
            'Slip Gaji Tersedia',
            'Hore! Gaji bulan ' || v_month_name || ' ' || NEW.year || ' telah cair dan slip gaji sudah diterbitkan. Silakan cek menu Gaji.',
            'salary_paid',
            '/salary-slips',
            false
        FROM payroll_details
        WHERE payroll_run_id = NEW.id;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pasang Trigger pada tabel payroll_runs
DROP TRIGGER IF EXISTS tr_notify_salary_paid ON payroll_runs;

CREATE TRIGGER tr_notify_salary_paid
AFTER UPDATE ON payroll_runs
FOR EACH ROW
EXECUTE FUNCTION notify_employees_on_salary_paid();
