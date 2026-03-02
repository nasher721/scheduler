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

## AI API (Implemented Scaffold)

**Current implementation phase: Phase 7 (rollback-ready apply history and reviewer-gated undo).**

The backend now includes a provider-agnostic AI scaffold with deterministic fallback logic.
These endpoints are available today and can be progressively wired to real provider SDK calls.

- `GET /api/ai/providers`
- `POST /api/ai/recommendations`
- `POST /api/ai/optimize`
- `POST /api/ai/simulate`
- `POST /api/ai/conflicts`
- `POST /api/ai/explain`
- `GET /api/ai/metrics`
- `POST /api/ai/feedback`
- `POST /api/ai/apply`
- `POST /api/ai/rollback`

Phase 4 additions in the deterministic path:

- Objective scoring and policy profiles continue to drive optimization outcomes.
- Optimizer output now includes `rollout` metadata for shadow vs human-review vs auto-apply decisions.
- Rollout confidence applies penalties for hard-constraint violations and unresolved manual assignments.


Phase 5 additions in the deterministic path:

- Per-provider/model telemetry now tracks request volume, latency, fallback rate, and estimated spend.
- Rollout feedback can be posted back to the API to track acceptance, rollback, and violation rates over time.
- Metrics are exposed with `GET /api/ai/metrics` to support provider routing decisions.

Phase 6 additions in the deterministic path:

- New `POST /api/ai/apply` endpoint applies optimized schedules only when rollout mode permits it.
- `shadow` results are blocked from persistence, and `human_review` mode requires an explicit `approvedBy` reviewer.
- Successful apply operations append an AI audit event and write acceptance/violation outcomes into provider metrics.

Phase 7 additions in the deterministic path:

- Every successful apply now stores a durable apply-history record with `applyId`, prior state snapshot, and reviewer metadata.
- New `POST /api/ai/rollback` endpoint restores the pre-apply snapshot when a reviewer provides `applyId` and `rolledBackBy`.
- Rollbacks append an AI rollback audit event and automatically update provider rollback/violation metrics.

### AI Environment Variables

```bash
AI_DEFAULT_PROVIDER=openai
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

All `POST /api/ai/*` endpoints accept either:

- a full state payload (same shape as `PUT /api/state`), or
- an object with `{ "state": <state>, ... }` for task-specific metadata.

### Provider Routing (Next Phase Implemented)

- The configured provider is selected with `AI_DEFAULT_PROVIDER` (`openai`, `anthropic`, `google`).
- If a matching API key exists, the backend attempts a live provider call.
- If no key is configured (or the call fails), the API returns deterministic fallback output.
- Fallback output is always structured and includes `source: "deterministic-fallback"`.
- The fallback optimizer now performs a greedy assignment pass that considers skill match, time-off, duplicate-day protection, and `MAX_SHIFTS_PER_WEEK` rules.

This allows safe progressive rollout: production remains stable without external model dependency.

## AI Integration Roadmap (Multi-Provider)

This app can be upgraded from a scheduler into an AI-assisted staffing optimization platform by
adding a provider-agnostic AI orchestration layer on the backend.

### 1) Add an AI Gateway in the API

Create a backend `ai/` module with a single interface and provider adapters:

- `openai` (Responses API)
- `anthropic` (Messages API)
- `google` (Gemini API)
- optional enterprise adapters: Azure OpenAI and AWS Bedrock

Expose one internal contract for AI tasks (recommend, optimize, explain) so frontend and business
logic remain vendor-neutral.

### 2) Use a Hybrid Intelligence Pipeline

Use LLMs for planning/reasoning, but enforce final schedule correctness with a deterministic
constraint solver.

- **Planner (LLM):** propose changes and rank options.
- **Solver (OR-Tools/CP-SAT):** apply hard constraints (coverage, shift limits, skill match).
- **Explainer (LLM):** generate plain-language rationale and tradeoffs for operators.

This is safer and more reliable than letting a model directly commit schedules.

### 3) Add AI Endpoints

Extend `server.js` with these route families:

- `POST /api/ai/recommendations` — ranked improvement suggestions.
- `POST /api/ai/optimize` — optimized candidate schedule + diff.
- `POST /api/ai/simulate` — what-if simulation for absences/surges.
- `POST /api/ai/conflicts` — machine-readable violations and severity.
- `POST /api/ai/explain` — natural-language explanation for selected decisions.
- `GET /api/ai/providers` — available model/provider metadata.

### 4) Objective Scoring and Guardrails

Implement explicit weighted objectives and policy profiles:

- Coverage completion
- Fatigue risk minimization
- Fairness/equity distribution
- Preference satisfaction
- Continuity of care

Hard constraints must always remain non-negotiable and validated server-side.

### 5) Suggested APIs and Services

- **LLM providers:** OpenAI, Anthropic, Gemini (with Azure OpenAI/Bedrock when governance
  requirements demand it).
- **Optimization engine:** Google OR-Tools (CP-SAT) for constraint solving.
- **Forecasting add-on:** demand prediction model for census-driven staffing.
- **Integrations:** Microsoft Graph Calendar, Google Calendar, and HRIS/payroll APIs (Workday,
  UKG, ADP depending on your environment).

### 6) Rollout Strategy

1. **Shadow mode:** AI suggests but never auto-applies.
2. **Human-in-the-loop:** allow assisted apply with approval gates.
3. **Automated low-risk actions:** auto-apply only when confidence and policy checks pass.

Track latency, cost, acceptance rate, rollback rate, and violation rate per provider/model to
continuously route workloads to the best option.
