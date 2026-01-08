-- Face Recognition System Migration
-- For Hybrid Enrollment System

-- Create face descriptors table
CREATE TABLE IF NOT EXISTS public.face_descriptors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  descriptor REAL[] NOT NULL, -- Face descriptor array (128 dimensions)
  image_url TEXT, -- URL to face image in storage
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  capture_angle INTEGER CHECK (capture_angle >= 0 AND capture_angle <= 360), -- Angle of capture (0-360 degrees)
  device_info JSONB, -- Device information during capture
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_active ON public.face_descriptors (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_created_at ON public.face_descriptors (created_at);
CREATE INDEX IF NOT EXISTS idx_quality_score ON public.face_descriptors (quality_score);

-- Create face recognition logs table
CREATE TABLE IF NOT EXISTS public.face_recognition_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.attendances(id) ON DELETE SET NULL,
  attempt_type VARCHAR(20) CHECK (attempt_type IN ('attendance', 'verification', 'registration')),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  processing_time_ms INTEGER, -- Processing time in milliseconds
  device_info JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for face_recognition_logs
CREATE INDEX IF NOT EXISTS idx_user_created ON public.face_recognition_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_success ON public.face_recognition_logs (success);
CREATE INDEX IF NOT EXISTS idx_attempt_type ON public.face_recognition_logs (attempt_type);

-- Create face recognition settings table
CREATE TABLE IF NOT EXISTS public.face_recognition_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.7 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  max_attempts INTEGER DEFAULT 3,
  lockout_duration_minutes INTEGER DEFAULT 5,
  require_liveness_check BOOLEAN DEFAULT false,
  fallback_to_pin BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per user
  UNIQUE(user_id)
);

-- Create face enrollment sessions table
CREATE TABLE IF NOT EXISTS public.face_enrollment_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'expired')),
  required_captures INTEGER DEFAULT 3, -- Number of face captures required
  completed_captures INTEGER DEFAULT 0,
  quality_threshold DECIMAL(3,2) DEFAULT 0.6,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for face_enrollment_sessions
CREATE INDEX IF NOT EXISTS idx_user_status ON public.face_enrollment_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_token ON public.face_enrollment_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_expires ON public.face_enrollment_sessions (expires_at);

-- Function to calculate face similarity
CREATE OR REPLACE FUNCTION public.calculate_face_similarity(
  descriptor1 REAL[],
  descriptor2 REAL[]
) RETURNS DECIMAL(3,2) AS $$
DECLARE
  distance DOUBLE PRECISION;
  similarity DECIMAL(3,2);
