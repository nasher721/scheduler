-- AI apply history: previously stored as an unbounded JSON blob inside
-- global_settings.ai_apply_history. Promoted to a real table so rows can be
-- paginated, indexed, and pruned instead of rewritten wholesale on every apply.
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

CREATE INDEX IF NOT EXISTS idx_ai_apply_history_applied_at
  ON public.ai_apply_history USING btree (applied_at DESC);

ALTER TABLE public.ai_apply_history ENABLE ROW LEVEL SECURITY;

-- Apply history embeds full schedule snapshots, so it is scheduler/admin only.
DROP POLICY IF EXISTS ai_apply_history_select_scheduler ON public.ai_apply_history;
CREATE POLICY ai_apply_history_select_scheduler ON public.ai_apply_history
  FOR SELECT TO authenticated
  USING ((SELECT private.is_scheduler_or_admin()));

DROP POLICY IF EXISTS ai_apply_history_insert_scheduler ON public.ai_apply_history;
CREATE POLICY ai_apply_history_insert_scheduler ON public.ai_apply_history
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_scheduler_or_admin()));

DROP POLICY IF EXISTS ai_apply_history_update_scheduler ON public.ai_apply_history;
CREATE POLICY ai_apply_history_update_scheduler ON public.ai_apply_history
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin()))
  WITH CHECK ((SELECT private.is_scheduler_or_admin()));

DROP POLICY IF EXISTS ai_apply_history_delete_scheduler ON public.ai_apply_history;
CREATE POLICY ai_apply_history_delete_scheduler ON public.ai_apply_history
  FOR DELETE TO authenticated
  USING ((SELECT private.is_scheduler_or_admin()));
