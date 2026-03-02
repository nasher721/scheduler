# Neuro ICU Scheduler

A modern React + TypeScript scheduler for ICU physician planning.

## Highlights

- Drag-and-drop assignment of providers to shift slots.
- Smart auto-assignment that balances staffing targets and fairness.
- Conflict prevention (no double-booking on the same date, respects unavailable dates).
- Editable provider targets and unavailable dates from the UI.
- Monthly and classic grid schedule views.
- Excel import/export for offline sharing.
- Local persistence using browser storage.

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

## Scheduling Behavior

- **Day shifts:** 3 on weekdays, 2 on weekends.
- **Night shifts:** 1 daily (with weekend-night weighting Thu-Sun).
- **NMET / Jeopardy:** 1 each daily.
- Auto-fill prioritizes providers with the largest remaining target deficit.

## Data Persistence

Schedule state is stored under local storage key:

- `nicu-schedule-store-v2`

Clear browser storage to fully reset persisted plans.
