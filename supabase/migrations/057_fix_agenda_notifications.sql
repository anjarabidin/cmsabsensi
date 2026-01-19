-- Trigger untuk notifikasi Agenda ke Peserta
-- Dipasang pada tabel agenda_participants

CREATE OR REPLACE FUNCTION notify_participant_on_new_agenda()
RETURNS TRIGGER AS $$
DECLARE
    v_agenda_title TEXT;
    v_agenda_time TIMESTAMPTZ;
BEGIN
    -- Ambil detail agenda
    SELECT title, start_time INTO v_agenda_title, v_agenda_time
    FROM public.agendas
    WHERE id = NEW.agenda_id;

    -- Masukkan ke tabel notifications (yang akan mentrigger push notif)
    -- Perbaikan: Pake kolom 'read' bukan 'is_read'
    INSERT INTO public.notifications (user_id, title, message, type, link, read)
    VALUES (
        NEW.user_id,
        'Undangan Agenda Baru',
        'Anda diundang ke: ' || v_agenda_title || ' pada ' || to_char(v_agenda_time, 'DD Mon HH24:MI'),
        'agenda_invite',
        '/agenda',
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hapus trigger lama jika ada
DROP TRIGGER IF EXISTS tr_notify_participant_new_agenda ON public.agenda_participants;

-- Pasang trigger
CREATE TRIGGER tr_notify_participant_new_agenda
AFTER INSERT ON public.agenda_participants
FOR EACH ROW
EXECUTE FUNCTION notify_participant_on_new_agenda();
