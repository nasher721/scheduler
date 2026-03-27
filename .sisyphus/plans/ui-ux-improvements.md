# Neuro ICU Scheduler — UI/UX Improvement Plan

## TL;DR

> **Quick Summary**: Fix 26 UI/UX issues across critical bugs (test data exposure, placeholder UUIDs, empty schedule UX, duplicate buttons, wrong date defaults), UX/design problems (overcrowded header, unreadable staff list, naming inconsistencies, intrusive onboarding/AI), feature gaps (auth visibility, coverage dashboard, notifications), and visual design (hierarchy, avatars, responsive, dark mode, typography).
> 
> **Deliverables**:
> - Cleaned demo data with realistic provider names and masked placeholder emails
> - Restructured header toolbar with logical action groups
> - Improved provider cards with FTE values, avatars, and collapsed recovery rules
> - Empty-state CTAs for zero-coverage schedules
> - Calendar defaulting to current week
> - Onboarding delayed to opt-in prompt; Copilot minimized by default
> - PWA install banner delayed until meaningful engagement
> - Visual hierarchy overhaul (sidebar accent, header differentiation, shift-type color coding)
> - Responsive sidebar collapse and dark mode toggle
> - Coverage heatmap and notification center for critical gaps
> - Priority legend and "No matches" tooltips
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Task 1 (Data) → Task 3 (Empty States) → Task 5 (Header) → Task 12 (Visual Hierarchy) → Task 17 (Responsive) → Final Verification

---

## Context

### Original Request
User provided a comprehensive audit of 26 UI/UX issues in the Neuro ICU Scheduler application, categorized as:
- 5 Critical Issues (test data, UUIDs, empty schedule, duplicate buttons, wrong date)
- 8 UX & Design Problems (overcrowded header, dense staff list, naming, cryptic labels, onboarding, AI panel, priority legend, PWA banner)
- 7 Feature Gaps (auth visibility, provider data, coverage dashboard, shift requests, bulk assignment, notifications, export clarity)
- 6 UI/Visual Design Recommendations (visual hierarchy, shift states, avatars, responsive, dark mode, typography)

### Interview Summary
**Key Discussions**:
- Technology stack confirmed: React + TypeScript + Vite frontend, Node.js/Express backend, Zustand state management
- App.tsx is the main layout component with inline header toolbar (no separate ScheduleToolbar component in use)
- ProviderManager.tsx handles staff sidebar with recovery rule text repeated per card
- OnboardingTour.tsx auto-triggers after 1s delay on first visit (localStorage flag)
- CopilotPanel opens by default; no minimized state on load
- ExportMenu.tsx exists for export functionality
- NotificationCenter.tsx handles notification/alert system

**Research Findings**:
- Header toolbar in App.tsx lines 408-489: ~18 elements competing for attention in one scrollable bar
- ProviderManager.tsx lines 314-317: Recovery rule text "Mon-Wed nights → Thu/Fri off. Thu-Sun nights → next week recovery." hardcoded and repeated for every provider
- OnboardingTour.tsx lines 336-343: Auto-show on first visit with 1s timeout
- Provider email displayed raw at line 253 with no UUID masking
- Calendar date defaults controlled by `startDate` in Zustand store
- ViewToggle has "Command" label mapped to "conflicts" view mode
- Coverage stats calculated in App.tsx lines 221-238 but no empty-state CTA when coverage = 0%

### Gap Analysis (Self-Conducted — Metis Timed Out)
**Gaps Addressed**:
1. **Data source unknown**: Test data likely comes from Excel import or seed data — plan includes data cleanup task that scans store for fake patterns
2. **Schedule empty-state**: No component handles 0% coverage — new EmptyScheduleState component needed
3. **Duplicate Import buttons**: App.tsx has hidden file input (line 411-416) AND visible "Import" button (line 425) — merge into single button
4. **startDate default**: Need to check store.ts for default value and update to current week
5. **Responsive layout**: No responsive breakpoints in current layout — needs sidebar collapse logic
6. **Dark mode**: useTheme hook exists (used in OnboardingTour) — dark mode infrastructure already partially in place
7. **Export formats**: ExportMenu.tsx exists but unclear what formats — needs audit
8. **Auth visibility**: #admin auto-login in App.tsx but no user indicator in header

---

## Work Objectives

### Core Objective
Transform the Neuro ICU Scheduler from a functional but rough prototype into a polished, clinical-grade scheduling tool that earns trust from healthcare professionals through clean data presentation, intuitive UX, and professional visual design.

### Concrete Deliverables
- `src/store.ts`: Updated default startDate to current week; UUID email masking logic
- `src/App.tsx`: Restructured header toolbar; empty-state CTA; merged Import buttons; user avatar/role indicator; delayed PWA prompt
- `src/components/ProviderManager.tsx`: Collapsed recovery rules; FTE value display; provider avatars; UUID email masking
- `src/components/OnboardingTour.tsx`: Opt-in prompt instead of auto-fire
- `src/components/CopilotPanel.tsx`: Default minimized state
- `src/components/InstallPrompt.tsx`: Delayed trigger (2+ min engagement)
- `src/components/EmptyScheduleState.tsx`: New component for 0% coverage guidance
- `src/components/CoverageHeatmap.tsx`: New coverage visualization component
- `src/components/NotificationBanner.tsx`: New prominent alert component
- `src/components/PriorityLegend.tsx`: New tooltip/legend for priority levels
- `src/components/ViewToggle.tsx`: Renamed "Command" → "Conflicts"; default label → "— Select view —"
- `src/styles/*.css`: Visual hierarchy updates (sidebar accent, header color, shift-type colors)
- Responsive layout: Sidebar collapse logic for < 1280px viewports

### Definition of Done
- [x] `pnpm build` succeeds with zero errors
- [x] No fake test names ("aewfwef", "dfzgrdfg") visible in UI
- [x] No raw UUIDs displayed as email addresses
- [x] Calendar defaults to current week
- [x] Only one Import button visible in header
- [x] Empty schedule shows clear CTA
- [x] Onboarding does NOT auto-fire on page load
- [x] Copilot panel is minimized by default
- [x] Header actions grouped logically with dividers
- [x] Provider cards show FTE numeric values
- [x] Recovery rule text not repeated 21 times
- [x] Shift types have distinct color coding
- [x] "No matches" buttons have explanatory tooltips
- [x] Priority levels have a visible legend
- [x] "Command" renamed to "Conflicts" in view toggle
- [x] Export options have clear format labels (already implemented)

### Must Have
- All 5 critical issues resolved (test data, UUIDs, empty state, duplicate button, date default)
- Header toolbar restructured into logical groups
- Onboarding changed from auto-fire to opt-in
- Copilot minimized by default
- PWA banner delayed
- Provider cards show actual FTE values
- Recovery rule text collapsed/badged

### Must NOT Have (Guardrails)
- Do NOT change the scheduling algorithm or constraint solver logic
- Do NOT modify backend API endpoints or server.js
- Do NOT remove any existing functionality — only improve UX
- Do NOT add new npm dependencies unless absolutely necessary (prefer CSS/Tailwind)
- Do NOT change the Zustand store schema in a breaking way
- Do NOT remove the onboarding tour — just change its trigger
- Do NOT remove the Copilot — just minimize it by default
- Do NOT implement full authentication system — only surface existing auth state
- Do NOT add a real coverage heatmap that requires new data — use existing slot data
- Do NOT redesign the entire color system — build on existing Tailwind theme

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest.config.ts found, test files in src/__tests__/)
- **Automated tests**: Tests-after (add tests for new utility functions only)
- **Framework**: vitest
- **If TDD**: N/A — this is primarily UI/UX work; tests for utility functions only

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright — Navigate, interact, assert DOM, screenshot
- **CLI/Build**: Use Bash — `pnpm build`, `pnpm lint`
- **Visual Regression**: Use Playwright screenshots for before/after comparison

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — data fixes + quick wins):
├── Task 1: Clean test data + mask placeholder UUIDs [unspecified-high]
├── Task 2: Fix duplicate Import button [quick]
├── Task 3: Fix calendar default date to current week [quick]
├── Task 4: Add empty-schedule CTA component [quick]
├── Task 5: Rename "Command" → "Conflicts" + fix default label [quick]
├── Task 6: Add "No matches" tooltip [quick]
└── Task 7: Add Priority legend [quick]

Wave 2 (After Wave 1 — UX behavior fixes):
├── Task 8: Change onboarding from auto-fire to opt-in prompt [unspecified-high]
├── Task 9: Minimize Copilot panel by default [quick]
├── Task 10: Delay PWA install banner [quick]
├── Task 11: Restructure header toolbar into logical groups [visual-engineering]
├── Task 12: Add user avatar + role indicator to header [quick]
└── Task 13: Add export format labels [quick]

