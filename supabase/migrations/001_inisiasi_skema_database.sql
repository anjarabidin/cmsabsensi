
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin_hr', 'manager', 'employee');
CREATE TYPE public.work_mode AS ENUM ('wfo', 'wfh', 'field');
CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent', 'leave', 'sick');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.leave_type AS ENUM ('annual', 'sick', 'maternity', 'paternity', 'marriage', 'bereavement', 'unpaid');

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department_id UUID REFERENCES public.departments(id),
  position TEXT,
  avatar_url TEXT,
  join_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'employee',
  UNIQUE(user_id, role)
);

-- Create manager assignments (which manager supervises which employees)
CREATE TABLE public.manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(manager_id, employee_id)
);

-- Create office_locations table
CREATE TABLE public.office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attendances table
CREATE TABLE public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  clock_in_latitude DECIMAL(10, 8),
  clock_in_longitude DECIMAL(11, 8),
  clock_out_latitude DECIMAL(10, 8),
  clock_out_longitude DECIMAL(11, 8),
  clock_in_photo_url TEXT,
  clock_out_photo_url TEXT,
  clock_in_location_id UUID REFERENCES public.office_locations(id),
  clock_out_location_id UUID REFERENCES public.office_locations(id),
  work_mode work_mode NOT NULL DEFAULT 'wfo',
  status attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  work_hours_minutes INTEGER,
  is_late BOOLEAN DEFAULT false,
  late_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status request_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create overtime_requests table
CREATE TABLE public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attendance_corrections table
CREATE TABLE public.attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES public.attendances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  original_clock_in TIMESTAMPTZ,
  original_clock_out TIMESTAMPTZ,
  corrected_clock_in TIMESTAMPTZ,
  corrected_clock_out TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create work_schedules table
CREATE TABLE public.work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  break_minutes INTEGER DEFAULT 60,
  tolerance_minutes INTEGER DEFAULT 15,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_office_locations_updated_at BEFORE UPDATE ON public.office_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendances_updated_at BEFORE UPDATE ON public.attendances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_overtime_requests_updated_at BEFORE UPDATE ON public.overtime_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendance_corrections_updated_at BEFORE UPDATE ON public.attendance_corrections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_schedules_updated_at BEFORE UPDATE ON public.work_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  -- Assign default employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments (readable by all, writable by admin_hr)
CREATE POLICY "Departments are viewable by authenticated users" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin HR can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin HR can manage all profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- RLS Policies for user_roles (only admin can manage)
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin HR can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));
CREATE POLICY "Admin HR can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- RLS Policies for manager_assignments
CREATE POLICY "Users can view their own assignments" ON public.manager_assignments FOR SELECT TO authenticated 
  USING (manager_id = auth.uid() OR employee_id = auth.uid());
CREATE POLICY "Admin HR can manage assignments" ON public.manager_assignments FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin_hr'));

-- RLS Policies for office_locations
CREATE POLICY "Office locations are viewable by authenticated users" ON public.office_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin HR can manage office locations" ON public.office_locations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- RLS Policies for attendances
CREATE POLICY "Users can view their own attendance" ON public.attendances FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own attendance" ON public.attendances FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own attendance" ON public.attendances FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin HR can view all attendances" ON public.attendances FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));
CREATE POLICY "Admin HR can manage all attendances" ON public.attendances FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));
CREATE POLICY "managers can view team attendance" ON public.attendances FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1 FROM public.manager_assignments WHERE manager_id = auth.uid() AND employee_id = public.attendances.user_id
  ));

-- RLS Policies for leave_requests
CREATE POLICY "Users can view their own leave requests" ON public.leave_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create their own leave requests" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own pending requests" ON public.leave_requests FOR UPDATE TO authenticated 
  USING (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Admin HR can manage all leave requests" ON public.leave_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));
CREATE POLICY "managers can view and approve team leave requests" ON public.leave_requests FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1 FROM public.manager_assignments WHERE manager_id = auth.uid() AND employee_id = public.leave_requests.user_id
  ));

-- RLS Policies for overtime_requests
CREATE POLICY "Users can view their own overtime requests" ON public.overtime_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create their own overtime requests" ON public.overtime_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own pending requests" ON public.overtime_requests FOR UPDATE TO authenticated 
  USING (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Admin HR can manage all overtime requests" ON public.overtime_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));
CREATE POLICY "managers can view and approve team overtime requests" ON public.overtime_requests FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1 FROM public.manager_assignments WHERE manager_id = auth.uid() AND employee_id = public.overtime_requests.user_id
  ));

-- RLS Policies for attendance_corrections
CREATE POLICY "Users can view their own corrections" ON public.attendance_corrections FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create their own corrections" ON public.attendance_corrections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin HR can manage all corrections" ON public.attendance_corrections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- RLS Policies for work_schedules
CREATE POLICY "Work schedules are viewable by authenticated users" ON public.work_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin HR can manage work schedules" ON public.work_schedules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- RLS Policies for announcements
CREATE POLICY "Active announcements are viewable by authenticated users" ON public.announcements FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admin HR can manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));

-- RLS Policies for audit_logs
CREATE POLICY "Admin HR can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_hr'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default work schedule
INSERT INTO public.work_schedules (name, start_time, end_time, break_minutes, tolerance_minutes, is_default)
VALUES ('Jadwal Standar', '08:00:00', '17:00:00', 60, 15, true);

-- Insert default department
INSERT INTO public.departments (name, description)
VALUES ('General', 'Default department');

-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', true);

-- Storage policies for attendance photos
CREATE POLICY "Users can upload their own photos" ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Photos are publicly accessible" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'attendance-photos');
CREATE POLICY "Users can update their own photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
