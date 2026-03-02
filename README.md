# Neuro ICU Scheduler

A modern React + TypeScript scheduler for complex neuro ICU physician planning.

## Five Standout Features

1. **Skill-aware assignment engine**
   - Every shift carries a required competency (`NEURO_CRITICAL`, `NIGHT_FLOAT`, `AIRWAY`, `STROKE`).
   - Providers can only be assigned to slots that match their declared skill profile.

2. **Fatigue & safety guardrails**
   - Configurable per-provider limits for maximum consecutive nights.
   - Configurable recovery days required after a night shift before non-night assignment.

3. **Preference-weighted smart auto-fill**
   - Auto-fill balances target deficits and boosts candidates on preferred dates.
   - Preserves hard constraints (availability, skills, fatigue, no same-day double-booking).

4. **Scenario sandboxing**
   - Save, load, and delete named scenarios for “what-if” planning.
   - Compare holiday plans, surge plans, or staffing-reduction plans without losing baseline schedules.

5. **Live operational risk analytics**
   - At-a-glance KPIs for coverage, critical unfilled shifts, skill mismatch risk, overload, and fatigue exposure.
   - Supports rapid operational decisions in high-acuity scheduling windows.

## Additional Capabilities

- Drag-and-drop assignment of providers to shift slots.
- Monthly and classic grid schedule views.
- Editable provider targets, skills, preferences, and availability.
- Excel import/export for offline sharing.
- Persistent local state in browser storage.

## Tech Stack

- React 19 + Vite + TypeScript
- Zustand for global state management
- Framer Motion for UI animation
- dnd-kit for drag and drop
- date-fns for calendar/date utilities
- xlsx + file-saver for spreadsheet workflows
- Tailwind CSS for styling

## Getting Started
```bash
pnpm install
pnpm dev
```

Then open `http://localhost:5173`.

## Available Scripts
```bash
pnpm dev
pnpm build
pnpm lint
pnpm preview
```


## Data Persistence

Schedule state is stored under local storage key:

- `nicu-schedule-store-v3`

Clear browser storage to fully reset persisted plans.
