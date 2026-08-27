-- Seed roster for local development. Auth users are created on first magic-link login.
-- Signing in as adams@hospital.org links this row via private.handle_new_user.

INSERT INTO public.providers (
  id, name, email, role, target_week_days, target_weekend_days, target_week_nights, target_weekend_nights,
  time_off_requests, preferred_dates, skills, max_consecutive_nights, min_days_off_after_night, credentials
) VALUES
  (
    '1', 'Dr. Adams', 'adams@hospital.org', 'ADMIN', 10, 4, 3, 2,
    '[]'::jsonb, '[]'::jsonb, '["NEURO_CRITICAL","AIRWAY","STROKE"]'::jsonb, 2, 1,
    '[{"credentialType":"ACLS","expiresAt":"2027-01-01","status":"active"}]'::jsonb
  ),
  (
    '2', 'Dr. Baker', 'baker@hospital.org', 'CLINICIAN', 10, 4, 3, 2,
    '[]'::jsonb, '[]'::jsonb, '["NEURO_CRITICAL","EEG","NIGHT_FLOAT"]'::jsonb, 3, 1,
    '[{"credentialType":"Stroke Certification","expiresAt":"2027-02-01","status":"active"}]'::jsonb
  ),
  (
    '3', 'Dr. Clark', 'clark@hospital.org', 'SCHEDULER', 10, 4, 3, 2,
    '[]'::jsonb, '[]'::jsonb, '["NEURO_CRITICAL","ECMO","STROKE"]'::jsonb, 2, 2,
    '[{"credentialType":"NIHSS","expiresAt":"2027-03-01","status":"active"}]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