Wave 3 (After Wave 2 — provider card improvements):
├── Task 14: Show FTE numeric values on provider cards [unspecified-high]
├── Task 15: Collapse recovery rule text + add badge [unspecified-high]
├── Task 16: Add provider avatar initials [visual-engineering]
└── Task 17: Add provider initials to calendar shift slots [visual-engineering]

Wave 4 (After Wave 3 — visual design overhaul):
├── Task 18: Visual hierarchy — sidebar accent + header differentiation [visual-engineering]
├── Task 19: Shift-type color coding system [visual-engineering]
├── Task 20: Shift slot visual states (unassigned/assigned/conflict/no-matches) [visual-engineering]
├── Task 21: Typography scale improvements [visual-engineering]
└── Task 22: Coverage summary prominence [visual-engineering]

Wave 5 (After Wave 4 — responsive + dark mode + notifications):
├── Task 23: Responsive sidebar collapse [visual-engineering]
├── Task 24: Dark mode toggle in header [visual-engineering]
├── Task 25: Notification banner for critical gaps [unspecified-high]
├── Task 26: Discoverability improvements (Bulk Assignment + Shift Requests) [unspecified-high]
└── Task 27: Build verification + lint + final polish [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T4 → T11 → T18 → T23 → F1-F4 → user okay
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 7 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 14, 15, 16 | 1 |
| 2 | — | 11 | 1 |
| 3 | — | 4 | 1 |
| 4 | 3 | 22 | 1 |
| 5 | — | — | 1 |
| 6 | — | — | 1 |
| 7 | — | — | 1 |
| 8 | — | — | 2 |
| 9 | — | — | 2 |
| 10 | — | — | 2 |
| 11 | 2 | 12 | 2 |
| 12 | 11 | 24 | 2 |
| 13 | — | — | 2 |
| 14 | 1 | — | 3 |
| 15 | 1 | — | 3 |
| 16 | 1 | 17 | 3 |
| 17 | 16 | — | 3 |
| 18 | — | 19, 20 | 4 |
| 19 | 18 | 20 | 4 |
| 20 | 18, 19 | — | 4 |
| 21 | — | — | 4 |
| 22 | 4 | — | 4 |
| 23 | 18 | — | 5 |
| 24 | 12, 18 | — | 5 |
| 25 | — | — | 5 |
| 26 | — | — | 5 |
| 27 | ALL | F1-F4 | 5 |

### Agent Dispatch Summary

- **Wave 1**: 7 tasks — T1 → `unspecified-high`, T2-T7 → `quick`
- **Wave 2**: 6 tasks — T8 → `unspecified-high`, T9-T10,T12-T13 → `quick`, T11 → `visual-engineering`
- **Wave 3**: 4 tasks — T14-T15 → `unspecified-high`, T16-T17 → `visual-engineering`
- **Wave 4**: 5 tasks — T18-T22 → `visual-engineering`
- **Wave 5**: 5 tasks — T23-T24 → `visual-engineering`, T25-T26 → `unspecified-high`, T27 → `quick`
- **FINAL**: 4 tasks — F1 → `oracle`, F2-F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Clean test data + mask placeholder UUIDs

  **What to do**:
  - In `src/store.ts`, find the provider data initialization/seed logic and replace fake test names ("aewfwef", "dfzgrdfg", "asdaffd", "aadfewfwefewfefewf") with realistic clinical provider names (e.g., "Dr. Sarah Chen", "Dr. Marcus Williams", "Dr. Priya Patel", etc.). Generate at least 7-10 realistic names.
  - Add a utility function `maskPlaceholderEmail(email: string | undefined): string` that detects UUID-pattern emails matching `/<uuid>@placeholder\.org/` and returns "—" instead. If email is undefined/null/empty, return "Email not set".
  - Apply this mask in `ProviderManager.tsx` line 253 where `p.email` is displayed, and anywhere else provider email is rendered.
  - Also check `data/schedule-state.json` for any persisted test data with fake names and replace.
  - Add a "Demo Mode" indicator banner at the top of the app when `import.meta.env.DEV` is true, showing "Demo Mode — This data is for demonstration purposes only" in a muted banner below the header.

  **Must NOT do**:
  - Do NOT change the provider data schema/types
  - Do NOT modify backend API endpoints
  - Do NOT remove any provider records — only rename/mask

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding data flow through store → UI components, multiple file touches
  - **Skills**: [`react-expert`]
    - `react-expert`: Store → component data flow, state masking patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: Tasks 14, 15, 16
  - **Blocked By**: None

  **References**:
  - `src/store.ts` — Zustand store with provider data; find the `providers` state initialization and any seed/default data
  - `src/components/ProviderManager.tsx:253` — Where `p.email` is rendered; apply mask here
  - `src/types/index.ts` — Provider type definition; understand email field shape
  - `data/schedule-state.json` — Persisted state that may contain test data

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - No provider with names matching "aewfwef", "dfzgrdfg", "asdaffd", "aadfewfwefewfefewf" appears in the UI
  - No email matching `<uuid>@placeholder.org` is displayed as-is; all show "—"
  - Providers with no email show "Email not set"
  - Demo Mode banner visible when `import.meta.env.DEV === true`

  **QA Scenarios**:
  ```
  Scenario: Fake names are replaced with realistic names
    Tool: Bash (pnpm dev + Playwright)
    Preconditions: App running with default store state
    Steps:
      1. Start dev server: pnpm dev
      2. Navigate to http://localhost:5173/#admin
      3. Wait for provider list to render in sidebar
      4. Extract all provider name text from .provider-card elements
      5. Assert: no name matches pattern /[a-z]{5,}@|^[a-z]{6,10}$/ (random lowercase)
    Expected Result: All provider names look like real names (First Last format)
    Evidence: .sisyphus/evidence/task-1-provider-names.txt

  Scenario: Placeholder UUID emails are masked
    Tool: Playwright
    Preconditions: App running with providers that have UUID emails
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find all provider email elements in sidebar
      3. Assert: no element text matches /^[0-9a-f-]{36}@placeholder\.org$/
      4. Assert: elements with UUID emails show "—" or "Email not set"
    Expected Result: UUIDs never appear as email text
    Evidence: .sisyphus/evidence/task-1-email-masking.png

  Scenario: Demo Mode banner appears in dev
    Tool: Playwright
    Preconditions: App running in dev mode
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Look for element containing "Demo Mode"
      3. Assert: banner exists and is visible
    Expected Result: "Demo Mode — This data is for demonstration purposes only" visible
    Evidence: .sisyphus/evidence/task-1-demo-banner.png
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `fix(ui): clean test data, mask placeholder UUIDs, add demo mode banner`
  - Files: `src/store.ts`, `src/components/ProviderManager.tsx`, `data/schedule-state.json`
  - Pre-commit: `pnpm build`

- [x] 2. Fix duplicate Import button

  **What to do**:
  - In `src/App.tsx`, there are two Import triggers: a hidden `<input type="file">` (line 411-416) and a visible "Import" text button (line 425). The hidden input is the actual file picker and the visible button triggers it via `fileInputRef.current?.click()`.
  - Verify that the visible "Import" button at line 425 is the only user-facing Import action. Check if there is a second Import button elsewhere in the toolbar that duplicates this functionality.
  - If there is truly a duplicate, remove the redundant one. If the hidden input + visible button is the only Import mechanism and appears correct (single button), then verify the duplicate issue is resolved.
  - Ensure the remaining Import button has a clear label/icon that indicates it imports Excel files (e.g., add an Upload icon or change text to "Import .xlsx").

  **Must NOT do**:
  - Do NOT remove the hidden file input — it's needed for the file picker
  - Do NOT change import functionality logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, focused fix in one file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: Task 11
  - **Blocked By**: None

  **References**:
  - `src/App.tsx:408-489` — Full header toolbar section; locate all Import-related elements
  - `src/App.tsx:91` — `fileInputRef` declaration
  - `src/App.tsx:425` — Visible Import button

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Only ONE Import button/action is visible in the header toolbar
  - Import button clearly indicates it handles .xlsx files

  **QA Scenarios**:
  ```
  Scenario: Only one Import button visible
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Count all buttons/elements with text containing "Import" in the header toolbar
      3. Assert: count === 1
    Expected Result: Exactly one Import button visible
    Evidence: .sisyphus/evidence/task-2-single-import.png
  ```

  **Commit**: YES (groups with Wave 1)

- [x] 3. Fix calendar default date to current week

  **What to do**:
  - In `src/store.ts`, find the default value for `startDate`. It likely defaults to a hardcoded date like "2026-01-05" or similar.
  - Change the default to compute the Monday of the current week (or the current date). Use: `new Date().toISOString().split('T')[0]` or compute the Monday: find the current date, go back to Monday of that week.
  - Also check if there's persisted state in localStorage (`nicu-schedule-store-v4`) that might override the default. If persisted state exists with an old date, the store should still respect it (user may have intentionally set a past date for a scenario). Only change the INITIAL default.
  - The `setScheduleRange` function should continue to work as before.

  **Must NOT do**:
  - Do NOT force-overwrite persisted user state
  - Do NOT change the date picker or week input behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single value change in store initialization
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4-7)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `src/store.ts` — Find `startDate` default value in store initialization
  - `src/App.tsx:508` — Date picker input that displays `startDate`

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Fresh load (no persisted state) shows calendar for current week
  - Persisted state with custom date is NOT overwritten

  **QA Scenarios**:
  ```
  Scenario: Calendar defaults to current week on fresh load
    Tool: Playwright
    Preconditions: Clear localStorage before test (no persisted state)
    Steps:
      1. Clear localStorage: window.localStorage.clear()
      2. Navigate to http://localhost:5173/#admin
      3. Read the date input value (startDate)
      4. Get current week's Monday date
      5. Assert: startDate matches current week's Monday
    Expected Result: Calendar shows current week, not January 2026
    Evidence: .sisyphus/evidence/task-3-current-week.png

  Scenario: Persisted date is not overwritten
    Tool: Playwright
    Preconditions: App with persisted state from previous session
    Steps:
      1. Set a custom startDate in the date picker (e.g., 2026-04-06)
      2. Reload the page
      3. Read the date input value
      4. Assert: startDate still shows 2026-04-06
    Expected Result: User's chosen date persists across reloads
    Evidence: .sisyphus/evidence/task-3-persisted-date.png
  ```

  **Commit**: YES (groups with Wave 1)

- [x] 4. Add empty-schedule CTA component

  **What to do**:
  - Create `src/components/EmptyScheduleState.tsx` — a new component that shows when coverage is 0%.
  - The component should display:
    - A clear message: "Your schedule is empty"
    - A subtitle: "Get started by importing a schedule or using AI to auto-fill shifts."
    - Two CTA buttons: "Import Schedule" (triggers file import) and "Auto-Fill with AI" (triggers `autoAssign`)
    - An illustration area or icon (use Lucide `CalendarX` or similar)
  - In `src/App.tsx`, conditionally render this component in the main content area (inside `<main>`, before the calendar) when `coverage === 0 && safeSlots.length > 0`.
  - Style it as a centered card with muted background, distinct from the calendar area.

  **Must NOT do**:
  - Do NOT show this when there are genuinely 0 slots (different from 0 filled slots)
  - Do NOT block the calendar — this should be an overlay or inline card, not a modal

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: New standalone component, simple conditional rendering
  - **Skills**: [`react-expert`]
    - `react-expert`: Component composition, conditional rendering patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: Task 22
  - **Blocked By**: Task 3 (needs correct date default to avoid confusion)

  **References**:
  - `src/App.tsx:221-222` — `assigned` and `coverage` calculation
  - `src/App.tsx:433-437` — Auto-Fill button pattern to replicate
  - `src/App.tsx:91` — `fileInputRef` for Import button trigger
  - `src/App.tsx:593-603` — Main content area where empty state should render

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - When coverage = 0% and slots exist, empty state card is visible
  - "Auto-Fill with AI" button triggers autoAssign
  - "Import Schedule" button triggers file picker
  - Empty state disappears once any slot is assigned

  **QA Scenarios**:
  ```
  Scenario: Empty state shows when coverage is 0%
    Tool: Playwright
    Preconditions: App running with 0% coverage (fresh state with slots)
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Look for element containing "Your schedule is empty"
      3. Assert: empty state card is visible
      4. Look for "Auto-Fill with AI" button
      5. Assert: button exists and is clickable
    Expected Result: Clear CTA visible when no shifts are assigned
    Evidence: .sisyphus/evidence/task-4-empty-state.png

  Scenario: Empty state hides after assignment
    Tool: Playwright
    Preconditions: Empty schedule state
    Steps:
      1. Click "Auto-Fill with AI" button
      2. Wait for assignments to complete
      3. Look for "Your schedule is empty" text
      4. Assert: empty state is no longer visible
    Expected Result: CTA disappears once schedule has assignments
    Evidence: .sisyphus/evidence/task-4-after-fill.png
  ```

  **Commit**: YES (groups with Wave 1)

- [x] 5. Rename "Command" → "Conflicts" + fix default label

  **What to do**:
  - In `src/App.tsx:211`, change the `conflicts` view mode label from `"Command"` to `"Conflicts"` in the `titles` record.
  - In `src/components/ViewToggle.tsx`, find the dropdown/button that displays view options. The default/first option currently shows "Insights" (or similar). Change the default label to "— Select view —" or "Schedule" (whichever makes more semantic sense for the default view).
  - Ensure the Operations dropdown option labeled "Command" is updated to "Conflicts" if it exists in ViewToggle separately from the App.tsx titles mapping.
  - Check that the `viewMode` state value `"conflicts"` still maps correctly after label change.

  **Must NOT do**:
  - Do NOT change the underlying viewMode string values (keep "conflicts", "analytics", etc.)
  - Do NOT remove any view options

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple label changes in 1-2 files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/App.tsx:211` — `conflicts: "Command"` label mapping
  - `src/components/ViewToggle.tsx` — View toggle dropdown component with option labels

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - View toggle shows "Conflicts" instead of "Command"
  - Default dropdown item has clear label (not just "Insights")

  **QA Scenarios**:
  ```
  Scenario: "Conflicts" label appears in view toggle
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find the ViewToggle component (view mode selector)
      3. Get all option/label text from the toggle
      4. Assert: "Command" is NOT present
      5. Assert: "Conflicts" IS present
    Expected Result: Label reads "Conflicts" not "Command"
    Evidence: .sisyphus/evidence/task-5-conflicts-label.png
  ```

  **Commit**: YES (groups with Wave 1)

- [x] 6. Add "No matches" tooltip

  **What to do**:
  - Find the calendar component that renders shift slot buttons labeled "No matches" (likely in `src/components/EnhancedCalendar.tsx`, `src/components/Calendar.tsx`, or `src/components/calendar/` directory).
  - Add a `title` attribute to the "No matches" button: `"No providers meet the skill/availability requirements for this shift."`
  - Optionally, add a small info icon (`AlertCircle` from lucide-react) next to the "No matches" text for visual clarity.
  - Ensure tooltip appears on hover across all shift types that show "No matches" (Main Campus Nights, AMET, Jeopardy, etc.).

  **Must NOT do**:
  - Do NOT change the "No matches" button behavior or click handler
  - Do NOT add a full popover — a `title` tooltip is sufficient

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small tooltip addition, likely in 1-2 files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/EnhancedCalendar.tsx` — Search for "No matches" string
  - `src/components/Calendar.tsx` — Search for "No matches" string
  - `src/components/calendar/` — Check subcomponents for shift slot rendering

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - All "No matches" buttons have a title attribute with explanatory text
  - Hovering over "No matches" shows tooltip

  **QA Scenarios**:
  ```
  Scenario: "No matches" has explanatory tooltip
    Tool: Playwright
    Preconditions: App running with shifts showing "No matches"
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find all elements with text "No matches"
      3. For each element, check title attribute
      4. Assert: title contains "skill" or "availability" or "requirements"
    Expected Result: Every "No matches" button has helpful tooltip
    Evidence: .sisyphus/evidence/task-6-no-matches-tooltip.png
  ```

  **Commit**: YES (groups with Wave 1)

- [x] 7. Add Priority legend

  **What to do**:
  - Create `src/components/PriorityLegend.tsx` — a small tooltip/popover that explains priority levels:
    - Priority 1: CRITICAL shifts — must-fill, patient safety dependent
    - Priority 2: HIGH shifts — standard coverage requirements
    - Priority 3: LOW shifts — optional/stretch coverage
  - In `src/App.tsx`, find where "Priority 1 (0/0)", "Priority 2 (0/63)", "Priority 3 (0/0)" are rendered. These are likely in the coverage/awareness strip around lines 493-531.
  - Add an info icon (`Info` from lucide-react) next to the priority labels that, on hover, shows the PriorityLegend tooltip.
  - Use a simple CSS tooltip or a lightweight popover — no new dependencies.

  **Must NOT do**:
  - Do NOT add a heavy tooltip library
  - Do NOT change the priority calculation logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: New small component + integration point
  - **Skills**: [`react-expert`]
    - `react-expert`: Tooltip/popover patterns without external libraries

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/App.tsx:493-531` — Awareness strip where coverage stats are shown; priority labels may be here or in a subcomponent
  - `src/components/Calendar.tsx` or calendar subcomponents — Priority labels may be rendered per-day in the calendar grid

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Priority labels have an adjacent info icon
  - Hovering/tapping the icon shows explanation of Priority 1/2/3

  **QA Scenarios**:
  ```
  Scenario: Priority legend is accessible
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find element containing "Priority 1" or "Priority 2" or "Priority 3"
      3. Find adjacent info icon
      4. Hover over info icon
      5. Assert: tooltip/popover appears with priority explanation
    Expected Result: User can understand what priority levels mean
    Evidence: .sisyphus/evidence/task-7-priority-legend.png
  ```

  **Commit**: YES (groups with Wave 1)

- [x] 8. Change onboarding from auto-fire to opt-in prompt

  **What to do**:
  - In `src/components/OnboardingTour.tsx`, modify the `useOnboardingTour` hook (lines 336-343). Currently it auto-fires `setIsOpen(true)` after 1s when `!hasSeenTour`.
  - Remove the auto-fire `setTimeout` and replace with: render a small floating "Take a tour?" button/pill in the bottom-right corner (above the Copilot trigger) that the user can click to start the tour.
  - Add a new `TourPrompt` component that shows a small, non-intrusive pill: "🧭 Take a quick tour" with a dismiss X button. This appears only on first visit and disappears once dismissed or tour is completed.
  - Keep the `localStorage` persistence so returning users never see the prompt.
  - In `src/App.tsx`, add the `TourPrompt` component to the render tree (near the bottom, alongside `InstallPrompt`).

  **Must NOT do**:
  - Do NOT remove the onboarding tour content or steps
  - Do NOT change the tour flow once started
  - Do NOT show the prompt on return visits (localStorage flag must work)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Modifies hook behavior + adds new small component + integration in App.tsx
  - **Skills**: [`react-expert`]
    - `react-expert`: Hook refactoring, conditional rendering, localStorage patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-13)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - `src/components/OnboardingTour.tsx:308-353` — `useOnboardingTour` hook with auto-fire logic
  - `src/components/OnboardingTour.tsx:336-343` — Auto-show useEffect to remove
  - `src/App.tsx:691-695` — Where OnboardingTour is rendered

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - On first visit (no localStorage flag): tour does NOT auto-start; a "Take a tour?" prompt appears instead
  - Clicking the prompt starts the tour
  - Dismissing the prompt sets localStorage and never shows again
  - Returning users see neither the tour nor the prompt

  **QA Scenarios**:
  ```
  Scenario: Tour does not auto-fire on first visit
    Tool: Playwright
    Preconditions: Clear localStorage
    Steps:
      1. Clear localStorage: window.localStorage.clear()
      2. Navigate to http://localhost:5173/#admin
      3. Wait 3 seconds
      4. Assert: OnboardingTour backdrop/tooltip is NOT visible
      5. Assert: "Take a tour" prompt IS visible
    Expected Result: No auto-fire; opt-in prompt shown instead
    Evidence: .sisyphus/evidence/task-8-no-autofire.png

  Scenario: Tour starts when prompt is clicked
    Tool: Playwright
    Preconditions: First visit with prompt visible
    Steps:
      1. Click "Take a tour" prompt
      2. Wait for tour tooltip to appear
      3. Assert: Tour step 1 is visible
    Expected Result: Tour begins after explicit user action
    Evidence: .sisyphus/evidence/task-8-tour-starts.png
  ```

  **Commit**: YES (groups with Wave 2)