BEGIN
  -- Calculate Euclidean distance using PostgreSQL vector distance
  distance := sqrt(
    (descriptor1[1] - descriptor2[1])^2 +
    (descriptor1[2] - descriptor2[2])^2 +
    (descriptor1[3] - descriptor2[3])^2 +
    (descriptor1[4] - descriptor2[4])^2 +
    (descriptor1[5] - descriptor2[5])^2 +
    (descriptor1[6] - descriptor2[6])^2 +
    (descriptor1[7] - descriptor2[7])^2 +
    (descriptor1[8] - descriptor2[8])^2 +
    (descriptor1[9] - descriptor2[9])^2 +
    (descriptor1[10] - descriptor2[10])^2 +
    (descriptor1[11] - descriptor2[11])^2 +
    (descriptor1[12] - descriptor2[12])^2 +
    (descriptor1[13] - descriptor2[13])^2 +
    (descriptor1[14] - descriptor2[14])^2 +
    (descriptor1[15] - descriptor2[15])^2 +
    (descriptor1[16] - descriptor2[16])^2 +
    (descriptor1[17] - descriptor2[17])^2 +
    (descriptor1[18] - descriptor2[18])^2 +
    (descriptor1[19] - descriptor2[19])^2 +
    (descriptor1[20] - descriptor2[20])^2 +
    (descriptor1[21] - descriptor2[21])^2 +
    (descriptor1[22] - descriptor2[22])^2 +
    (descriptor1[23] - descriptor2[23])^2 +
    (descriptor1[24] - descriptor2[24])^2 +
    (descriptor1[25] - descriptor2[25])^2 +
    (descriptor1[26] - descriptor2[26])^2 +
    (descriptor1[27] - descriptor2[27])^2 +
    (descriptor1[28] - descriptor2[28])^2 +
    (descriptor1[29] - descriptor2[29])^2 +
    (descriptor1[30] - descriptor2[30])^2 +
    (descriptor1[31] - descriptor2[31])^2 +
    (descriptor1[32] - descriptor2[32])^2 +
    (descriptor1[33] - descriptor2[33])^2 +
    (descriptor1[34] - descriptor2[34])^2 +
    (descriptor1[35] - descriptor2[35])^2 +
    (descriptor1[36] - descriptor2[36])^2 +
    (descriptor1[37] - descriptor2[37])^2 +
    (descriptor1[38] - descriptor2[38])^2 +
    (descriptor1[39] - descriptor2[39])^2 +
    (descriptor1[40] - descriptor2[40])^2 +
    (descriptor1[41] - descriptor2[41])^2 +
    (descriptor1[42] - descriptor2[42])^2 +
    (descriptor1[43] - descriptor2[43])^2 +
    (descriptor1[44] - descriptor2[44])^2 +
    (descriptor1[45] - descriptor2[45])^2 +
    (descriptor1[46] - descriptor2[46])^2 +
    (descriptor1[47] - descriptor2[47])^2 +
    (descriptor1[48] - descriptor2[48])^2 +
    (descriptor1[49] - descriptor2[49])^2 +
    (descriptor1[50] - descriptor2[50])^2 +
    (descriptor1[51] - descriptor2[51])^2 +
    (descriptor1[52] - descriptor2[52])^2 +
    (descriptor1[53] - descriptor2[53])^2 +
    (descriptor1[54] - descriptor2[54])^2 +
    (descriptor1[55] - descriptor2[55])^2 +
    (descriptor1[56] - descriptor2[56])^2 +
    (descriptor1[57] - descriptor2[57])^2 +
    (descriptor1[58] - descriptor2[58])^2 +
    (descriptor1[59] - descriptor2[59])^2 +
    (descriptor1[60] - descriptor2[60])^2 +
    (descriptor1[61] - descriptor2[61])^2 +
    (descriptor1[62] - descriptor2[62])^2 +
    (descriptor1[63] - descriptor2[63])^2 +
    (descriptor1[64] - descriptor2[64])^2 +
    (descriptor1[65] - descriptor2[65])^2 +
    (descriptor1[66] - descriptor2[66])^2 +
    (descriptor1[67] - descriptor2[67])^2 +
    (descriptor1[68] - descriptor2[68])^2 +
    (descriptor1[69] - descriptor2[69])^2 +
    (descriptor1[70] - descriptor2[70])^2 +
    (descriptor1[71] - descriptor2[71])^2 +
    (descriptor1[72] - descriptor2[72])^2 +
    (descriptor1[73] - descriptor2[73])^2 +
    (descriptor1[74] - descriptor2[74])^2 +
    (descriptor1[75] - descriptor2[75])^2 +
    (descriptor1[76] - descriptor2[76])^2 +
    (descriptor1[77] - descriptor2[77])^2 +
    (descriptor1[78] - descriptor2[78])^2 +
    (descriptor1[79] - descriptor2[79])^2 +
    (descriptor1[80] - descriptor2[80])^2 +
    (descriptor1[81] - descriptor2[81])^2 +
    (descriptor1[82] - descriptor2[82])^2 +
    (descriptor1[83] - descriptor2[83])^2 +
    (descriptor1[84] - descriptor2[84])^2 +
    (descriptor1[85] - descriptor2[85])^2 +
    (descriptor1[86] - descriptor2[86])^2 +
    (descriptor1[87] - descriptor2[87])^2 +
    (descriptor1[88] - descriptor2[88])^2 +
    (descriptor1[89] - descriptor2[89])^2 +
    (descriptor1[90] - descriptor2[90])^2 +
    (descriptor1[91] - descriptor2[91])^2 +
    (descriptor1[92] - descriptor2[92])^2 +
    (descriptor1[93] - descriptor2[93])^2 +
    (descriptor1[94] - descriptor2[94])^2 +
    (descriptor1[95] - descriptor2[95])^2 +
    (descriptor1[96] - descriptor2[96])^2 +
    (descriptor1[97] - descriptor2[97])^2 +
    (descriptor1[98] - descriptor2[98])^2 +
    (descriptor1[99] - descriptor2[99])^2 +
    (descriptor1[100] - descriptor2[100])^2 +
    (descriptor1[101] - descriptor2[101])^2 +
    (descriptor1[102] - descriptor2[102])^2 +
    (descriptor1[103] - descriptor2[103])^2 +
    (descriptor1[104] - descriptor2[104])^2 +
    (descriptor1[105] - descriptor2[105])^2 +
    (descriptor1[106] - descriptor2[106])^2 +
    (descriptor1[107] - descriptor2[107])^2 +
    (descriptor1[108] - descriptor2[108])^2 +
    (descriptor1[109] - descriptor2[109])^2 +
    (descriptor1[110] - descriptor2[110])^2 +
    (descriptor1[111] - descriptor2[111])^2 +
    (descriptor1[112] - descriptor2[112])^2 +
    (descriptor1[113] - descriptor2[113])^2 +
    (descriptor1[114] - descriptor2[114])^2 +
    (descriptor1[115] - descriptor2[115])^2 +
    (descriptor1[116] - descriptor2[116])^2 +
    (descriptor1[117] - descriptor2[117])^2 +
    (descriptor1[118] - descriptor2[118])^2 +
    (descriptor1[119] - descriptor2[119])^2 +
    (descriptor1[120] - descriptor2[120])^2 +
    (descriptor1[121] - descriptor2[121])^2 +
    (descriptor1[122] - descriptor2[122])^2 +
    (descriptor1[123] - descriptor2[123])^2 +
    (descriptor1[124] - descriptor2[124])^2 +
    (descriptor1[125] - descriptor2[125])^2 +
    (descriptor1[126] - descriptor2[126])^2 +
    (descriptor1[127] - descriptor2[127])^2 +
    (descriptor1[128] - descriptor2[128])^2
  );
  
  -- Convert distance to similarity (0-1 scale)
  -- Lower distance = higher similarity
  similarity := 1 - (distance / 2.0);
  
  -- Ensure similarity is between 0 and 1
  similarity := GREATEST(0, LEAST(1, similarity));
  
  RETURN similarity;
