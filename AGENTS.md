# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-27 15:52
**Commit:** 691aa13
**Branch:** main

## OVERVIEW
NICU Schedule - Full-stack medical shift scheduling app. React 18 + TypeScript frontend (Vite 7), Express backend, Zustand state, JSON file persistence.

## STRUCTURE
```
Scheduler/
├── src/                  # Frontend (React + TypeScript)
│   ├── components/       # UI components (~80 files, calendar-heavy)
│   ├── hooks/            # Custom hooks (15 files, business logic)
│   ├── lib/              # Utilities, API client, AI integrations
│   ├── __tests__/        # Vitest unit tests
│   └── store.ts          # Zustand global state
├── server.js             # Express API server (port 4000)
├── data/                 # JSON persistence layer
├── e2e/                  # Playwright E2E tests
└── docs/                 # Documentation
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| UI components | `src/components/` | Calendar, modals, layout |
| Business logic | `src/hooks/` | Drag-drop, scheduling, AI hooks |
| API client | `src/lib/api/` | Fetch wrappers for backend |
| AI integrations | `src/lib/ai/` | Constraint solver, predictive |
| Backend routes | `server.js` | Express handlers inline |
| Tests (unit) | `src/__tests__/` | Vitest, 70% coverage threshold |
| Tests (e2e) | `e2e/` | Playwright, multi-browser |

## CONVENTIONS
- **Path alias**: `@/*` → `./src/*`
- **Strict TypeScript**: noUnusedLocals, noUnusedParameters enforced
- **Calendar excluded**: `src/components/calendar` excluded from tsconfig
- **CSS**: Tailwind + CSS variables (HSL theme)
- **State**: Zustand store at `src/store.ts`, localStorage key `nicu-schedule-store-v4`
- **Package manager**: pnpm (npm works but pnpm preferred)

## ANTI-PATTERNS (THIS PROJECT)
- No explicit forbidden patterns found
- 12 TODOs mark incomplete features (swap, handoff, WebSocket presence)

## COMMANDS
```bash
pnpm dev:fullstack   # Frontend (5173) + Backend (4000)
pnpm build           # tsc -b && vite build
pnpm test            # Vitest unit tests
pnpm test:e2e        # Playwright E2E
pnpm lint            # ESLint
pnpm typecheck       # tsc --noEmit
```

## NOTES
- Backend uses JSON file persistence (`data/*.json`), not a database
- AI scaffold with OpenAI/Anthropic/Gemini endpoints, OR-Tools solver
- PWA-enabled: service worker, offline mode, push notifications
- No CI/CD pipeline configured (Vercel deployment only)