- [x] 9. Minimize Copilot panel by default

  **What to do**:
  - In `src/store.ts`, find the `isCopilotOpen` state default. Currently it likely defaults to `true` (open).
  - Change the default to `false` (closed/minimized).
  - Ensure the Copilot trigger button (the AI button in the toolbar) still works to open/close the panel.
  - Verify that the floating trigger button for Copilot is visible and clearly indicates the AI assistant is available (icon + "AI" label).

  **Must NOT do**:
  - Do NOT remove the Copilot functionality
  - Do NOT change the Copilot panel content or behavior when open

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single default value change in store
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 10-13)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - `src/store.ts` — Find `isCopilotOpen` default state value
  - `src/App.tsx:474-486` — Copilot trigger button rendering
  - `src/components/CopilotPanel.tsx` — Panel component (verify it handles `isOpen={false}`)

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - On fresh load, Copilot panel is NOT visible/open
  - AI trigger button is visible in toolbar
  - Clicking trigger opens the Copilot panel

  **QA Scenarios**:
  ```
  Scenario: Copilot minimized on load
    Tool: Playwright
    Preconditions: Clear localStorage, fresh load
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Wait for page to load
      3. Look for Copilot panel (large side panel)
      4. Assert: Copilot panel is NOT visible
      5. Look for AI trigger button in toolbar
      6. Assert: AI trigger button IS visible
    Expected Result: Copilot starts minimized, trigger accessible
    Evidence: .sisyphus/evidence/task-9-copilot-minimized.png
  ```

  **Commit**: YES (groups with Wave 2)

