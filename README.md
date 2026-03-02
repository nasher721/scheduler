# Neuro ICU Scheduler (Full Stack)

A production-style **full stack scheduling platform** for neuro ICU staffing.

- **Frontend:** React + TypeScript + Vite
- **Backend API:** Node.js + Express
- **Persistence:** Server-side JSON store (`data/schedule-state.json`) plus local browser persistence for offline safety

## What’s Included

### Frontend (operations UI)
- Skill-aware, constraint-based scheduling engine.
- Drag-and-drop assignment workflows.
- Scenario save/load/delete for what-if planning.
- Coverage and risk analytics dashboards.
- Excel import/export, print/PDF output.
- New backend sync controls (**Save API / Load API**) to persist and restore schedules from server storage.

### Backend (API layer)
- `GET /api/health` — service health check.
- `GET /api/state` — fetch current persisted schedule snapshot.
- `PUT /api/state` — validate and persist full schedule state.
- CORS + JSON body parsing included.

## Architecture

```text
React SPA (Vite)
   └─ fetch()
      └─ Express API (server.js)
            └─ data/schedule-state.json
```

The client continues to use Zustand for local interaction speed and undo/redo history, while the server acts as a canonical shared state endpoint.

## Getting Started

```bash
pnpm install
pnpm dev:fullstack
```

This starts:
- Frontend at `http://localhost:5173`
- API at `http://localhost:4000`

You can also run each separately:

```bash
pnpm dev
pnpm server
```

## Environment Variables

Create a `.env` file if your API is not on localhost:4000:

```bash
VITE_API_BASE_URL=https://your-api-host
```

## Available Scripts

```bash
pnpm dev             # Frontend only
pnpm server          # Backend API only
pnpm dev:fullstack   # Frontend + backend concurrently
pnpm build
pnpm lint
pnpm preview
```

## Persistence Notes

- Server persistence file: `data/schedule-state.json`
- Browser persistence key: `nicu-schedule-store-v4`

If backend storage is empty, `Load API` will report that no server snapshot exists yet.
