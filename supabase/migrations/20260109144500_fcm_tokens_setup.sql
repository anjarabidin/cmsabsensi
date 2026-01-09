-- Create a table to store FCM Tokens for native push notifications
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT, -- android, ios, web
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own tokens
CREATE POLICY "Users can manage their own tokens" ON fcm_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_fcm_tokens_updated_at
    BEFORE UPDATE ON fcm_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
