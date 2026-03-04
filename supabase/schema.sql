-- Supabase Schema for NICU Scheduling App

-- 1. Profiles (extending auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('ADMIN', 'SCHEDULER', 'CLINICIAN')) NOT NULL DEFAULT 'CLINICIAN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Providers (Detailed scheduling info)
CREATE TABLE providers (
  id TEXT PRIMARY KEY, -- Using the app's string IDs for compatibility
  profile_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('ADMIN', 'SCHEDULER', 'CLINICIAN')) NOT NULL,
  target_week_days INTEGER DEFAULT 10,
  target_weekend_days INTEGER DEFAULT 4,
  target_week_nights INTEGER DEFAULT 3,
  target_weekend_nights INTEGER DEFAULT 2,
  time_off_requests JSONB DEFAULT '[]'::jsonb,
  preferred_dates JSONB DEFAULT '[]'::jsonb,
  skills JSONB DEFAULT '[]'::jsonb,
  max_consecutive_nights INTEGER DEFAULT 2,
  min_days_off_after_night INTEGER DEFAULT 1,
  credentials JSONB DEFAULT '[]'::jsonb,
  scheduling_restrictions JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Slots (The Schedule)
CREATE TABLE slots (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  provider_id TEXT REFERENCES providers(id),
  is_weekend_layout BOOLEAN DEFAULT FALSE,
  required_skill TEXT,
  priority TEXT CHECK (priority IN ('CRITICAL', 'STANDARD')) DEFAULT 'STANDARD',
  location TEXT,
  secondary_provider_ids JSONB DEFAULT '[]'::jsonb,
  is_shared_assignment BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Shift Requests
CREATE TABLE shift_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id TEXT REFERENCES providers(id),
  provider_name TEXT, -- Fallback for migration
  provider_email TEXT, -- Fallback for migration
  type TEXT CHECK (type IN ('time_off', 'swap', 'availability')) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',
  source TEXT DEFAULT 'app',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  deadline_at TIMESTAMPTZ
);

-- 5. Audit Logs
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL,
  details TEXT,
  slot_id TEXT,
  provider_id TEXT,
  "user" TEXT
);

-- 6. Custom Rules
CREATE TABLE custom_rules (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  provider_a TEXT,
  provider_b TEXT,
  provider_id TEXT,
  max_shifts INTEGER
);

-- 7. Global Settings (Schedule Meta)
CREATE TABLE global_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Notifications
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'info',
  channels JSONB DEFAULT '[]'::jsonb,
  status_by_channel JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Email Events
CREATE TABLE email_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow all for now, can be hardened later)
CREATE POLICY "Public read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public read" ON providers FOR SELECT USING (true);
CREATE POLICY "Public read" ON slots FOR SELECT USING (true);
CREATE POLICY "Public read" ON shift_requests FOR SELECT USING (true);
CREATE POLICY "Public read" ON notifications FOR SELECT USING (true);
CREATE POLICY "Public read" ON email_events FOR SELECT USING (true);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_slots_updated_at BEFORE UPDATE ON slots FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
 
 -- 10. Auth Trigger for Profiles
 CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS TRIGGER AS $$
 BEGIN
     INSERT INTO public.profiles (id, name, email, role)
     VALUES (
         NEW.id,
         COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
         NEW.email,
         COALESCE(NEW.raw_user_meta_data->>'role', 'CLINICIAN')
     );
     RETURN NEW;
 END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;
 
 CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
