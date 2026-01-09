-- DROP TABLES TO FORCE RECREATION (Critical Fix)
DROP TABLE IF EXISTS agenda_participants CASCADE;
DROP TABLE IF EXISTS agendas CASCADE;

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agendas table (Fresh)
CREATE TABLE agendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    meeting_link TEXT,
    created_by UUID REFERENCES public.profiles(id), -- Explicitly reference profiles
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agenda_participants table (Fresh)
CREATE TABLE agenda_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agenda_id UUID REFERENCES agendas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Explicitly reference profiles
    status TEXT DEFAULT 'pending', -- pending, accepted, declined
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agenda_id, user_id)
);

-- Enable RLS
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_participants ENABLE ROW LEVEL SECURITY;

-- Policies for agendas
CREATE POLICY "Users can view relevant agendas" ON agendas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agenda_participants 
            WHERE agenda_participants.agenda_id = agendas.id 
            AND agenda_participants.user_id = auth.uid()
        ) OR created_by = auth.uid()
    );

CREATE POLICY "Admins can manage all agendas" ON agendas
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role::text = 'admin_hr')
    );

-- Policies for agenda_participants
CREATE POLICY "Users can view their participant data" ON agenda_participants
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage participants" ON agenda_participants
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role::text = 'admin_hr')
    );

-- Trigger to notify participants
CREATE OR REPLACE FUNCTION notify_on_new_agenda()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, title, message, type, link)
    SELECT 
        user_id, 
        'Agenda Baru: ' || (SELECT title FROM agendas WHERE id = NEW.agenda_id),
        'Anda diundang ke agenda kerja baru.',
        'system',
        '/agenda'
    FROM agenda_participants
    WHERE agenda_id = NEW.agenda_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_notify_on_new_agenda
AFTER INSERT ON agenda_participants
FOR EACH ROW EXECUTE FUNCTION notify_on_new_agenda();