- [x] 10. Delay PWA install banner

  **What to do**:
  - In `src/components/InstallPrompt.tsx`, find the logic that determines when to show the PWA install prompt.
  - Add a delay mechanism: only show the install prompt after the user has been active for at least 2 minutes (120,000ms).
  - Track user engagement time using a `useEffect` that starts a timer on mount and accumulates active time (only count time when the tab is focused — use `document.visibilityState`).
  - Alternatively, simpler approach: use `setTimeout` with 120000ms delay before enabling the prompt display.
  - Ensure the prompt does NOT appear simultaneously with the onboarding tour prompt (from Task 8). If both would show, the PWA prompt should wait until the tour prompt is dismissed.

  **Must NOT do**:
  - Do NOT remove the PWA install functionality
  - Do NOT change the install prompt content or design

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Timer logic addition to existing component
  - **Skills**: [`react-expert`]
    - `react-expert`: useEffect timing patterns, visibility API

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-9, 11-13)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - `src/components/InstallPrompt.tsx` — PWA install prompt component; find show/hide logic
  - `src/App.tsx:688` — Where InstallPrompt is rendered

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - PWA banner does NOT appear within first 2 minutes of page load
  - PWA banner DOES appear after 2+ minutes (when browser supports install)
  - No conflict with onboarding tour prompt

  **QA Scenarios**:
  ```
  Scenario: PWA banner does not appear immediately
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Wait 10 seconds
      3. Look for PWA install prompt/banner
      4. Assert: PWA banner is NOT visible
    Expected Result: No PWA interruption on initial load
    Evidence: .sisyphus/evidence/task-10-no-pwa-early.png
  ```

  **Commit**: YES (groups with Wave 2)

- [x] 11. Restructure header toolbar into logical groups

  **What to do**:
  - In `src/App.tsx`, the header toolbar (lines 408-489) currently has ~18 elements in one scrollable bar. Restructure into clearly grouped clusters:
    - **Data group**: Import (with Upload icon), Rollback — separated by divider
    - **Edit group**: Undo, Redo — in their existing grouped container
    - **Schedule group**: Auto-Fill, Optimize (AI), Save to server — separated by divider
    - **Danger group**: Clear schedule, Clear staff — separated by divider with visual warning styling
    - **Info group**: Alert badge (if any), AI toggle — at the end
  - Move the scenario management row (lines 535-560: scenario name input + scenario chips) into a collapsible section or a dropdown. Add a "Scenarios" button that expands the scenario row on click.
  - Keep the awareness strip (lines 493-531: coverage %, slots, date picker, weeks, online status, critical gaps, skill risk) as-is — it's already well-structured.
  - Ensure dividers (`<div className="w-px h-5 bg-border mx-0.5" />`) are used consistently between groups.
  - Add `type="button"` to all toolbar buttons (addresses existing LSP warnings).

  **Must NOT do**:
  - Do NOT remove any toolbar actions
  - Do NOT change the awareness strip layout
  - Do NOT add new dependencies for a dropdown library

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Significant layout restructuring requiring design sensibility
  - **Skills**: [`react-expert`]
    - `react-expert`: Conditional rendering, state management for collapsible sections

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-10, 12-13)
  - **Blocks**: Task 12
  - **Blocked By**: Task 2 (duplicate Import must be resolved first)

  **References**:
  - `src/App.tsx:408-489` — Full header toolbar to restructure
  - `src/App.tsx:535-560` — Scenario management row to collapse
  - `src/App.tsx:493-531` — Awareness strip (keep as-is)

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Toolbar actions are visually grouped with clear dividers
  - Scenario row is collapsible (not always visible)
  - All `type="button"` LSP warnings resolved in toolbar
  - No toolbar action is missing

  **QA Scenarios**:
  ```
  Scenario: Toolbar actions are logically grouped
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Take screenshot of header toolbar
      3. Verify divider elements exist between groups
      4. Count distinct visual groups (Data | Edit | Schedule | Danger | Info)
      5. Assert: at least 3 divider elements present
    Expected Result: Clear visual separation between action groups
    Evidence: .sisyphus/evidence/task-11-toolbar-groups.png

  Scenario: Scenario row is collapsible
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Look for "Scenarios" toggle button or section header
      2. Verify scenario name input is hidden by default
      3. Click toggle to expand
      4. Verify scenario name input is now visible
    Expected Result: Scenario management collapses to save space
    Evidence: .sisyphus/evidence/task-11-scenarios-collapse.png
  ```

  **Commit**: YES (groups with Wave 2)

