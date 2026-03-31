-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

-- User roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'employee',
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    cpf TEXT,
    phone TEXT,
    photo_url TEXT,
    username TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Time records
CREATE TABLE public.time_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    record_time TIME NOT NULL DEFAULT CURRENT_TIME,
    record_type TEXT NOT NULL CHECK (record_type IN ('entrada', 'saida', 'intervalo_inicio', 'intervalo_fim')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    location_status TEXT CHECK (location_status IN ('dentro', 'fora')),
    outside_reason TEXT,
    is_late BOOLEAN DEFAULT false,
    late_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

-- Work schedules
CREATE TABLE public.work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, day_of_week)
);
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

-- Requests
CREATE TABLE public.requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('folga', 'ferias', 'falta', 'troca', 'ajuste')),
    request_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Vacations
CREATE TABLE public.vacations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vacations ENABLE ROW LEVEL SECURITY;

-- Monthly hours bank
CREATE TABLE public.monthly_hours_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    total_hours_worked NUMERIC(6,2) DEFAULT 0,
    overtime_hours NUMERIC(6,2) DEFAULT 0,
    missing_hours NUMERIC(6,2) DEFAULT 0,
    days_worked INTEGER DEFAULT 0,
    days_absent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, month, year)
);
ALTER TABLE public.monthly_hours_bank ENABLE ROW LEVEL SECURITY;

-- Office geofence config
CREATE TABLE public.office_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_name TEXT NOT NULL DEFAULT 'JURIS ADVOCACIA',
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL DEFAULT -23.5505,
    longitude DOUBLE PRECISION NOT NULL DEFAULT -46.6333,
    radius_meters INTEGER NOT NULL DEFAULT 50,
    whatsapp_notification_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_hours_updated_at BEFORE UPDATE ON public.monthly_hours_bank FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_office_settings_updated_at BEFORE UPDATE ON public.office_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own records" ON public.time_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own records" ON public.time_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all records" ON public.time_records FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own schedule" ON public.work_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage schedules" ON public.work_schedules FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own requests" ON public.requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own requests" ON public.requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending requests" ON public.requests FOR UPDATE USING (auth.uid() = user_id AND status = 'pendente');
CREATE POLICY "Admins can manage all requests" ON public.requests FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own vacations" ON public.vacations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage vacations" ON public.vacations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own hours" ON public.monthly_hours_bank FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage hours bank" ON public.monthly_hours_bank FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can view settings" ON public.office_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.office_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default office settings
INSERT INTO public.office_settings (office_name, address, latitude, longitude, radius_meters)
VALUES ('JURIS ADVOCACIA', 'Endereço do Escritório', -23.5505, -46.6333, 50);

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');