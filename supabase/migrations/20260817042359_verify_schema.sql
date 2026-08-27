DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private' AND p.proname IN (
        'handle_new_user','current_app_role','is_scheduler_or_admin','is_admin',
        'current_provider_id','set_app_role'
      )) < 6 THEN
    RAISE EXCEPTION 'missing private auth helpers';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'public schema must not contain SECURITY DEFINER functions';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') < 20 THEN
    RAISE EXCEPTION 'expected RLS policies to be present';
  END IF;
END $$;
