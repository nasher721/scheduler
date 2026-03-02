# Vibe Coding Prompt: Upgrade Calendar + Import Experience

You are a senior full-stack engineer working in an existing React + TypeScript scheduler app. Your mission is to make the **calendar workflow feel fast, obvious, and reliable**, and make **imports resilient and operator-friendly**.

## Product context
This is a neuro ICU scheduling product used by real operators under time pressure. They need:
- immediate understanding of staffing coverage and conflicts,
- predictable calendar interactions,
- highly reliable import flows from Excel,
- clear recovery steps when import data is imperfect.

## Core outcome
Improve both:
1. **Calendar function** (usability + data visibility + interaction quality)
2. **Import function** (validation + mapping + error handling + preview)

Maintain current architecture and coding conventions. Prefer focused incremental refactors over a full rewrite.

---

## Calendar improvement goals

### UX and interaction
- Improve month/week/day interaction clarity:
  - obvious selected date state,
  - sticky visual cues for today,
  - clearer shift chips/cards with better hierarchy (provider, role, shift time, status).
- Ensure drag/drop or assignment actions provide immediate feedback (hover, ghost state, valid/invalid drop cues).
- Add conflict badges or inline alerts on days with:
  - understaffing,
  - overstaffing,
  - rule violations,
  - unresolved assignments.

### Data visibility
- Surface **daily coverage summary** directly in calendar cells (e.g., `Coverage: 3/4`).
- Add a compact per-day “risk indicator” color system with accessible contrast.
- Provide quick peek details on hover/click (popover or expandable panel) without forcing route changes.

### Reliability/performance
- Reduce avoidable re-renders in calendar-heavy views.
- Guard against stale state when switching views/months quickly.
- Keep UI responsive with larger schedules.

### Accessibility
- Keyboard navigation between days.
- Semantic roles/labels for key controls.
- Color is not the only conflict indicator (icons/text fallback).

---

## Import improvement goals

### Input resilience
- Strengthen Excel import parsing and validation:
  - tolerate common header variants (`Name`, `Provider Name`, etc.),
  - trim whitespace and normalize casing,
  - detect duplicate or ambiguous columns.
- Add strict validation for required fields and date formats.
- Detect and report row-level issues with actionable messages.

### Mapping workflow
- Introduce a **column mapping step** when headers are missing or unexpected.
- Allow user confirmation before committing imported data.
- Provide a clear preview table:
  - parsed row count,
  - valid vs invalid rows,
  - warnings and errors grouped by type.

### Safety and recovery
- Do not overwrite existing schedule silently.
- Add “dry-run import” mode by default (preview before apply).
- Add rollback affordance for last import operation.

### Dev quality
- Add or update tests covering:
  - header normalization,
  - validation edge cases,
  - malformed dates,
  - duplicate provider entries,
  - partial import success behavior.

---

## Technical constraints
- Keep React + TypeScript patterns consistent with existing codebase.
- Avoid introducing heavy new dependencies unless clearly justified.
- Preserve existing API contracts unless a migration is documented.
- Prefer small composable utilities over monolithic functions.

---

## Deliverables
1. Updated calendar UI/logic with improved conflict and coverage visibility.
2. Improved import pipeline with preview + validation + mapping fallback.
3. Clear inline user feedback for success/warning/error states.
4. Test updates for new logic.
5. Short implementation notes in markdown:
   - what changed,
   - why,
   - known limitations,
   - next steps.

---

## Acceptance criteria
- Calendar clearly communicates daily staffing status at a glance.
- Import flow catches bad input before data mutation.
- Users can recover from import mistakes without manual data repair.
- No regression in existing scheduling behaviors.
- Core tests pass locally.

---

## Implementation strategy (order)
1. Audit current calendar and import components/utilities.
2. Add/strengthen typed domain models for import validation results.
3. Build import dry-run + preview + mapping UX.
4. Add conflict/coverage overlays in calendar cells.
5. Optimize rendering hotspots and state transitions.
6. Add/adjust tests and ship with brief implementation notes.

---

## Tone and quality bar
- Optimize for operator trust: **clear, deterministic, auditable behavior**.
- Favor explicitness over magic.
- Every error message should tell the user what to do next.
- Keep code readable for future iteration.
