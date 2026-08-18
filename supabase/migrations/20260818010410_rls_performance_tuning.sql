-- Performance tuning for RLS, per Supabase database linter:
--   0003_auth_rls_initplan       -> wrap auth.*()/helper calls in (SELECT ...)
--                                   so they are evaluated once per statement
--                                   instead of once per row.
--   0006_multiple_permissive_policies -> collapse duplicate permissive policies
--                                   for the same role+action into one.
--   0001_unindexed_foreign_keys  -> cover marketplace_shifts.claimed_by_provider_id.
-- Semantics are preserved exactly: each merged policy is the OR of the
-- predicates it replaces.

-- ---------------------------------------------------------------- profiles
DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;
CREATE POLICY profiles_update_own_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT private.is_admin()))
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT private.is_admin()));

-- --------------------------------------------------------------- providers
DROP POLICY IF EXISTS providers_insert_own ON public.providers;
DROP POLICY IF EXISTS providers_insert_scheduler ON public.providers;
CREATE POLICY providers_insert_own_or_scheduler ON public.providers
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_scheduler_or_admin())
    OR profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS providers_update_own_clinician ON public.providers;
DROP POLICY IF EXISTS providers_update_scheduler ON public.providers;
CREATE POLICY providers_update_own_or_scheduler ON public.providers
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_scheduler_or_admin())
    OR ((SELECT private.current_app_role()) = 'CLINICIAN' AND profile_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    (SELECT private.is_scheduler_or_admin())
    OR ((SELECT private.current_app_role()) = 'CLINICIAN' AND profile_id = (SELECT auth.uid()))
  );

-- ----------------------------------------------------------- notifications
DROP POLICY IF EXISTS notifications_select_own_or_broadcast_or_scheduler ON public.notifications;
CREATE POLICY notifications_select_own_or_broadcast_or_scheduler ON public.notifications
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_scheduler_or_admin())
    OR recipient_profile_id = (SELECT auth.uid())
    OR recipient_provider_id = (SELECT private.current_provider_id())
    OR (recipient_profile_id IS NULL AND recipient_provider_id IS NULL)
  );

-- --------------------------------------------------------- shift_requests
DROP POLICY IF EXISTS shift_requests_delete_own_pending ON public.shift_requests;
DROP POLICY IF EXISTS shift_requests_delete_scheduler ON public.shift_requests;
CREATE POLICY shift_requests_delete_own_or_scheduler ON public.shift_requests
  FOR DELETE TO authenticated
  USING (
    (SELECT private.is_scheduler_or_admin())
    OR (
      (SELECT private.current_app_role()) = 'CLINICIAN'
      AND provider_id = (SELECT private.current_provider_id())
      AND status = 'pending'
    )
  );

DROP POLICY IF EXISTS shift_requests_update_own_pending ON public.shift_requests;
DROP POLICY IF EXISTS shift_requests_update_scheduler ON public.shift_requests;
CREATE POLICY shift_requests_update_own_or_scheduler ON public.shift_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_scheduler_or_admin())
    OR (
      (SELECT private.current_app_role()) = 'CLINICIAN'
      AND provider_id = (SELECT private.current_provider_id())
      AND status = 'pending'
    )
  )
  WITH CHECK (
    (SELECT private.is_scheduler_or_admin())
    OR (
      (SELECT private.current_app_role()) = 'CLINICIAN'
      AND provider_id = (SELECT private.current_provider_id())
      AND status = 'pending'
    )
  );

DROP POLICY IF EXISTS shift_requests_select_own_or_scheduler ON public.shift_requests;
CREATE POLICY shift_requests_select_own_or_scheduler ON public.shift_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_scheduler_or_admin())
    OR provider_id = (SELECT private.current_provider_id())
  );

DROP POLICY IF EXISTS shift_requests_insert_own_or_scheduler ON public.shift_requests;
CREATE POLICY shift_requests_insert_own_or_scheduler ON public.shift_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_scheduler_or_admin())
    OR provider_id = (SELECT private.current_provider_id())
    OR (provider_id IS NULL AND (SELECT private.current_provider_id()) IS NOT NULL)
  );

-- ----------------------------------------------------- marketplace_shifts
DROP POLICY IF EXISTS marketplace_update_claim_or_own ON public.marketplace_shifts;
DROP POLICY IF EXISTS marketplace_update_scheduler ON public.marketplace_shifts;
CREATE POLICY marketplace_update_claim_own_or_scheduler ON public.marketplace_shifts
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_scheduler_or_admin())
    OR (
      (SELECT private.current_app_role()) = 'CLINICIAN'
      AND (
        posted_by_provider_id = (SELECT private.current_provider_id())
        OR lifecycle_state = ANY (ARRAY['POSTED', 'AI_EVALUATING', 'BROADCASTING'])
      )
    )
  )
  WITH CHECK (
    (SELECT private.is_scheduler_or_admin())
    OR (
      (SELECT private.current_app_role()) = 'CLINICIAN'
      AND (
        (claimed_by_provider_id = (SELECT private.current_provider_id()) AND lifecycle_state = 'CLAIMED')
        OR (posted_by_provider_id = (SELECT private.current_provider_id()) AND lifecycle_state = 'CANCELLED')
      )
    )
  );

DROP POLICY IF EXISTS marketplace_insert_own_or_scheduler ON public.marketplace_shifts;
CREATE POLICY marketplace_insert_own_or_scheduler ON public.marketplace_shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_scheduler_or_admin())
    OR posted_by_provider_id = (SELECT private.current_provider_id())
  );

CREATE INDEX IF NOT EXISTS idx_mkt_claimed_by
  ON public.marketplace_shifts USING btree (claimed_by_provider_id);
