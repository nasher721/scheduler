# Supabase architecture

The Scheduler uses a dedicated Supabase project. Never point it at the
RollingRounds or clinical-notes project.

## Boundaries

- The React app uses the publishable key and the signed-in user's JWT for
  authentication, schedule persistence, and realtime updates.
- Express uses `SUPABASE_SERVICE_ROLE_KEY` for marketplace and other trusted
  server-side workflows. The service-role key must never use a `VITE_` prefix.
- AI, solver, copilot, and inbound-email workflows remain in Express.
- Authorization comes from `profiles.role`; user metadata cannot grant roles.
- Security-definer helpers live in the private schema.

## Data model

| Table | Purpose |
| --- | --- |
| `profiles` | Authenticated user and application role |
| `providers` | Roster, targets, skills, and credentials |
| `slots` | Calendar assignments |
| `shift_requests` | Time-off, swap, and availability requests |
| `custom_rules` | Scheduling constraints |
| `audit_logs` | Schedule activity |
| `scenarios` | Named schedule snapshots |
| `day_handoffs` | Daily handoff notes |
| `global_settings` | Schedule and escalation configuration |
| `notifications`, `email_events` | Messaging records |
| `marketplace_shifts`, `broadcast_history` | Coverage marketplace state |

Roster and schedule identifiers remain text for compatibility. Auth-linked
records use UUIDs.

## Local development

```bash
pnpm supabase:start
pnpm supabase:reset
node scripts/smoke-supabase.mjs
```

Migrations in `supabase/migrations/` are the canonical schema. Local demo
providers are defined once in `supabase/seed.sql`, which runs after migrations
during `supabase db reset`.

Magic-link mail is available through local Inbucket. The browser uses local
authentication only when the development bypass is enabled; production users
authenticate through Supabase.
