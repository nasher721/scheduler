-- Supabase Schema for NICU Scheduling App

-- 1. Profiles (extending auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('ADMIN', 'SCHEDULER', 'CLINICIAN')) NOT NULL DEFAULT 'CLINICIAN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Providers (Detailed scheduling info)
CREATE TABLE IF NOT EXISTS providers (
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
CREATE TABLE IF NOT EXISTS slots (
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
CREATE TABLE IF NOT EXISTS shift_requests (
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
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL,
  details TEXT,
  slot_id TEXT,
  provider_id TEXT,
  "user" TEXT
);

-- 6. Custom Rules
CREATE TABLE IF NOT EXISTS custom_rules (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  provider_a TEXT,
  provider_b TEXT,
  provider_id TEXT,
  max_shifts INTEGER
);

-- 7. Global Settings (Schedule Meta)
CREATE TABLE IF NOT EXISTS global_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Notifications
CREATE TABLE IF NOT EXISTS notifications (
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
CREATE TABLE IF NOT EXISTS email_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Marketplace Shifts (Shift coverage marketplace)
CREATE TABLE IF NOT EXISTS marketplace_shifts (
  id TEXT PRIMARY KEY,
  slot_id TEXT REFERENCES slots(id),
  posted_by_provider_id TEXT REFERENCES providers(id),
  date DATE NOT NULL,
  shift_type TEXT NOT NULL,
  location TEXT,
  lifecycle_state TEXT CHECK (lifecycle_state IN ('POSTED','AI_EVALUATING','BROADCASTING','CLAIMED','APPROVED','CANCELLED')) NOT NULL DEFAULT 'POSTED',
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_by_provider_id TEXT,
  claimed_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  broadcast_recipients JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Broadcast History (Notification delivery tracking)
CREATE TABLE IF NOT EXISTS broadcast_history (
  id TEXT PRIMARY KEY,
  marketplace_shift_id TEXT REFERENCES marketplace_shifts(id),
  tier INTEGER NOT NULL DEFAULT 1,
  recipients JSONB DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel TEXT CHECK (channel IN ('sms','email','push')) NOT NULL,
  status TEXT CHECK (status IN ('sent','delivered','failed')) NOT NULL DEFAULT 'sent',
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
ALTER TABLE marketplace_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_history ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow all for rapid prototyping, can be hardened later)
DROP POLICY IF EXISTS "Allow all" ON profiles;
DROP POLICY IF EXISTS "Allow all" ON providers;
DROP POLICY IF EXISTS "Allow all" ON slots;
DROP POLICY IF EXISTS "Allow all" ON shift_requests;
DROP POLICY IF EXISTS "Allow all" ON notifications;
DROP POLICY IF EXISTS "Allow all" ON email_events;
DROP POLICY IF EXISTS "Allow all" ON custom_rules;
DROP POLICY IF EXISTS "Allow all" ON audit_logs;
DROP POLICY IF EXISTS "Allow all" ON global_settings;

CREATE POLICY "Allow all" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all" ON providers FOR ALL USING (true);
CREATE POLICY "Allow all" ON slots FOR ALL USING (true);
CREATE POLICY "Allow all" ON shift_requests FOR ALL USING (true);
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true);
CREATE POLICY "Allow all" ON email_events FOR ALL USING (true);
CREATE POLICY "Allow all" ON custom_rules FOR ALL USING (true);
CREATE POLICY "Allow all" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Allow all" ON global_settings FOR ALL USING (true);

CREATE POLICY "Allow all" ON marketplace_shifts FOR ALL USING (true);
CREATE POLICY "Allow all" ON broadcast_history FOR ALL USING (true);


-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;
DROP TRIGGER IF EXISTS update_slots_updated_at ON slots;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_marketplace_shifts_updated_at BEFORE UPDATE ON marketplace_shifts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_broadcast_history_updated_at BEFORE UPDATE ON broadcast_history FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
 
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
 
 DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

 CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
