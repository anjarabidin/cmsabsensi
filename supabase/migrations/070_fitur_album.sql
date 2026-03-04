-- 070_album_feature.sql
-- Fitur Album Foto & Video Perusahaan

-- 1. Tabel Album
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'department')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel Item Album (Foto/Video)
CREATE TABLE IF NOT EXISTS public.album_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('photo', 'video')),
    file_name TEXT,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Storage Bucket untuk Album
INSERT INTO storage.buckets (id, name, public) VALUES ('albums', 'albums', true) ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_items ENABLE ROW LEVEL SECURITY;

-- 5. Kebijakan RLS untuk Albums (Tabel)
-- Admin HR: Akses Penuh
CREATE POLICY "Admin HR can manage all albums" 
    ON public.albums FOR ALL TO authenticated 
    USING (public.has_role(auth.uid(), 'admin_hr'))
    WITH CHECK (public.has_role(auth.uid(), 'admin_hr'));

-- manager: Kelola departemen sendiri atau buat publik
CREATE POLICY "managers can manage own department or public albums" 
    ON public.albums FOR ALL TO authenticated 
    USING (
        public.has_role(auth.uid(), 'manager') AND (
            visibility = 'public' OR 
            department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid())
        )
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'manager') AND (
            visibility = 'public' OR 
            department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Karyawan: Lihat yang publik atau departemen sendiri
CREATE POLICY "Employees can view public or own department albums" 
    ON public.albums FOR SELECT TO authenticated 
    USING (
        visibility = 'public' OR 
        department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid())
    );

-- 6. Kebijakan RLS untuk Album Items (Konten)
-- Mengikuti akses ke parent album
CREATE POLICY "Access album items based on album visibility" 
    ON public.album_items FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.albums a
            WHERE a.id = album_id AND (
                public.has_role(auth.uid(), 'admin_hr') OR
                (public.has_role(auth.uid(), 'manager') AND (a.visibility = 'public' OR a.department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid()))) OR
                (a.visibility = 'public' OR a.department_id IN (SELECT department_id FROM public.profiles WHERE id = auth.uid()))
            )
        )
    );

-- 7. Storage Policies for 'albums' bucket
DROP POLICY IF EXISTS "Admin HR manage all album storage" ON storage.objects;
DROP POLICY IF EXISTS "managers manage own album storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users view album storage" ON storage.objects;

CREATE POLICY "Admin HR manage all album storage" ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'albums' AND public.has_role(auth.uid(), 'admin_hr'));

CREATE POLICY "managers manage own album storage" ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'albums' AND public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users view album storage" ON storage.objects FOR SELECT TO authenticated 
    USING (bucket_id = 'albums');

-- 8. Add trigger for updated_at in albums
CREATE TRIGGER update_albums_updated_at 
  BEFORE UPDATE ON public.albums 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