- [x] 12. Add user avatar + role indicator to header

  **What to do**:
  - In `src/App.tsx`, the `currentUser` object (from Zustand store) contains user info. Add a small user indicator in the top-right of the header area.
  - Display: a small circle with user initials (derived from `currentUser.name` or `currentUser.email`) + a dropdown showing: user name, email, role badge ("Admin" / "Clinician"), and a "Sign out" button.
  - The role badge should use color coding: Admin = primary blue, Clinician = green.
  - If `currentUser` is undefined, show nothing (already handled by login redirect).
  - Position the user indicator in the branding area (top-left, next to the title) or in the toolbar (top-right, after the AI toggle).

  **Must NOT do**:
  - Do NOT implement full authentication flows
  - Do NOT modify the login/logout logic in the store
  - Do NOT add a profile page

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small UI element addition using existing user data
  - **Skills**: [`react-expert`]
    - `react-expert`: Dropdown pattern, conditional rendering

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-11, 13)
  - **Blocks**: Task 24
  - **Blocked By**: Task 11 (header must be restructured first)

  **References**:
  - `src/App.tsx:60` — `currentUser` destructured from store
  - `src/App.tsx:398-406` — Branding area where user indicator could go
  - `src/store.ts` — `currentUser` type shape (name, email, role fields)
  - `src/types/index.ts` — User type definition

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - User initials circle visible in header
  - Clicking shows dropdown with name, email, role badge, sign out
  - Role badge color-coded (Admin vs Clinician)

  **QA Scenarios**:
  ```
  Scenario: User indicator visible with correct info
    Tool: Playwright
    Preconditions: App running with admin user logged in
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find user avatar/initials element in header
      3. Assert: element exists and shows initials
      4. Click on user indicator
      5. Assert: dropdown shows user name, email, "Admin" badge
    Expected Result: User identity visible in header
    Evidence: .sisyphus/evidence/task-12-user-indicator.png
  ```

  **Commit**: YES (groups with Wave 2)

- [x] 13. Add export format labels

  **What to do**:
  - In `src/components/ExportMenu.tsx`, audit what export formats are currently available.
  - If the export button is a single unlabeled button, convert it to either:
    - A split button with the main action showing the default format (e.g., "Export PDF") and a dropdown arrow showing other options (CSV, Excel, Print)
    - OR add an icon that implies the format (e.g., `FileText` for PDF, `Table` for CSV/Excel)
  - Ensure each format option has a clear label: "Export as PDF", "Export as CSV", "Export as Excel", "Print Schedule".
  - If the ExportMenu already shows format options, verify labels are clear and add any missing ones.

  **Must NOT do**:
  - Do NOT change export functionality logic
  - Do NOT add new export formats not already implemented

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Label/icon improvement to existing component
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-12)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - `src/components/ExportMenu.tsx` — Current export menu implementation
  - `src/components/ExportCenter.tsx` — Central export UI
  - `src/components/PrintScheduleView.tsx` — Print/PDF export logic

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Export button shows or implies format type
  - All export options have clear labels

  **QA Scenarios**:
  ```
  Scenario: Export button indicates format
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find the Export button/menu
      3. Click or hover to see options
      4. Assert: options include format labels (PDF, CSV, Excel, etc.)
    Expected Result: User knows what format they're exporting to
    Evidence: .sisyphus/evidence/task-13-export-labels.png
  ```

  **Commit**: YES (groups with Wave 2)

- [x] 14. Show FTE numeric values on provider cards

  **What to do**:
  - In `src/components/ProviderManager.tsx`, the Quick Stats Grid (lines 295-318) shows progress bars with labels "Wk Day", "Wknd Day", "FTE Nights" but the actual numeric target values are only visible as secondary text in the progress bars.
  - Add a compact inline summary above or below the progress bars showing the actual target FTE values in a readable format: e.g., `Wk Day: 10 | Wknd: 4 | Nights: 3`.
  - This should be a single line of text, using `text-xs font-mono` styling, positioned between the header row and the progress bars.
  - Use the values from `p.targetWeekDays`, `p.targetWeekendDays`, `p.targetWeekNights`.

  **Must NOT do**:
  - Do NOT remove the progress bars — this is an addition, not a replacement
  - Do NOT change the FTE input fields in the expanded section

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding provider card layout and data flow
  - **Skills**: [`react-expert`]
    - `react-expert`: Component layout, data display formatting

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15-17)
  - **Blocks**: None
  - **Blocked By**: Task 1 (clean data needed first)

  **References**:
  - `src/components/ProviderManager.tsx:295-318` — Quick Stats Grid with progress bars
  - `src/components/ProviderManager.tsx:299-301` — Wk Day ProgressBar with `target={p.targetWeekDays}`
  - `src/components/ProviderManager.tsx:302-304` — Wknd Day ProgressBar with `target={p.targetWeekendDays}`
  - `src/components/ProviderManager.tsx:305-307` — FTE Nights ProgressBar

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Each provider card shows a compact FTE summary line: `Wk Day: N | Wknd: N | Nights: N`
  - Values match the provider's target settings

  **QA Scenarios**:
  ```
  Scenario: FTE values visible on provider cards
    Tool: Playwright
    Preconditions: App running with providers
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find first provider card
      3. Look for text matching "Wk Day: \\d+ | Wknd: \\d+ | Nights: \\d+"
      4. Assert: FTE summary line exists
    Expected Result: Numeric FTE targets visible at a glance
    Evidence: .sisyphus/evidence/task-14-fte-values.png
  ```

  **Commit**: YES (groups with Wave 3)

- [x] 15. Collapse recovery rule text + add badge

  **What to do**:
  - In `src/components/ProviderManager.tsx`, the Recovery Rule box (lines 314-317) currently shows the full text "Mon-Wed nights → Thu/Fri off. Thu-Sun nights → next week recovery." for EVERY provider card.
  - Replace this with a compact badge that says "Recovery: Auto" or shows a `Clock` icon with "Recovery" text.
  - The full recovery rule text should only be visible in the expanded details section (when `isExpanded === true`).
  - In the collapsed state, show a small badge: `<Clock className="w-3 h-3" /> Recovery` in a muted rounded pill, taking up minimal space.
  - In the expanded section (lines 378-383), keep or enhance the recovery rule description.

  **Must NOT do**:
  - Do NOT change the recovery rule logic
  - Do NOT remove recovery information — just collapse it

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Modifies provider card layout significantly
  - **Skills**: [`react-expert`]
    - `react-expert`: Conditional rendering, layout optimization

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14, 16-17)
  - **Blocks**: None
  - **Blocked By**: Task 1 (clean data needed first)

  **References**:
  - `src/components/ProviderManager.tsx:314-317` — Recovery Rule box to replace with badge
  - `src/components/ProviderManager.tsx:378-383` — Expanded recovery rule description
  - `src/components/ProviderManager.tsx:321-333` — Expand/Collapse toggle

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Collapsed provider cards show a small "Recovery" badge, NOT the full rule text
  - Full rule text visible only in expanded details
  - No provider card repeats the full recovery rule in collapsed state

  **QA Scenarios**:
  ```
  Scenario: Recovery rule collapsed on provider cards
    Tool: Playwright
    Preconditions: App running with 3+ providers
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Count occurrences of "Mon-Wed nights →" text on page
      3. Assert: count === 0 (no full text in collapsed cards)
      4. Count occurrences of "Recovery" badge/pill
      5. Assert: count >= number of providers
    Expected Result: Recovery rule collapsed to badge, not repeated inline
    Evidence: .sisyphus/evidence/task-15-recovery-badge.png
  ```

  **Commit**: YES (groups with Wave 3)

