# Schedule Readiness Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact schedule-view readiness banner and manual admin smoke checklist for the existing admin schedule screen.

**Architecture:** Keep the schedule screen as the primary workspace. Add a focused `AdminReadinessBanner` component that receives existing metrics and action handlers from `App.tsx`, plus a `useScheduleReadiness` hook for derived readiness data and a session-scoped checklist inside the banner.

**Tech Stack:** React 18, TypeScript, Zustand store, Tailwind utility classes, lucide-react icons, existing Vite/Vitest tooling.

---

## File Structure

- Create `src/components/schedule/useScheduleReadiness.ts`: derive coverage, critical gaps, skill risks, fatigue exposure, setup state, and overall severity from slots/providers/alerts/save status.
- Create `src/components/schedule/AdminReadinessBanner.tsx`: render metrics, action buttons, and the `QA Check` checklist modal.
- Modify `src/App.tsx`: import the hook/banner, compute readiness through the hook, and render the banner only when `viewMode === "schedule"`.

## Tasks

### Task 1: Add Readiness Derivation

**Files:**
- Create: `src/components/schedule/useScheduleReadiness.ts`

- [ ] Create exported types `ReadinessSaveStatus`, `ReadinessSeverity`, and `ScheduleReadiness`.
- [ ] Implement `useScheduleReadiness({ slots, providers, anomalyAlertCount, autoSaveStatus, isOnline })`.
- [ ] Compute assigned count, coverage percentage, critical unfilled shifts, skill mismatch count, fatigue exposure count, hasSetupData, and banner status text.

### Task 2: Add Admin Readiness Banner

**Files:**
- Create: `src/components/schedule/AdminReadinessBanner.tsx`

- [ ] Define props for readiness, action handlers, action disabled states, AI/staff active states, and optional busy state.
- [ ] Render compact metric chips for coverage, gaps, skill risk, fatigue, alerts, and sync.
- [ ] Render quick actions: Import, Rollback, Auto-Fill, Optimize, Save, Export hint, Alerts, AI, Staff, QA Check.
- [ ] Add `AdminSmokeChecklist` inside the same file with session state, pass/fail/needs-attention controls, note field, reset, and close.
- [ ] Keep the banner readable on mobile by allowing wrapping and using compact labels.

### Task 3: Wire Into App

**Files:**
- Modify: `src/App.tsx`

- [ ] Import `AdminReadinessBanner` and `useScheduleReadiness`.
- [ ] Replace duplicate inline readiness calculations where practical with values from the hook.
- [ ] Render the banner inside the schedule view, above the existing coverage status strip.
- [ ] Pass existing handlers into the banner: import trigger, rollback import, auto-fill, optimize, save, alert navigation, AI toggle, staff toggle.

### Task 4: Verify

**Files:**
- Verify: `src/components/schedule/AdminReadinessBanner.tsx`
- Verify: `src/components/schedule/useScheduleReadiness.ts`
- Verify: `src/App.tsx`

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] Fix any failures caused by the change.

## Self-Review

- Spec coverage: The plan implements a schedule-only readiness banner, quick actions through existing handlers, session smoke checklist, no backend persistence, and explicit degraded/offline/setup states.
- Placeholder scan: No placeholder implementation steps.
- Type consistency: Readiness types are defined in the hook and consumed by the banner.

