-- Revise Agenda Permissions to Allow managers
-- Drop restrictive policies
DROP POLICY IF EXISTS "Admins can manage all agendas" ON agendas;
DROP POLICY IF EXISTS "Manage agendas" ON agendas;

-- Create inclusive policy for Agendas
CREATE POLICY "managers and Admin can manage agendas" ON agendas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin_hr', 'manager')
  )
);

-- Revise Participant Permissions
DROP POLICY IF EXISTS "Admins can manage participants" ON agenda_participants;
DROP POLICY IF EXISTS "Manage agenda participants" ON agenda_participants;

-- Create inclusive policy for Participants
CREATE POLICY "managers and Admin can manage participants" ON agenda_participants
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin_hr', 'manager')
  )
);

-- Drop duplicate notification trigger (handled in frontend now)
DROP TRIGGER IF EXISTS tr_notify_on_new_agenda ON agenda_participants;
DROP FUNCTION IF EXISTS notify_on_new_agenda();