- [x] 16. Add provider avatar initials

  **What to do**:
  - Create a utility function `getInitials(name: string): string` that extracts initials from a provider name. Handle various formats: "Dr. Sarah Chen" → "SC", "Marcus Williams" → "MW", single-word names → first 2 chars.
  - Create a deterministic color assignment function `getAvatarColor(name: string): string` that maps a name to a consistent Tailwind color class (e.g., using a hash of the name to pick from a palette of 8-10 distinct colors).
  - In `src/components/ProviderManager.tsx`, add a colored circle with initials to the left of each provider name in the header row (before the GripVertical drag handle or after it, before the name).
  - The circle should be ~32px, rounded-full, with contrasting text color. Use the deterministic color based on the provider name.
  - Store the utility functions in `src/lib/utils.ts` (which already exists) or a new `src/lib/avatarUtils.ts`.

  **Must NOT do**:
  - Do NOT add a dependency for avatar generation
  - Do NOT fetch external avatar images
  - Do NOT change the provider drag-and-drop behavior

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Visual design decision for avatar colors and sizing
  - **Skills**: [`react-expert`]
    - `react-expert`: Utility functions, component integration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14-15, 17)
  - **Blocks**: Task 17
  - **Blocked By**: Task 1 (clean data needed first)

  **References**:
  - `src/components/ProviderManager.tsx:246-252` — Provider card header row where avatar should go
  - `src/lib/utils.ts` — Existing utility file for new avatar functions
  - `src/components/Calendar.tsx` — DraggableProvider component (for Task 17 integration)

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Each provider card shows a colored circle with initials
  - Same provider always gets the same color (deterministic)
  - Different providers get different colors (from palette)
  - Initials are readable (correct contrast)

  **QA Scenarios**:
  ```
  Scenario: Provider avatars visible and consistent
    Tool: Playwright
    Preconditions: App running with 3+ providers
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find all provider avatar circles in sidebar
      3. Assert: count >= number of providers
      4. Check that each circle contains 1-2 character initials
      5. Check that colors are distinct (at least 2 different bg colors)
    Expected Result: Colored initial circles on each provider card
    Evidence: .sisyphus/evidence/task-16-provider-avatars.png
  ```

  **Commit**: YES (groups with Wave 3)

- [x] 17. Add provider initials to calendar shift slots

  **What to do**:
  - In the calendar components (`src/components/EnhancedCalendar.tsx`, `src/components/Calendar.tsx`, or `src/components/calendar/`), when a shift slot is assigned to a provider, show the provider's initials in a small colored circle next to or instead of just the last name.
  - Reuse the `getInitials` and `getAvatarColor` utility functions from Task 16.
  - For unassigned slots, show a muted "+" icon or dashed border (this connects to Task 20 for full visual states, but at minimum show initials for assigned slots).
  - The calendar cell is likely small, so the avatar should be ~24px with tiny text.

  **Must NOT do**:
  - Do NOT change shift assignment logic
  - Do NOT break the drag-and-drop flow
  - Do NOT make calendar cells larger

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Calendar cell layout is space-constrained, needs careful design
  - **Skills**: [`react-expert`]
    - `react-expert`: Calendar component patterns, compact UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14-16)
  - **Blocks**: None
  - **Blocked By**: Task 16 (avatar utilities must exist first)

  **References**:
  - `src/components/EnhancedCalendar.tsx` — Main calendar view, search for provider name rendering in shift cells
  - `src/components/Calendar.tsx` — Base calendar, search for assigned slot rendering
  - `src/components/calendar/` — Subcomponents for shift cell rendering
  - `src/lib/utils.ts` or `src/lib/avatarUtils.ts` — Avatar utility functions from Task 16

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Assigned shift slots in calendar show provider initials in colored circle
  - Unassigned slots do not show initials
  - Calendar remains scannable (avatars don't clutter)

  **QA Scenarios**:
  ```
  Scenario: Calendar shows provider initials on assigned shifts
    Tool: Playwright
    Preconditions: App running with assigned shifts
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Run auto-fill if needed to get assignments
      3. Find assigned shift cells in calendar
      4. Assert: assigned cells show small colored circles with initials
      5. Find unassigned shift cells
      6. Assert: unassigned cells do NOT show initials
    Expected Result: Provider identity visible at a glance in calendar
    Evidence: .sisyphus/evidence/task-17-calendar-avatars.png
  ```

  **Commit**: YES (groups with Wave 3)

- [x] 18. Visual hierarchy — sidebar accent + header differentiation

  **What to do**:
  - **Sidebar**: Add a left accent border to the `ProviderManager` component. In `src/components/ProviderManager.tsx:131`, the outer div has class `stone-panel`. Add a `border-l-4 border-l-primary` (or similar accent color) to create visual differentiation.
  - **Header**: In `src/App.tsx:391-581`, the header uses `motion.header` with a transparent/default background. Add a distinct background: either a subtle gradient or a solid background color (e.g., `bg-surface/80 backdrop-blur-sm border-b border-border`) to make the header feel authoritative and separated from content.
  - **Branding**: Make the "Neuro ICU Staffing" title more prominent. Increase the subtitle font size from `text-sm` to `text-base` and make it slightly less muted. The coverage percentage (line 496) should use `text-4xl font-semibold` instead of `text-3xl font-light`.
  - **Overall**: Ensure sidebar, header, and content area have visually distinct backgrounds so they don't compete equally.

  **Must NOT do**:
  - Do NOT redesign the entire color system
  - Do NOT change the Tailwind theme configuration
  - Do NOT add new CSS custom properties

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Core visual design decision affecting entire app appearance
  - **Skills**: [`react-expert`]
    - `react-expert`: Tailwind utility classes, responsive design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19-22)
  - **Blocks**: Tasks 19, 20, 23
  - **Blocked By**: Wave 3

  **References**:
  - `src/App.tsx:391-581` — Header section to style
  - `src/App.tsx:400-405` — Branding title and subtitle
  - `src/App.tsx:493-531` — Awareness strip
  - `src/components/ProviderManager.tsx:131` — Sidebar panel outer div
  - `tailwind.config.js` — Existing theme configuration (do NOT modify)

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Sidebar has a visible left accent border
  - Header has a distinct background that separates it from content
  - Title/subtitle hierarchy is clear
  - Coverage percentage is prominent

  **QA Scenarios**:
  ```
  Scenario: Visual hierarchy is clear
    Tool: Playwright (screenshot)
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Take full-page screenshot
      3. Verify sidebar has left accent border (visual inspection)
      4. Verify header background differs from content area
      5. Verify title is larger/more prominent than subtitle
    Expected Result: Three distinct visual zones: header, sidebar, content
    Evidence: .sisyphus/evidence/task-18-visual-hierarchy.png
  ```

  **Commit**: YES (groups with Wave 4)

- [x] 19. Shift-type color coding system

  **What to do**:
  - Define a shift-type color mapping in `src/lib/utils.ts` or a new `src/lib/shiftColors.ts`:
    - Day shifts: `bg-blue-100 text-blue-800 border-blue-200` (light mode) / dark variants
    - Night shifts: `bg-indigo-100 text-indigo-800 border-indigo-200`
    - Consults: `bg-teal-100 text-teal-800 border-teal-200`
    - Jeopardy: `bg-amber-100 text-amber-800 border-amber-200`
    - Recovery: `bg-green-100 text-green-800 border-green-200`
    - AMET: `bg-purple-100 text-purple-800 border-purple-200`
    - NMET: `bg-rose-100 text-rose-800 border-rose-200`
  - Apply these colors to shift slot headers/labels in the calendar components. Find where shift types are rendered (likely in `EnhancedCalendar.tsx` or `Calendar.tsx` subcomponents) and apply the appropriate color class based on the shift type.
  - Ensure colors work in both light and dark mode (use Tailwind dark: prefix).

  **Must NOT do**:
  - Do NOT change shift type values or identifiers
  - Do NOT modify the Tailwind config
  - Do NOT add a CSS-in-JS library

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Color system design with accessibility considerations
  - **Skills**: [`react-expert`]
    - `react-expert`: Conditional class application, dark mode support

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 18, 20-22)
  - **Blocks**: Task 20
  - **Blocked By**: Task 18 (visual hierarchy should be established first)

  **References**:
  - `src/components/EnhancedCalendar.tsx` — Search for shift type labels/rendering
  - `src/components/Calendar.tsx` — Shift type rendering in base calendar
  - `src/types/calendar.ts` — Shift type definitions
  - `src/lib/utils.ts` — Utility file for color mapping function

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Each shift type has a distinct, consistent color
  - Colors are readable in both light and dark mode
  - Color mapping is centralized (not scattered across components)

  **QA Scenarios**:
  ```
  Scenario: Shift types have distinct colors
    Tool: Playwright (screenshot)
    Preconditions: App running with multiple shift types
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Take screenshot of calendar view
      3. Identify shift type labels/headers for different types
      4. Assert: at least 3 different shift types have visually distinct colors
    Expected Result: Color coding makes shift types instantly distinguishable
    Evidence: .sisyphus/evidence/task-19-shift-colors.png
  ```

  **Commit**: YES (groups with Wave 4)

