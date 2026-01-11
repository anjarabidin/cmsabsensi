-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agendas table
CREATE TABLE IF NOT EXISTS agendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    meeting_link TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agenda_participants table
CREATE TABLE IF NOT EXISTS agenda_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agenda_id UUID REFERENCES agendas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- pending, accepted, declined
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agenda_id, user_id)
);

-- Enable RLS
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_participants ENABLE ROW LEVEL SECURITY;

-- Policies for agendas
DROP POLICY IF EXISTS "Users can view relevant agendas" ON agendas;
CREATE POLICY "Users can view relevant agendas" ON agendas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agenda_participants 
            WHERE agenda_participants.agenda_id = agendas.id 
            AND agenda_participants.user_id = auth.uid()
        ) OR created_by = auth.uid()
    );

DROP POLICY IF EXISTS "Admins can manage all agendas" ON agendas;
CREATE POLICY "Admins can manage all agendas" ON agendas
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role::text = 'admin_hr')
    );

-- Policies for agenda_participants
DROP POLICY IF EXISTS "Users can view their participant data" ON agenda_participants;
CREATE POLICY "Users can view their participant data" ON agenda_participants
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage participants" ON agenda_participants;
CREATE POLICY "Admins can manage participants" ON agenda_participants
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role::text = 'admin_hr')
    );

-- Trigger to notify participants when a new agenda is created
CREATE OR REPLACE FUNCTION notify_on_new_agenda()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, title, message, type, link)
    SELECT 
        user_id, 
        'CMS | Agenda Baru: ' || (SELECT title FROM agendas WHERE id = NEW.agenda_id),
        'Anda diundang ke agenda kerja baru.',
        'system',
        '/agenda'
    FROM agenda_participants
    WHERE agenda_id = NEW.agenda_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_notify_on_new_agenda ON agenda_participants;
CREATE TRIGGER tr_notify_on_new_agenda
AFTER INSERT ON agenda_participants
FOR EACH ROW EXECUTE FUNCTION notify_on_new_agenda();
