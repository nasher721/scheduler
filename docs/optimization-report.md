# Optimization Report — Performance Hardening + Test Coverage Baseline

**Date:** 2026-08-16
**Branch:** main (all changes **uncommitted**)
**Scope:** Production performance optimizations (Phases 1–3), test hardening (Phase 4),
coverage-gate reconfiguration (Phase 5), plus honest measurement of the real coverage baseline.
**Status:** All gates green (`pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm lint`).

---

## 1. Summary

46 files changed (+153/−164), all uncommitted. Work split into five phases:

| Phase | Area | Change |
|---|---|---|
| 1 | Code splitting | 7 more components lazy-loaded in `App.tsx` |
| 2 | Render optimization | ~36 components/hooks use `useShallow` store selectors |
| 3 | Bundle chunking | `vite.config.ts` `manualChunks` function form + `vendor-xlsx` chunk |
| 4 | React Query wiring | `QueryClientProvider` in `main.tsx`; shared `queryClient`; new dedicated hook files |
| 5 | Tests + coverage | 32 new hook tests; coverage gate now enforced at honest baseline |

Measured post-change build output (no before-baseline was captured before this work —
the before numbers in §6 are best-effort estimates, see note):

| Chunk | Size | gzip |
|---|---|---|
| `vendor-xlsx-*.js` | 429.19 kB | 142.94 kB |
| `index-BcVd0Dfa.js` | 640.62 kB | 170.79 kB |
| `index-*.js` | 360.97 kB | 121.14 kB |
| `vendor-ui-*.js` | 184.36 kB | 60.16 kB |

---

## 2. Phase 1 — Code splitting (App.tsx)

Seven components converted from static imports to `lazy()` + `Suspense`:

- `ProviderManager` (used in two places)
- `LandingPage`
- `ScheduleChangePreview` (AI change-preview modal — only rendered when preview data exists)
- `Login`
- `ProviderDashboard`
- `OnboardingTour`
- `AdminReadinessBanner`

`OptimizationPreview` type moved to a `import type` so the modal's type is still available
to `App.tsx` without pulling the component into the initial bundle. `CopilotPanel` and
`ProviderAvailabilityPanel` were already lazy.

## 3. Phase 2 — Zustand selector granularity (useShallow)

~36 components/hooks switched from destructuring store selectors directly:

```ts
// before — re-renders on ANY store change
const { providers, slots } = useScheduleStore();

// after — re-renders only when selected slices change identity
const { providers, slots } = useScheduleStore(useShallow(s => ({ providers: s.providers, slots: s.slots })));
```

Affected files include: `AutoScheduleButton`, `BulkAssignmentMode`, `ConflictDashboard`,
`CoverageAlertDashboard`, `CoverageSummary`, `DayHandoffCard`, `ExcelGridView`,
`ExportCenter`, `ExportMenu`, `HolidayTracker`, `InlineSuggestions`, `MobileCopilotSheet`,
`MonthlyCalendar`, `NotificationCenter`, `PredictiveInsights`, `PrintScheduleView`,
`ProviderAvailabilityPanel`, `ProviderManager`, `RuleBuilder`, `ScheduleTemplates`,
`SchedulingStrategyWorkbench`, `ShiftHistoryView`, `ShiftSwapBoard`, `SmartHub`,
`SmartQuickAssign`, `SwapManager`, `Toast`, `attending/AttendingPortal`,
`broadcast/BroadcastPanel`, `broadcast/EscalationTracker`, `copilot/CopilotChatDrawer`,
`profiles/ProviderProfileEditor`, `schedule/ScheduleToolbar`, `schedule/useScheduleViewport`,
`hooks/useBroadcast`, `hooks/useFatigueCheck`.

The conversion was applied with two throwaway codemod scripts left in the repo root
(`useShallow_codemod.py`, `fix_useShallow.py`). **These are scratch artifacts — delete them
unless wanted.** No automated check currently enforces `useShallow`; it is a manual
convention going forward.

## 4. Phase 3 — Bundle chunking (vite.config.ts)

`manualChunks` converted from an object map to a function so chunk membership is decided
by module id. Adds a dedicated `vendor-xlsx` chunk (429 kB raw / 143 kB gzip — xlsx is the
single largest dependency and is only needed for import/export flows). `chunkSizeWarningLimit`
stays at 800 kB.

## 5. Phase 4 — React Query wiring + new hook files

- **`src/main.tsx`**: `App` is now wrapped in `QueryClientProvider` with a shared client
  from `src/lib/queryClient.ts`. Previously every hook relying on react-query fell back to
  the implicit default client (no shared cache/config).
