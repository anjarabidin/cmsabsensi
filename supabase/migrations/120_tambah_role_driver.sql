-- Migration: Tambah Role Driver & Penugasan Driver Pribadi
-- Description: Mendukung operasional driver pribadi dengan fitur standby dan penugasan ke user tertentu.

-- 1. Tambah value ke Enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';

-- 2. Tabel Penugasan Driver (Link Driver ke Pejabat/User yang dilayani)
CREATE TABLE IF NOT EXISTS public.driver_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- User yang diantar
    vehicle_details TEXT, -- Info kendaraan (Plat, Merk)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(driver_id) -- Satu driver biasanya fokus ke satu penugasan utama
);

-- 3. Tambah kolom status operasional di profil (Opsional untuk tracking status standby)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS operational_status TEXT DEFAULT 'off_duty'; 
-- Values: standby, on_trip, rest, off_duty

-- 4. RLS Policies
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own driver assignment" 
    ON public.driver_assignments FOR SELECT 
    TO authenticated 
    USING (driver_id = auth.uid() OR principal_id = auth.uid());

CREATE POLICY "Admins can manage all driver assignments" 
    ON public.driver_assignments FOR ALL 
    TO authenticated 
    USING (public.has_role(auth.uid(), 'admin_hr'));

-- 5. Helper Function: Get My Driver/My Principal
CREATE OR REPLACE FUNCTION public.get_driver_assignment(_user_id UUID)
RETURNS TABLE (
    role_type TEXT,
    other_party_name TEXT,
    other_party_id UUID,
    vehicle TEXT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'driver'::TEXT as role_type,
        p.full_name,
        p.id as other_party_id,
        da.vehicle_details
    FROM public.driver_assignments da
    JOIN public.profiles p ON da.principal_id = p.id
    WHERE da.driver_id = _user_id AND da.is_active = true
    UNION
    SELECT 
        'principal'::TEXT as role_type,
        p.full_name,
        p.id as other_party_id,
        da.vehicle_details
    FROM public.driver_assignments da
    JOIN public.profiles p ON da.driver_id = p.id
    WHERE da.principal_id = _user_id AND da.is_active = true;
END;
$$;
