-- Migration: Logbook Kendaraan & Perjalanan Driver
-- Description: Tabel untuk mencatat inventaris kendaraan dan aktivitas perjalanan driver.

-- 1. Tabel Kendaraan (Asset Management)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number TEXT UNIQUE NOT NULL, -- Plat Nomor (e.g., B 1234 ABC)
    brand_model TEXT NOT NULL, -- Merk & Model (e.g., Toyota Avanza)
    vehicle_type TEXT DEFAULT 'Operasional', -- Operasional, Direksi, Box, dll
    last_odometer INTEGER DEFAULT 0, -- Nilai KM terakhir (auto update dari logbook)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel Logbook Perjalanan (Trip Logs)
CREATE TABLE IF NOT EXISTS public.driver_trip_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    
    -- Odometer Tracking
    start_odometer INTEGER NOT NULL,
    end_odometer INTEGER,
    
    -- Trip Details
    origin TEXT,
    destination TEXT,
    purpose TEXT, -- Keperluan
    
    -- Timestamps
    start_time TIMESTAMPTZ DEFAULT now(),
    end_time TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'in_progress', -- in_progress, completed, cancelled
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_trip_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Vehicles
CREATE POLICY "Admins can manage vehicles" ON public.vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));
CREATE POLICY "Everyone can view vehicles" ON public.vehicles FOR SELECT TO authenticated USING (true);

-- 5. Policies for Trip Logs
CREATE POLICY "Drivers can manage their own logs" ON public.driver_trip_logs FOR ALL TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Admins can view all logs" ON public.driver_trip_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_hr') OR public.has_role(auth.uid(), 'manager'));

-- 6. Trigger to update vehicle odometer on trip completion
CREATE OR REPLACE FUNCTION public.sync_vehicle_odometer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.end_odometer IS NOT NULL THEN
        UPDATE public.vehicles
        SET last_odometer = NEW.end_odometer,
            updated_at = now()
        WHERE id = NEW.vehicle_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_vehicle_odometer
AFTER UPDATE ON public.driver_trip_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_odometer();
