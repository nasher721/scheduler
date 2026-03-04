-- Clear all schedule and provider data
TRUNCATE TABLE slots CASCADE;
TRUNCATE TABLE providers CASCADE;
TRUNCATE TABLE shift_requests CASCADE;
TRUNCATE TABLE email_events CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE notifications CASCADE;

-- Clear global settings if needed (optional, uncomment if you want to reset config)
-- DELETE FROM global_settings WHERE key = 'schedule_config';
