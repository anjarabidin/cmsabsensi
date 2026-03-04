-- STEP 8: AGENDA HARDENING & SUPER ADMIN ACCESS
-- This migration ensures 'super_admin' has full access to agendas and participants.

-- 1. AGENDAS
DROP POLICY IF EXISTS "managers and Admin can manage agendas" ON public.agendas;
DROP POLICY IF EXISTS "Manage agendas" ON public.agendas;
DROP POLICY IF EXISTS "Super Admin can manage agendas" ON public.agendas;

CREATE POLICY "Super Admin and Admin can manage agendas" ON public.agendas
FOR ALL TO authenticated
USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'admin_hr') OR
    (public.has_role(auth.uid(), 'manager'))
);

-- Note: 'View agendas' is already public (true), but let's re-verify it.
DROP POLICY IF EXISTS "View agendas" ON public.agendas;
CREATE POLICY "View agendas" ON public.agendas FOR SELECT TO authenticated USING (true);

-- 2. AGENDA PARTICIPANTS
DROP POLICY IF EXISTS "managers and Admin can manage participants" ON public.agenda_participants;
DROP POLICY IF EXISTS "Manage agenda participants" ON public.agenda_participants;

CREATE POLICY "Super Admin and Admin can manage participants" ON public.agenda_participants
FOR ALL TO authenticated
USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'admin_hr') OR
    (public.has_role(auth.uid(), 'manager'))
);

DROP POLICY IF EXISTS "View agenda participants" ON public.agenda_participants;
CREATE POLICY "View agenda participants" ON public.agenda_participants FOR SELECT TO authenticated USING (true);

-- 3. REFRESH
NOTIFY pgrst, 'reload config';