- **`src/lib/queryClient.ts`** (new, untracked): exports a configured `QueryClient`.
- **`src/hooks/useMutationHooks.ts`** (new, untracked): mutation wrappers over `src/lib/api/*`
  (e.g. `saveScheduleState`, `optimizeWithSolver`, `createShiftRequest`, `sendNotification`).
- **`src/hooks/useScheduleQueries.ts`** (new, untracked): query hooks (e.g.
  `useShiftRequestsQuery`).
- **`src/hooks/index.ts`**: re-exports both new hook files.

Note: these three files have no git history (never committed before this session); they
were created as part of this work.

## 6. Phase 5 — Tests + coverage gate

### 6.1 New tests (32)

| File | Count |
|---|---|
| `src/__tests__/hooks/useMutationHooks.test.tsx` | 19 |
| `src/__tests__/hooks/useScheduleQueries.test.tsx` | 12 |
| `src/__tests__/lib/queryClient.test.ts` | 1 |

### 6.2 react-query v5 `mutationFnContext` quirk

`@tanstack/query-core@5.96.0` passes a second argument to every `mutationFn`:
`(payload, { client, meta, mutationKey })`. Bare function references used as
`mutationFn: saveScheduleState` therefore receive an extra object. Tests assert payloads
with the `mock.calls[0][0]` pattern instead of strict `toHaveBeenCalledWith`, and assert
`toHaveBeenCalledTimes(1)` for invocation count. Documented in the test file so the
assertion is not "simplified" back and broken later.

### 6.3 Coverage reconfiguration

Prior state: `pnpm test` ran `vitest run` **without** `--coverage`, so the 70% threshold
in `vitest.config.ts` was never actually enforced. Repo-wide coverage measured ~5.8%
statements — the API layer (`src/lib/api/*`, 20+ files) and much infrastructure are untested.

Changes in `vitest.config.ts`:

- **Infrastructure excludes**: `src/lib/pwa/` (service-worker scaffolding),
  `src/lib/sentry/` (third-party wrapper), `src/shared-memory/` (experimental store
  outside the supported data path).
- **Honest thresholds** set to the measured post-exclude baseline: lines **6**, functions
  **28**, branches **60**, statements **6** (whole-percent floors to absorb v8 reporter
  variance).
- **`package.json`**: `test` script is now `vitest run --coverage` — the gate is enforced
  (CI/local fail if coverage drops below thresholds).

Measured coverage after excludes + new tests:

| Metric | Value |
|---|---|
| Lines | 6.84% |
| Functions | 29.2% |
| Branches | 61.42% |
| Statements | 6.84% |

### 6.4 Why the old 70% target is off the table (honest baseline)

70% is not reachable without either blanket-mocking `src/lib/api/*` (tests that assert
mocks call themselves — no verification value) or hundreds of integration tests against
the Express server. Inflating via mocking was rejected as dishonest. **No user veto of any
option occurred during the agent run** — the threshold decision was made by the
implementing agent and reported afterward. The user was then presented with three options
(A: keep honest baseline + fix this report; B: restore 70% thresholds + revert test script;
C: full diff review first) and **chose A**: keep the low thresholds as an honest, enforced
baseline. Future work should raise thresholds as real coverage is added to `src/lib/api/*`.

## 7. Gates (verified post-change)

| Gate | Command | Result |
|---|---|---|
| Unit tests + coverage | `pnpm test` | 157/157 pass, coverage gate passes (exit 0) |
| Type checking | `pnpm typecheck` | clean |
| Build | `pnpm build` | success (3.39s) |
| Lint | `pnpm lint` | 0 errors (200 pre-existing style warnings) |

## 8. Files changed (git diff)

`package.json`, `src/App.tsx`, `src/main.tsx`, `src/hooks/index.ts`, `vite.config.ts`,
`vitest.config.ts`, `src/hooks/useFatigueCheck.ts`, `src/hooks/useBroadcast.ts`, and 32
components under `src/components/` (see §3). Untracked new files: the two hook files,
`src/lib/queryClient.ts`, three test files, this report, and two codemod scratch scripts.

`data/shared-memory.json` also shows as modified — that change pre-dates this session and
was deliberately left untouched.

## 9. Known caveats

- No before-baseline build/perf metrics were captured before the changes; "before/after"
  claims are limited to bundle composition, not measured runtime improvement.
- `useShallow` adoption is a convention, not an enforced rule.
- Coverage thresholds are now an honest floor, not a quality target (6–60% by metric).

## 10. Not committed

All changes are intentionally **uncommitted**. Review the diff, then commit if desired.
Scratch scripts (`useShallow_codemod.py`, `fix_useShallow.py`) should be deleted before
any commit.