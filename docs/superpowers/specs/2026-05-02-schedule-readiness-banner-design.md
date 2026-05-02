# Schedule Readiness Banner Design

## Goal

Improve the existing schedule screen so admins can operate faster and confirm that priority controls are functioning during a manual smoke pass.

The schedule screen remains the primary workspace. This design adds a compact readiness banner and a session-scoped QA checklist instead of creating a separate command-center dashboard.

## Non-Goals

- Do not add a new dashboard as the first screen.
- Do not rewrite scheduling, optimization, import, export, or scenario behavior.
- Do not claim automated regression coverage from manual confirmation.
- Do not persist smoke-check results as audit records in the first version.

## User Experience

Render an `AdminReadinessBanner` only when the admin is on the schedule view. The banner sits above the schedule workspace and summarizes current operating state:

- Coverage percentage.
- Filled shift count.
- Critical unfilled shifts.
- Skill mismatch risk.
- Fatigue exposure.
- Alert count.
- Save/sync status.
- Offline or unavailable states.

The banner also exposes fast access to common schedule actions:

- Import.
- Rollback import.
- Auto-Fill.
- Optimize.
- Save.
- Export.
- Alerts.
- AI panel.
- Staff panel.
- QA Check.

The action buttons should use the existing schedule-screen handlers wherever possible. The banner is a control surface, not a duplicate implementation.

## Components

### `AdminReadinessBanner`

Compact schedule-view banner that combines readiness metrics, quick actions, and the QA entry point. It should be visually dense, readable on mobile, and consistent with the existing command-shell styling.

### `ReadinessMetric`

Reusable metric chip with label, value, severity, optional icon, and optional click target. Use it for coverage, gaps, skill risk, fatigue, alerts, and save state.

### `ReadinessActionBar`

Button group for the existing schedule actions. It should keep high-frequency operations close to the readiness summary without replacing the existing header controls on the first pass.

### `AdminSmokeChecklist`

Drawer or modal opened by `QA Check`. It lists visible admin schedule-screen functions and lets the admin mark each item as:

- `not_checked`
- `passed`
- `needs_attention`

Each item may include a short note and `lastCheckedAt` timestamp. Results are session-scoped and resettable.

### `useScheduleReadiness`

Small hook or selector layer that derives readiness values from existing state. This keeps `AdminReadinessBanner` presentational and avoids expanding `App.tsx` with more inline derived logic.

## Data Flow

Readiness values come from existing client state and hooks:

- `slots`
- `providers`
- `getProviderCounts`
- `useAnomalyAlerts`
- `viewMode`
- autosave status
- online/offline status

Quick actions are passed into the banner from existing `App.tsx` handlers:

- import trigger
- rollback import
- auto-fill
- optimize
- save
- alert navigation
- AI toggle
- staff toggle

The smoke checklist uses local/session state only:

```ts
type SmokeChecklistItem = {
  id: string;
  label: string;
  actionArea: "schedule" | "import" | "ai" | "export" | "staff" | "alerts";
  status: "not_checked" | "passed" | "needs_attention";
  note?: string;
  lastCheckedAt?: string;
};
```

## Smoke Checklist Items

The first checklist should cover these visible priority functions:

- Schedule loads and switches between calendar/table.
- Import opens preview and can be cancelled safely.
- Rollback import is disabled when unavailable and works after an import.
- Auto-Fill completes without crashing.
- Optimize opens a review preview or shows a clear failure.
- Save reports success or clear failure.
- Scenario save/load/delete still works.
- Export menu opens.
- Alerts button navigates to insights/alerts context.
- AI panel toggles.
- Staff panel/sidebar toggles.
- Undo/redo enablement behaves correctly.

## Error Handling

The existing toast/error behavior remains in place. The readiness banner should additionally reflect degraded states where the data already exists:

- `Save failed` when autosave or manual save fails.
- `Offline` when sync actions cannot complete.
- `Optimize needs attention` when optimization fails or returns no schedule result.
- Setup/import guidance when no slots or providers exist.
- Clear zero state when no alerts or critical gaps exist.

The smoke checklist can be manually marked `needs_attention` with a note. Automatic failure detection is opportunistic in the first version and should only be added where the app already has reliable status.

## Verification

The product-level verification is the admin-facing smoke checklist. During implementation, engineering should still run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- focused tests for any touched logic if needed

The first implementation is successful when an admin can stay on the schedule screen, understand readiness at a glance, run common actions from the banner, and mark the priority schedule functions as passed or needing attention in one manual smoke pass.

## Risks

- Duplicating existing header controls could add clutter. Keep the banner compact and consider moving only the highest-frequency actions if space gets tight.
- Manual QA status can become stale. Treat checklist results as session confidence, not durable compliance evidence.
- Passing many handlers into the banner can make `App.tsx` noisier. If that happens, extract a small action model or hook during implementation.