- [x] 20. Shift slot visual states (unassigned/assigned/conflict/no-matches)

  **What to do**:
  - In the calendar components, differentiate shift slot visual states:
    - **Unassigned**: `border-dashed border-border bg-secondary/30` with a subtle "+" icon or "Unassigned" text
    - **Assigned**: `border-solid border-border bg-surface` with provider initials circle (from Task 16/17) and name
    - **Conflict**: `bg-red-50 border-red-200 border-solid` with a warning icon (if conflict detection exists)
    - **No matches**: `bg-amber-50 border-amber-200 border-solid` with an alert icon
  - Find the shift slot cell rendering in the calendar components and apply conditional classes based on slot state (has `providerId`, has conflicts, has no matches).
  - Use the `cn()` utility from `src/lib/utils.ts` for conditional class merging.

  **Must NOT do**:
  - Do NOT change the shift assignment logic
  - Do NOT break drag-and-drop on shift slots

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Detailed visual state design for multiple conditions
  - **Skills**: [`react-expert`]
    - `react-expert`: Conditional styling, component state patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 18-19, 21-22)
  - **Blocks**: None
  - **Blocked By**: Tasks 18, 19 (visual hierarchy and color system needed)

  **References**:
  - `src/components/EnhancedCalendar.tsx` — Search for shift cell/slot rendering
  - `src/components/Calendar.tsx` — Base shift slot rendering
  - `src/lib/utils.ts` — `cn()` utility for class merging
  - `src/lib/shiftConflictUtils.ts` — Conflict detection logic (if used for visual states)

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Unassigned slots have dashed border and muted background
  - Assigned slots have solid border and provider info
  - "No matches" slots have amber background with alert icon
  - Conflict slots have red visual treatment (if conflicts exist)

  **QA Scenarios**:
  ```
  Scenario: Unassigned slots have distinct visual state
    Tool: Playwright (screenshot)
    Preconditions: App running with unassigned shifts
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find unassigned shift cells in calendar
      3. Assert: cells have dashed border style
    Expected Result: Unassigned slots visually distinct from assigned
    Evidence: .sisyphus/evidence/task-20-unassigned-state.png

  Scenario: "No matches" slots have amber visual state
    Tool: Playwright (screenshot)
    Preconditions: App running with "No matches" shifts
    Steps:
      1. Find "No matches" shift cells
      2. Assert: cells have amber/yellow background
      3. Assert: alert icon visible
    Expected Result: "No matches" clearly distinguishable
    Evidence: .sisyphus/evidence/task-20-no-matches-state.png
  ```

  **Commit**: YES (groups with Wave 4)

- [x] 21. Typography scale improvements

  **What to do**:
  - In `src/App.tsx:403-405`, upgrade the subtitle "Coverage, fatigue logic, risk-mitigated assignment." from `text-sm text-foreground-muted` to `text-base text-foreground-secondary` to improve readability.
  - Ensure coverage percentage (line 496) uses `text-4xl font-semibold` for prominence.
  - In the awareness strip (lines 493-531), make "critical gaps" and "skill risk" labels more prominent: use `text-base` instead of `text-xs` for the count numbers, and `text-sm font-medium` for the labels.
  - Review the provider card typography in `ProviderManager.tsx`: ensure provider names are `text-sm font-semibold` and email text is legible (not `text-[9px]` which is too small).
  - Do NOT change typography in the calendar grid cells (they need to stay compact).

  **Must NOT do**:
  - Do NOT introduce a new font or font loading
  - Do NOT change the font-family
  - Do NOT modify the Tailwind theme font settings

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Typography is a core design decision
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 18-20, 22)
  - **Blocks**: None
  - **Blocked By**: Wave 3

  **References**:
  - `src/App.tsx:400-405` — Title and subtitle typography
  - `src/App.tsx:493-531` — Awareness strip typography
  - `src/components/ProviderManager.tsx:252-253` — Provider name and email text sizing

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Subtitle is larger and more readable
  - Coverage percentage is prominent (4xl, semibold)
  - Critical gaps/skill risk numbers are readable (base size)
  - Provider names and emails are legible (not 9px)

  **QA Scenarios**:
  ```
  Scenario: Typography hierarchy is clear
    Tool: Playwright (screenshot comparison)
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Take screenshot of header area
      3. Measure visual weight: title > coverage % > subtitle > labels
      4. Assert: coverage percentage is visually dominant
    Expected Result: Clear typographic hierarchy from most to least important
    Evidence: .sisyphus/evidence/task-21-typography.png
  ```

  **Commit**: YES (groups with Wave 4)

- [x] 22. Coverage summary prominence

  **What to do**:
  - In `src/App.tsx:493-531`, the coverage strip shows stats inline. Enhance the coverage display:
    - When coverage < 50%: show a prominent banner-style card above the calendar (not just the small strip). Use `bg-error/10 border border-error/20` with text "⚠️ Coverage critically low — X% of shifts are unfilled."
    - When coverage is 50-94%: show a yellow/amber indicator card: "Coverage: X% — Some gaps remain."
    - When coverage >= 95%: show a green success indicator: "✓ Coverage: X% — Schedule looks good."
  - These should render in the main content area (above the calendar), not in the header strip.
  - The header strip coverage display remains as the compact indicator; the new card is the prominent in-context reminder.

  **Must NOT do**:
  - Do NOT change the coverage calculation logic
  - Do NOT remove the header strip coverage display
  - Do NOT create a separate "coverage dashboard" page

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Contextual UI design with state-dependent rendering
  - **Skills**: [`react-expert`]
    - `react-expert`: Conditional rendering, threshold-based UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 18-21)
  - **Blocks**: None
  - **Blocked By**: Task 4 (empty state component should exist)

  **References**:
  - `src/App.tsx:221-222` — `assigned` and `coverage` calculation
  - `src/App.tsx:493-531` — Existing awareness strip
  - `src/App.tsx:593-603` — Main content area where card should render

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Low coverage (< 50%) shows prominent warning card
  - Medium coverage (50-94%) shows amber info card
  - High coverage (>= 95%) shows green success card
  - Cards appear above the calendar, not in the header

  **QA Scenarios**:
  ```
  Scenario: Low coverage shows prominent warning
    Tool: Playwright (screenshot)
    Preconditions: App with 0% coverage
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Look for prominent coverage card above calendar
      3. Assert: card has error/warning styling
      4. Assert: card text mentions "critically low" or similar
    Expected Result: Low coverage is impossible to miss
    Evidence: .sisyphus/evidence/task-22-coverage-low.png
  ```

  **Commit**: YES (groups with Wave 4)

- [x] 23. Responsive sidebar collapse

  **What to do**:
  - In `src/App.tsx:590-592`, the sidebar `<aside>` is `w-full xl:w-72`. Add responsive collapse behavior:
    - At viewport width < 1280px (below `xl` breakpoint): sidebar should collapse to an overlay/drawer triggered by a hamburger button.
    - Add a "Staff" toggle button visible only at `< xl` breakpoints (`xl:hidden`) that opens/closes the sidebar overlay.
    - The overlay sidebar should slide in from the left with a backdrop, similar to a mobile drawer pattern.
    - Use Tailwind responsive classes and a local state variable `isSidebarOpen`.
    - At `xl` and above, sidebar remains always-visible as current behavior.
  - Use framer-motion for the slide animation (already a project dependency).

  **Must NOT do**:
  - Do NOT change sidebar behavior at desktop sizes (xl+)
  - Do NOT add a responsive layout library
  - Do NOT change the ProviderManager component internals

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Responsive design requires careful breakpoint handling
  - **Skills**: [`react-expert`]
    - `react-expert`: Responsive patterns, overlay/drawer implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 24-27)
  - **Blocks**: None
  - **Blocked By**: Task 18 (visual hierarchy should be established)

  **References**:
  - `src/App.tsx:584-604` — Main content layout with sidebar and content area
  - `src/App.tsx:590-592` — Sidebar `<aside>` element
  - `src/hooks/useMediaQuery.ts` — Existing media query hook (may be useful)

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - At viewport >= 1280px: sidebar always visible, no toggle button
  - At viewport < 1280px: sidebar hidden, toggle button visible
  - Clicking toggle opens sidebar as overlay drawer
  - Clicking backdrop or toggle again closes drawer
  - Animation is smooth (framer-motion)

  **QA Scenarios**:
  ```
  Scenario: Sidebar collapses on small screens
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Resize viewport to 1024px width
      3. Assert: sidebar is NOT visible in default layout
      4. Assert: "Staff" toggle button IS visible
      5. Click toggle button
      6. Assert: sidebar overlay appears with backdrop
    Expected Result: Responsive sidebar with drawer on smaller screens
    Evidence: .sisyphus/evidence/task-23-responsive-sidebar.png
  ```

  **Commit**: YES (groups with Wave 5)

