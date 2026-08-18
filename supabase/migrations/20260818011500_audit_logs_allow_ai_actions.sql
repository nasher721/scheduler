-- The application emits audit actions beyond the original manual-assignment set
-- (AI apply/rollback and solver-driven assignment). Widen the allow-list so
-- audit entries can be persisted to the table instead of only living inside the
-- global_settings.schedule_config JSON blob.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action = ANY (ARRAY[
    'ASSIGN',
    'UNASSIGN',
    'AUTO_ASSIGN',
    'CLEAR',
    'RULE_CHANGE',
    'ai_apply',
    'ai_rollback',
    'assign_provider',
    'mark_for_manual_assignment'
  ]));