END;
$$ LANGUAGE plpgsql;

-- Function to find best face match
CREATE OR REPLACE FUNCTION public.find_best_face_match(
  p_user_id UUID,
  p_descriptor REAL[],
  p_threshold DECIMAL(3,2) DEFAULT 0.7
) RETURNS TABLE (
  face_id UUID,
  similarity DECIMAL(3,2),
  image_url TEXT,
  quality_score DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fd.id,
    calculate_face_similarity(fd.descriptor, p_descriptor) as similarity,
    fd.image_url,
    fd.quality_score
  FROM public.face_descriptors fd
  WHERE fd.user_id = p_user_id
    AND fd.is_active = true
    AND calculate_face_similarity(fd.descriptor, p_descriptor) >= p_threshold
  ORDER BY similarity DESC, fd.quality_score DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to log face recognition attempts
CREATE OR REPLACE FUNCTION public.log_face_recognition_attempt(
  p_user_id UUID,
  p_attempt_type VARCHAR(20),
  p_confidence DECIMAL(3,2),
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_processing_time_ms INTEGER DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_attendance_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.face_recognition_logs (
    user_id,
    attempt_type,
    confidence,
    success,
    error_message,
    processing_time_ms,
    device_info,
    ip_address,
    attendance_id
  ) VALUES (
    p_user_id,
    p_attempt_type,
    p_confidence,
    p_success,
    p_error_message,
    p_processing_time_ms,
    p_device_info,
    p_ip_address,
    p_attendance_id
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has face enrollment
CREATE OR REPLACE FUNCTION public.has_face_enrollment(p_user_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  face_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO face_count
  FROM public.face_descriptors
  WHERE user_id = p_user_id AND is_active = true;
  
  RETURN face_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get user face recognition settings
CREATE OR REPLACE FUNCTION public.get_face_settings(p_user_id UUID)
RETURNS TABLE (
  is_enabled BOOLEAN,
  confidence_threshold DECIMAL(3,2),
  max_attempts INTEGER,
  lockout_duration_minutes INTEGER,
  require_liveness_check BOOLEAN,
  fallback_to_pin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(is_enabled, true),
    COALESCE(confidence_threshold, 0.7),
    COALESCE(max_attempts, 3),
    COALESCE(lockout_duration_minutes, 5),
    COALESCE(require_liveness_check, false),
    COALESCE(fallback_to_pin, true)
  FROM public.face_recognition_settings
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for face_descriptors
ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own face descriptors" ON public.face_descriptors
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own face descriptors" ON public.face_descriptors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own face descriptors" ON public.face_descriptors
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own face descriptors" ON public.face_descriptors
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for face_recognition_logs
ALTER TABLE public.face_recognition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own face logs" ON public.face_recognition_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own face logs" ON public.face_recognition_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for face_recognition_settings
ALTER TABLE public.face_recognition_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own face settings" ON public.face_recognition_settings
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for face_enrollment_sessions
ALTER TABLE public.face_enrollment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own enrollment sessions" ON public.face_enrollment_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create storage bucket for face images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('face-images', 'face-images', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for face images
CREATE POLICY "Users can upload own face images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'face-images' AND auth.role() IN ('authenticated', 'admin_hr', 'manager'));

CREATE POLICY "Users can view own face images" ON storage.objects
  FOR SELECT USING (bucket_id = 'face-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own face images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'face-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own face images" ON storage.objects
  FOR DELETE USING (bucket_id = 'face-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Comments
COMMENT ON TABLE public.face_descriptors IS 'Stores face descriptors for face recognition';
COMMENT ON TABLE public.face_recognition_logs IS 'Logs all face recognition attempts';
COMMENT ON TABLE public.face_recognition_settings IS 'User settings for face recognition';
COMMENT ON TABLE public.face_enrollment_sessions IS 'Sessions for face enrollment process';