- [x] 24. Dark mode toggle in header

  **What to do**:
  - The project already has a `useTheme` hook (used in `OnboardingTour.tsx:67`) and a `ThemeToggle` component (found in `src/components/ThemeToggle.tsx`).
  - In `src/App.tsx`, add the existing `ThemeToggle` component to the header toolbar, in the Info group (after the AI toggle button, before the user indicator).
  - Verify that `ThemeToggle` renders correctly and actually toggles between light/dark modes.
  - If `ThemeToggle` doesn't exist or is incomplete, implement a simple toggle: a `Sun`/`Moon` icon button that calls the theme hook's toggle function and persists preference to localStorage.

  **Must NOT do**:
  - Do NOT create a new theme system — use existing infrastructure
  - Do NOT change the color palette
  - Do NOT break light mode while implementing dark mode

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Dark mode requires careful color testing across components
  - **Skills**: [`react-expert`]
    - `react-expert`: Theme toggle patterns, localStorage persistence

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 23, 25-27)
  - **Blocks**: None
  - **Blocked By**: Tasks 12, 18 (user indicator placement, visual hierarchy)

  **References**:
  - `src/components/ThemeToggle.tsx` — Existing theme toggle component
  - `src/hooks/useTheme.ts` — Existing theme hook
  - `src/components/OnboardingTour.tsx:67` — Usage of `useTheme` hook
  - `src/App.tsx:474-486` — AI toggle button area (place ThemeToggle nearby)

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Theme toggle button visible in header toolbar
  - Clicking toggle switches between light and dark mode
  - Theme preference persists across page reloads

  **QA Scenarios**:
  ```
  Scenario: Dark mode toggle works
    Tool: Playwright (screenshot)
    Preconditions: App running in light mode
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Find theme toggle button (Sun/Moon icon) in header
      3. Click toggle
      4. Take screenshot — assert dark background/color scheme
      5. Reload page
      6. Assert: dark mode persists
    Expected Result: Dark mode toggleable and persistent
    Evidence: .sisyphus/evidence/task-24-dark-mode.png
  ```

  **Commit**: YES (groups with Wave 5)

- [x] 25. Notification banner for critical gaps

  **What to do**:
  - Create `src/components/NotificationBanner.tsx` — a prominent banner component that appears when there are critical scheduling issues.
  - The banner should show when: `criticalUnfilled > 0` OR `skillMismatchRisk > 0` OR `fatigueExposure > 0`.
  - Banner content: "⚠️ X critical gaps, Y skill risks, Z fatigue exposures detected. Review your schedule."
  - Style: Full-width banner below the header, above the main content. Use `bg-warning/10 border-b border-warning/30` with amber text.
  - Include a "Dismiss" button and a "View Details" button that switches to the analytics view (`setViewMode("analytics")`).
  - In `src/App.tsx`, add this banner between the header and the main content area, conditionally rendered based on alert counts.

  **Must NOT do**:
  - Do NOT create a full notification center page
  - Do NOT modify backend notification APIs
  - Do NOT add push notification functionality

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New component + integration with existing alert calculations
  - **Skills**: [`react-expert`]
    - `react-expert`: Banner pattern, conditional rendering, view mode switching

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 23-24, 26-27)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - `src/App.tsx:232-238` — `criticalUnfilled`, `skillMismatchRisk`, `fatigueExposure` calculations
  - `src/App.tsx:463-473` — Existing small alert badge (this replaces the need for that badge)
  - `src/App.tsx:581` — Between header close and main content open

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Banner appears when critical issues exist
  - Banner is dismissible
  - "View Details" navigates to analytics view
  - Banner does NOT appear when no issues exist

  **QA Scenarios**:
  ```
  Scenario: Notification banner shows for critical gaps
    Tool: Playwright (screenshot)
    Preconditions: App running with unassigned critical shifts
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Look for notification banner between header and content
      3. Assert: banner visible with critical gap count
      4. Click "View Details"
      5. Assert: view switches to analytics
    Expected Result: Critical issues impossible to miss
    Evidence: .sisyphus/evidence/task-25-notification-banner.png
  ```

  **Commit**: YES (groups with Wave 5)

- [x] 26. Discoverability improvements (Bulk Assignment + Shift Requests)

  **What to do**:
  - **Bulk Assignment**: Find where "Bulk Assignment" is currently rendered (likely in the calendar toolbar or as a small button). Make it more discoverable by:
    - Moving it to a more prominent position in the calendar toolbar area
    - Adding a `Users` or `ClipboardList` icon alongside the text
    - Ensuring it has a visible, non-muted styling
  - **Shift Requests tab**: The "Shift requests" view mode exists (`viewMode: "shift-requests"`). Make it more discoverable by:
    - Adding a badge showing the count of pending requests (if the API returns this data)
    - In the ViewToggle component, if shift-requests has pending items, add a small count badge next to the tab label
  - Both improvements should be minimal — better positioning and visual cues, not feature additions.

  **Must NOT do**:
  - Do NOT build out the shift requests feature
  - Do NOT change Bulk Assignment functionality
  - Do NOT add new API calls

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires finding and enhancing existing UI elements across multiple files
  - **Skills**: [`react-expert`]
    - `react-expert`: Badge patterns, component positioning

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 23-25, 27)
  - **Blocks**: None
  - **Blocked By**: Wave 1

  **References**:
  - `src/components/ViewToggle.tsx` — View mode tabs including shift-requests
  - Calendar toolbar area — Search for "Bulk Assignment" text
  - `src/lib/api/shiftRequests.ts` — Shift requests API (for pending count)

  **Acceptance Criteria**:
  - `pnpm build` succeeds
  - Bulk Assignment button is clearly visible and icon-labeled
  - Shift Requests tab shows pending count badge (if data available)

  **QA Scenarios**:
  ```
  Scenario: Bulk Assignment is discoverable
    Tool: Playwright (screenshot)
    Preconditions: App running
    Steps:
      1. Navigate to http://localhost:5173/#admin
      2. Look for "Bulk Assignment" button in calendar area
      3. Assert: button is visible without scrolling
      4. Assert: button has an icon
    Expected Result: Bulk Assignment easy to find
    Evidence: .sisyphus/evidence/task-26-bulk-assignment.png
  ```

  **Commit**: YES (groups with Wave 5)

- [x] 27. Build verification + lint + final polish

  **What to do**:
  - Run `pnpm build` and fix any build errors introduced by Waves 1-5.
  - Run `pnpm lint` and fix any new lint warnings.
  - Run `pnpm test` and ensure all existing tests still pass.
  - Fix any `type="button"` LSP warnings in App.tsx toolbar buttons (issues identified in diagnostics).
  - Do a final visual scan: ensure no leftover TODO comments, no console.log statements in production code, no commented-out code in changed files.
  - Verify all changed files have consistent formatting.

  **Must NOT do**:
  - Do NOT add new features
  - Do NOT refactor unrelated code
  - Do NOT modify test files unless fixing breakage

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and cleanup task
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (last task)
  - **Blocks**: F1-F4 (Final Verification)
  - **Blocked By**: ALL previous tasks (Waves 1-4 + Tasks 23-26)

  **References**:
  - `package.json` — Build, lint, test scripts
  - All files modified in Waves 1-5

  **Acceptance Criteria**:
  - `pnpm build` succeeds with 0 errors
  - `pnpm lint` passes with 0 new warnings
  - `pnpm test` passes (all existing tests)
  - No console.log in production code
  - No TODO/FIXME comments in changed files
  - All `type="button"` warnings resolved

  **QA Scenarios**:
  ```
  Scenario: Clean build and lint
    Tool: Bash
    Preconditions: All implementation tasks complete
    Steps:
      1. Run: pnpm build
      2. Assert: exit code 0, no errors
      3. Run: pnpm lint
      4. Assert: exit code 0, no new warnings
      5. Run: pnpm test
      6. Assert: all tests pass
    Expected Result: Clean build, lint, and test
    Evidence: .sisyphus/evidence/task-27-build-output.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `chore: final build verification and lint cleanup`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm build` + `pnpm lint`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `fix(ui): clean test data, fix duplicate import, default date to current week, empty state CTA, rename labels, add tooltips and legend`
- **Wave 2**: `fix(ux): defer onboarding, minimize copilot, delay PWA banner, restructure header toolbar, add user indicator, export labels`
- **Wave 3**: `feat(providers): show FTE values, collapse recovery rules, add provider avatars to cards and calendar`
- **Wave 4**: `style(ui): visual hierarchy, shift color coding, slot visual states, typography scale, coverage prominence`
- **Wave 5**: `feat(responsive): sidebar collapse, dark mode toggle, notification banners, discoverability improvements`

---

## Success Criteria

### Verification Commands
```bash
pnpm build          # Expected: Build succeeds with 0 errors
pnpm lint           # Expected: No new lint warnings
pnpm test           # Expected: All existing tests pass
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] No fake test names visible in UI
- [x] No raw UUIDs as emails
- [x] Calendar shows current week by default
- [x] Single Import button
- [x] Empty schedule has CTA
- [x] Onboarding is opt-in only
- [x] Copilot minimized by default
- [x] Header actions grouped logically
- [x] Provider cards show FTE numbers
- [x] Recovery rules not repeated
- [x] "Command" renamed to "Conflicts"
- [x] "No matches" has tooltip
- [x] Priority legend visible
