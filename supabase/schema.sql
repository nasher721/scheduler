-- =============================================================================
-- Neuro ICU Scheduler — consolidated Supabase schema
-- =============================================================================
-- This file is the *reference* snapshot of the deployed schema. The source of
-- truth for applying changes is supabase/migrations/*.sql (applied in order).
-- Re-running this file on a fresh project reproduces the same structure.
--
-- Security model
-- --------------
--  * Every table has RLS enabled and policies are granted to `authenticated`
--    only. The `anon` role has no access at all — an anon-key client can read
--    nothing and write nothing.
--  * The Node API server therefore MUST run with SUPABASE_SERVICE_ROLE_KEY.
--    Using the anon key server-side silently returns empty result sets.
--  * Privilege checks live in the `private` schema as SECURITY DEFINER helpers
--    so policies never recurse through RLS on `profiles`.
--  * Role escalation is blocked by triggers: profiles.role and the privileged
--    provider columns are not client-writable; use private.set_app_role().
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;

-- -----------------------------------------------------------------------------
-- Helper functions (private schema — never exposed through PostgREST)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.current_app_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT private.current_app_role() = 'ADMIN'
$$;

CREATE OR REPLACE FUNCTION private.is_scheduler_or_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT private.current_app_role() IN ('SCHEDULER', 'ADMIN')
$$;

CREATE OR REPLACE FUNCTION private.current_provider_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT p.id FROM public.providers p WHERE p.profile_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. profiles — one row per auth user
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'CLINICIAN'
             CHECK (role IN ('ADMIN', 'SCHEDULER', 'CLINICIAN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_idx ON public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- 2. providers — scheduling identity (may exist before the person signs up)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.providers (
  id                        TEXT PRIMARY KEY,
  profile_id                UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  name                      TEXT NOT NULL,
  email                     TEXT NOT NULL,
  role                      TEXT NOT NULL DEFAULT 'CLINICIAN'
                            CHECK (role IN ('ADMIN', 'SCHEDULER', 'CLINICIAN')),
  target_week_days          INTEGER NOT NULL DEFAULT 10,
  target_weekend_days       INTEGER NOT NULL DEFAULT 4,
  target_week_nights        INTEGER NOT NULL DEFAULT 3,
  target_weekend_nights     INTEGER NOT NULL DEFAULT 2,
  time_off_requests         JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_dates           JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_consecutive_nights    INTEGER NOT NULL DEFAULT 2,
  min_days_off_after_night  INTEGER NOT NULL DEFAULT 1,
  credentials               JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduling_restrictions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes                     TEXT,
  communication_preferences JSONB NOT NULL DEFAULT '{"sms": false, "push": true, "email": true}'::jsonb,
  fatigue_metrics           JSONB NOT NULL DEFAULT '{"riskLevel": "low", "shiftsThisMonth": 0, "consecutiveShiftsWorked": 0}'::jsonb,
  auto_approve_claims       BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS providers_email_lower_idx ON public.providers (lower(email));
CREATE INDEX IF NOT EXISTS idx_providers_role ON public.providers (role);

-- -----------------------------------------------------------------------------
-- 3. slots — the schedule grid
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slots (
  id                     TEXT PRIMARY KEY,
  date                   DATE NOT NULL,
  type                   TEXT NOT NULL
                         CHECK (type IN ('DAY','NIGHT','NMET','JEOPARDY','RECOVERY','CONSULTS','VACATION')),
  provider_id            TEXT REFERENCES public.providers(id) ON DELETE SET NULL,
  is_weekend_layout      BOOLEAN NOT NULL DEFAULT false,
  required_skill         TEXT,
  priority               TEXT NOT NULL DEFAULT 'STANDARD' CHECK (priority IN ('CRITICAL','STANDARD')),
  is_backup              BOOLEAN NOT NULL DEFAULT false,
  location               TEXT,
  secondary_provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_shared_assignment   BOOLEAN NOT NULL DEFAULT false,
  location_group         TEXT CHECK (location_group IS NULL OR location_group IN
                           ('MAIN_CAMPUS_UNIT','MAIN_CAMPUS_SERVICE','AKRON_UNIT','SUPPORT_SERVICE')),
  service_priority       TEXT NOT NULL DEFAULT 'STANDARD'
                         CHECK (service_priority IN ('CRITICAL','STANDARD','FLEXIBLE')),
  service_location       TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slots_date           ON public.slots (date);
CREATE INDEX IF NOT EXISTS idx_slots_date_type      ON public.slots (date, type);
CREATE INDEX IF NOT EXISTS idx_slots_provider_id    ON public.slots (provider_id);
CREATE INDEX IF NOT EXISTS idx_slots_location_group ON public.slots (location_group);

-- -----------------------------------------------------------------------------
-- 4. shift_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    TEXT REFERENCES public.providers(id) ON DELETE SET NULL,
  provider_name  TEXT,
  provider_email TEXT,
  type           TEXT NOT NULL CHECK (type IN ('time_off','swap','availability')),
  date           DATE NOT NULL,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  source         TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app','email')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ,
  resolved_by    TEXT,
  deadline_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_shift_requests_provider     ON public.shift_requests (provider_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_status       ON public.shift_requests (status);
CREATE INDEX IF NOT EXISTS idx_shift_requests_date         ON public.shift_requests (date);
CREATE INDEX IF NOT EXISTS idx_shift_requests_requested_at ON public.shift_requests (requested_at DESC);

-- -----------------------------------------------------------------------------
-- 5. audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          TEXT PRIMARY KEY,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  action      TEXT NOT NULL CHECK (action IN (
                'ASSIGN','UNASSIGN','AUTO_ASSIGN','CLEAR','RULE_CHANGE',
                'ai_apply','ai_rollback','assign_provider','mark_for_manual_assignment')),
  details     TEXT,
  slot_id     TEXT,
  provider_id TEXT,
  actor       TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_slot      ON public.audit_logs (slot_id);

-- -----------------------------------------------------------------------------
-- 6. custom_rules
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_rules (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('AVOID_PAIRING','MAX_SHIFTS_PER_WEEK')),
  provider_a  TEXT,
  provider_b  TEXT,
  provider_id TEXT,
  max_shifts  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_rules_provider ON public.custom_rules (provider_id);

-- -----------------------------------------------------------------------------
-- 7. scenarios — saved schedule snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenarios (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  num_weeks  INTEGER NOT NULL CHECK (num_weeks BETWEEN 1 AND 52),
  providers  JSONB NOT NULL DEFAULT '[]'::jsonb,
  slots      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_scenarios_created_at ON public.scenarios (created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. day_handoffs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.day_handoffs (
  date       DATE PRIMARY KEY,
  notes      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- -----------------------------------------------------------------------------
-- 9. global_settings — small key/value config (schedule_config, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.global_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 10. notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type            TEXT,
  title                 TEXT NOT NULL,
  body                  TEXT NOT NULL,
  severity              TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  channels              JSONB NOT NULL DEFAULT '[]'::jsonb,
  status_by_channel     JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_provider_id TEXT REFERENCES public.providers(id) ON DELETE CASCADE,
  recipient_profile_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_created            ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_provider ON public.notifications (recipient_provider_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_profile  ON public.notifications (recipient_profile_id);

-- -----------------------------------------------------------------------------
-- 11. email_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  status      TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_events_created ON public.email_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_type    ON public.email_events (type);

-- -----------------------------------------------------------------------------
-- 12. marketplace_shifts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_shifts (
  id                     TEXT PRIMARY KEY,
  slot_id                TEXT REFERENCES public.slots(id) ON DELETE SET NULL,
  posted_by_provider_id  TEXT REFERENCES public.providers(id) ON DELETE SET NULL,
  date                   DATE NOT NULL,
  shift_type             TEXT NOT NULL,
  location               TEXT,
  lifecycle_state        TEXT NOT NULL DEFAULT 'POSTED' CHECK (lifecycle_state IN
                           ('POSTED','AI_EVALUATING','BROADCASTING','CLAIMED','APPROVED','CANCELLED')),
  posted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by_provider_id TEXT REFERENCES public.providers(id) ON DELETE SET NULL,
  claimed_at             TIMESTAMPTZ,
  approved_by            TEXT,
  approved_at            TIMESTAMPTZ,
  broadcast_recipients   JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes                  TEXT NOT NULL DEFAULT '',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mkt_slot       ON public.marketplace_shifts (slot_id);
CREATE INDEX IF NOT EXISTS idx_mkt_state      ON public.marketplace_shifts (lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_mkt_date       ON public.marketplace_shifts (date);
CREATE INDEX IF NOT EXISTS idx_mkt_posted_by  ON public.marketplace_shifts (posted_by_provider_id);
CREATE INDEX IF NOT EXISTS idx_mkt_claimed_by ON public.marketplace_shifts (claimed_by_provider_id);

-- -----------------------------------------------------------------------------
-- 13. broadcast_history
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broadcast_history (
  id                   TEXT PRIMARY KEY,
  marketplace_shift_id TEXT REFERENCES public.marketplace_shifts(id) ON DELETE CASCADE,
  tier                 INTEGER NOT NULL DEFAULT 1,
  recipients           JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel              TEXT NOT NULL CHECK (channel IN ('sms','email','push','mixed')),
  status               TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','failed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bh_shift      ON public.broadcast_history (marketplace_shift_id);
CREATE INDEX IF NOT EXISTS idx_bh_shift_tier ON public.broadcast_history (marketplace_shift_id, tier DESC);

-- -----------------------------------------------------------------------------
-- 14. ai_apply_history — snapshots for AI apply / rollback
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_apply_history (
  id              TEXT PRIMARY KEY,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by     TEXT,
  rollout_mode    TEXT NOT NULL DEFAULT 'shadow',
  result          JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_state  JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_state   JSONB NOT NULL DEFAULT '{}'::jsonb,
  rolled_back_at  TIMESTAMPTZ,
  rolled_back_by  TEXT,
  rollback_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_apply_history_applied_at ON public.ai_apply_history (applied_at DESC);

-- =============================================================================
-- Triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION private.protect_profile_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  NEW.email := lower(NEW.email);
  IF TG_OP = 'UPDATE'
     AND NEW.role IS DISTINCT FROM OLD.role
     AND current_setting('private.allow_role_change', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'profiles.role is not client-writable; use private.set_app_role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.protect_provider_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  linked_role text;
BEGIN
  NEW.email := lower(NEW.email);

  IF auth.uid() IS NULL THEN
    RETURN NEW;  -- service_role / server-side writes bypass the clinician guard
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.profile_id IS NOT NULL THEN
      SELECT role INTO linked_role FROM public.profiles WHERE id = NEW.profile_id;
      NEW.role := COALESCE(linked_role, 'CLINICIAN');
    ELSIF NOT private.is_scheduler_or_admin() THEN
      NEW.role := 'CLINICIAN';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id AND NOT private.is_scheduler_or_admin() THEN
    NEW.profile_id := OLD.profile_id;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT private.is_scheduler_or_admin() OR OLD.profile_id IS NOT NULL THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  IF COALESCE(private.current_app_role(), '') = 'CLINICIAN' THEN
    NEW.name                     := OLD.name;
    NEW.email                    := OLD.email;
    NEW.target_week_days         := OLD.target_week_days;
    NEW.target_weekend_days      := OLD.target_weekend_days;
    NEW.target_week_nights       := OLD.target_week_nights;
    NEW.target_weekend_nights    := OLD.target_weekend_nights;
    NEW.skills                   := OLD.skills;
    NEW.max_consecutive_nights   := OLD.max_consecutive_nights;
    NEW.min_days_off_after_night := OLD.min_days_off_after_night;
    NEW.credentials              := OLD.credentials;
    NEW.scheduling_restrictions  := OLD.scheduling_restrictions;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_shift_request_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;  -- server-side writes manage status transitions themselves
  END IF;

  IF NEW.provider_id IS NULL THEN
    NEW.provider_id := private.current_provider_id();
  END IF;

  IF TG_OP = 'INSERT' AND NOT private.is_scheduler_or_admin() THEN
    IF NEW.provider_id IS DISTINCT FROM private.current_provider_id() THEN
      RAISE EXCEPTION 'clinicians can only create their own shift requests';
    END IF;
    NEW.status := 'pending';
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT private.is_scheduler_or_admin() THEN
    IF OLD.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'clinicians can only modify pending requests';
    END IF;
    NEW.status      := OLD.status;
    NEW.resolved_at := OLD.resolved_at;
    NEW.resolved_by := OLD.resolved_by;
    NEW.provider_id := OLD.provider_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.set_app_role(target_id uuid, new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF new_role NOT IN ('ADMIN', 'SCHEDULER', 'CLINICIAN') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'only ADMIN can change roles';
  END IF;

  PERFORM set_config('private.allow_role_change', 'true', true);

  UPDATE public.profiles  SET role = new_role, updated_at = now() WHERE id = target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  UPDATE public.providers SET role = new_role, updated_at = now() WHERE profile_id = target_id;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    lower(NEW.email),
    'CLINICIAN'
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'CLINICIAN')
  WHERE id = NEW.id;

  -- Link a pre-provisioned provider row to the new account.
  UPDATE public.providers
  SET profile_id = NEW.id, updated_at = now()
  WHERE lower(email) = lower(NEW.email) AND profile_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at        ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_protect_role      ON public.profiles;
DROP TRIGGER IF EXISTS trg_providers_updated_at       ON public.providers;
DROP TRIGGER IF EXISTS trg_providers_protect          ON public.providers;
DROP TRIGGER IF EXISTS trg_slots_updated_at           ON public.slots;
DROP TRIGGER IF EXISTS trg_custom_rules_updated_at    ON public.custom_rules;
DROP TRIGGER IF EXISTS trg_day_handoffs_updated_at    ON public.day_handoffs;
DROP TRIGGER IF EXISTS trg_global_settings_updated_at ON public.global_settings;
DROP TRIGGER IF EXISTS trg_marketplace_updated_at     ON public.marketplace_shifts;
DROP TRIGGER IF EXISTS trg_shift_requests_defaults    ON public.shift_requests;
DROP TRIGGER IF EXISTS on_auth_user_created           ON auth.users;

CREATE TRIGGER trg_profiles_updated_at        BEFORE UPDATE           ON public.profiles           FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_profiles_protect_role      BEFORE INSERT OR UPDATE ON public.profiles           FOR EACH ROW EXECUTE FUNCTION private.protect_profile_role();
CREATE TRIGGER trg_providers_updated_at       BEFORE UPDATE           ON public.providers          FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_providers_protect          BEFORE INSERT OR UPDATE ON public.providers          FOR EACH ROW EXECUTE FUNCTION private.protect_provider_privileged_columns();
CREATE TRIGGER trg_slots_updated_at           BEFORE UPDATE           ON public.slots              FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_custom_rules_updated_at    BEFORE UPDATE           ON public.custom_rules       FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_day_handoffs_updated_at    BEFORE UPDATE           ON public.day_handoffs       FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_global_settings_updated_at BEFORE UPDATE           ON public.global_settings    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_marketplace_updated_at     BEFORE UPDATE           ON public.marketplace_shifts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_shift_requests_defaults    BEFORE INSERT OR UPDATE ON public.shift_requests     FOR EACH ROW EXECUTE FUNCTION private.enforce_shift_request_defaults();
CREATE TRIGGER on_auth_user_created           AFTER  INSERT           ON auth.users                FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- NOTE: policies are granted to `authenticated` only. `anon` gets nothing.
-- Helper calls are wrapped in (SELECT ...) so Postgres evaluates them once per
-- statement rather than once per row (Supabase linter 0003_auth_rls_initplan).
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_handoffs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_apply_history   ENABLE ROW LEVEL SECURITY;

-- profiles: everyone signed in can read the directory; you edit only yourself.
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_own_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT private.is_admin()))
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT private.is_admin()));

-- providers
CREATE POLICY providers_select_authenticated ON public.providers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY providers_insert_own_or_scheduler ON public.providers
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_scheduler_or_admin()) OR profile_id = (SELECT auth.uid()));
CREATE POLICY providers_update_own_or_scheduler ON public.providers
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())
         OR ((SELECT private.current_app_role()) = 'CLINICIAN' AND profile_id = (SELECT auth.uid())))
  WITH CHECK ((SELECT private.is_scheduler_or_admin())
         OR ((SELECT private.current_app_role()) = 'CLINICIAN' AND profile_id = (SELECT auth.uid())));
CREATE POLICY providers_delete_scheduler ON public.providers
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

-- slots: readable by everyone signed in, writable by schedulers.
CREATE POLICY slots_select_authenticated ON public.slots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY slots_insert_scheduler ON public.slots
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY slots_update_scheduler ON public.slots
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY slots_delete_scheduler ON public.slots
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

-- shift_requests: clinicians see and manage only their own pending requests.
CREATE POLICY shift_requests_select_own_or_scheduler ON public.shift_requests
  FOR SELECT TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())
         OR provider_id = (SELECT private.current_provider_id()));
CREATE POLICY shift_requests_insert_own_or_scheduler ON public.shift_requests
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_scheduler_or_admin())
         OR provider_id = (SELECT private.current_provider_id())
         OR (provider_id IS NULL AND (SELECT private.current_provider_id()) IS NOT NULL));
CREATE POLICY shift_requests_update_own_or_scheduler ON public.shift_requests
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())
         OR ((SELECT private.current_app_role()) = 'CLINICIAN'
             AND provider_id = (SELECT private.current_provider_id())
             AND status = 'pending'))
  WITH CHECK ((SELECT private.is_scheduler_or_admin())
         OR ((SELECT private.current_app_role()) = 'CLINICIAN'
             AND provider_id = (SELECT private.current_provider_id())
             AND status = 'pending'));
CREATE POLICY shift_requests_delete_own_or_scheduler ON public.shift_requests
  FOR DELETE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())
         OR ((SELECT private.current_app_role()) = 'CLINICIAN'
             AND provider_id = (SELECT private.current_provider_id())
             AND status = 'pending'));

-- audit_logs / custom_rules / scenarios / day_handoffs / global_settings:
-- readable by everyone signed in, writable by schedulers.
CREATE POLICY audit_logs_select_authenticated ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY audit_logs_insert_scheduler ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY audit_logs_delete_scheduler ON public.audit_logs
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

CREATE POLICY custom_rules_select_authenticated ON public.custom_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY custom_rules_insert_scheduler ON public.custom_rules
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY custom_rules_update_scheduler ON public.custom_rules
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY custom_rules_delete_scheduler ON public.custom_rules
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

CREATE POLICY scenarios_select_authenticated ON public.scenarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY scenarios_insert_scheduler ON public.scenarios
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY scenarios_update_scheduler ON public.scenarios
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY scenarios_delete_scheduler ON public.scenarios
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

CREATE POLICY day_handoffs_select_authenticated ON public.day_handoffs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY day_handoffs_insert_scheduler ON public.day_handoffs
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY day_handoffs_update_scheduler ON public.day_handoffs
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY day_handoffs_delete_scheduler ON public.day_handoffs
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

CREATE POLICY global_settings_select_authenticated ON public.global_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY global_settings_insert_scheduler ON public.global_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY global_settings_update_scheduler ON public.global_settings
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY global_settings_delete_scheduler ON public.global_settings
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

-- notifications: your own, plus unaddressed broadcasts.
CREATE POLICY notifications_select_own_or_broadcast_or_scheduler ON public.notifications
  FOR SELECT TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())
         OR recipient_profile_id = (SELECT auth.uid())
         OR recipient_provider_id = (SELECT private.current_provider_id())
         OR (recipient_profile_id IS NULL AND recipient_provider_id IS NULL));
CREATE POLICY notifications_insert_scheduler ON public.notifications
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY notifications_update_scheduler ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY notifications_delete_scheduler ON public.notifications
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

-- email_events: raw inbound payloads — scheduler/admin only, including SELECT.
CREATE POLICY email_events_select_scheduler ON public.email_events
  FOR SELECT TO authenticated USING ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY email_events_insert_scheduler ON public.email_events
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY email_events_update_scheduler ON public.email_events
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY email_events_delete_scheduler ON public.email_events
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

-- marketplace: clinicians may post their own shifts and claim open ones.
CREATE POLICY marketplace_select_authenticated ON public.marketplace_shifts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY marketplace_insert_own_or_scheduler ON public.marketplace_shifts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_scheduler_or_admin())
         OR posted_by_provider_id = (SELECT private.current_provider_id()));
CREATE POLICY marketplace_update_claim_own_or_scheduler ON public.marketplace_shifts
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())
         OR ((SELECT private.current_app_role()) = 'CLINICIAN'
             AND (posted_by_provider_id = (SELECT private.current_provider_id())
                  OR lifecycle_state = ANY (ARRAY['POSTED','AI_EVALUATING','BROADCASTING']))))
  WITH CHECK ((SELECT private.is_scheduler_or_admin())
         OR ((SELECT private.current_app_role()) = 'CLINICIAN'
             AND ((claimed_by_provider_id = (SELECT private.current_provider_id()) AND lifecycle_state = 'CLAIMED')
                  OR (posted_by_provider_id = (SELECT private.current_provider_id()) AND lifecycle_state = 'CANCELLED'))));
CREATE POLICY marketplace_delete_scheduler ON public.marketplace_shifts
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

CREATE POLICY broadcast_history_select_authenticated ON public.broadcast_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY broadcast_history_insert_scheduler ON public.broadcast_history
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY broadcast_history_update_scheduler ON public.broadcast_history
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY broadcast_history_delete_scheduler ON public.broadcast_history
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));

-- ai_apply_history embeds full schedule snapshots — scheduler/admin only.
CREATE POLICY ai_apply_history_select_scheduler ON public.ai_apply_history
  FOR SELECT TO authenticated USING ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY ai_apply_history_insert_scheduler ON public.ai_apply_history
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY ai_apply_history_update_scheduler ON public.ai_apply_history
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin())) WITH CHECK ((SELECT private.is_scheduler_or_admin()));
CREATE POLICY ai_apply_history_delete_scheduler ON public.ai_apply_history
  FOR DELETE TO authenticated USING ((SELECT private.is_scheduler_or_admin()));
