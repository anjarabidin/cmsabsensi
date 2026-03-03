-- Migration: Driver Expenses and Emoney Tracking
-- Description: Tabel untuk mencatat pengeluaran driver seperti bensin, tol, topup, dan saldo e-money.

CREATE TABLE IF NOT EXISTS public.driver_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES public.driver_trip_logs(id) ON DELETE SET NULL,
    
    -- Category: fuel, toll, topup, emoney_balance, misc
    category TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    
    -- Balance snapshot (useful for e-money tracking)
    emoney_balance NUMERIC,
    
    -- Evidence
    receipt_url TEXT, -- Link to storage (nota)
    has_receipt BOOLEAN DEFAULT true,
    
    description TEXT,
    expense_time TIMESTAMPTZ DEFAULT now(),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_expenses ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if any
DROP POLICY IF EXISTS "Drivers can manage their own expenses" ON public.driver_expenses;
DROP POLICY IF EXISTS "Admins and Managers can view all expenses" ON public.driver_expenses;

-- Policies
CREATE POLICY "Drivers can manage their own expenses" 
ON public.driver_expenses FOR ALL TO authenticated 
USING (driver_id = auth.uid());

CREATE POLICY "Admins and Managers can view all expenses" 
ON public.driver_expenses FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'manager'));

-- Storage Bucket for Receipts
-- (Note: Usually handled via Supabase Dashboard, but documenting intent here)
-- Bucket: driver-receipts
