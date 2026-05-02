# Competitive Features Plan

**Created:** 2026-04-13
**Agent:** atlas
**Status:** IN PROGRESS

---

## Overview

Three high-probability competitive features to differentiate the NICU Scheduler:
1. One-Click Smart Schedule Generation
2. Real-Time Staff Availability Dashboard
3. Mobile-First Shift Trading

Source: `docs/implementation-plan-ideas.md`

---

## TODOs

### Idea 1: One-Click Smart Schedule Generation

- [x] **Task 1.1A**: Create `AutoScheduleButton.tsx` component — single-click trigger with loading state, progress indicator, disabled state when no providers. Location: `src/components/AutoScheduleButton.tsx`
- [x] **Task 1.1B**: Integrate AutoScheduleButton into main schedule view — add to Calendar toolbar near existing "Auto Assign" action. Location: `src/App.tsx`
- [x] **Task 1.2A**: Wire AutoScheduleButton to `/api/ai/optimize` endpoint — use existing `multiAgentOptimize()` from `src/lib/api/multiAgentOptimize.ts`, build preview with `buildOptimizationPreview()`
- [x] **Task 1.2B**: Create optimization result handler — handle apply via `applyOptimizationResult()`, support rollback via `/api/ai/rollback`, show success/failure feedback

### Idea 2: Real-Time Staff Availability Dashboard

- [x] **Task 2.1A**: Define provider status enum in types — `AVAILABLE | ON_SHIFT | ON_LEAVE | ON_CALL | UNAVAILABLE`, auto-computed from today's assignments. Location: `src/types/index.ts`
- [x] **Task 2.2A**: Enhance `ProviderAvailabilityPanel.tsx` with dashboard view — grid/list toggle, filter by status, search, color-coded status dots. Location: `src/components/ProviderAvailabilityPanel.tsx`
- [x] **Task 2.2B**: Add availability panel to main layout — collapsible panel in App.tsx sidebar, visibility persisted to localStorage
- [x] **Task 2.3A**: Create `CoverageSummary.tsx` widget — positions filled vs required, critical gaps highlighted, updates on schedule changes. Location: `src/components/CoverageSummary.tsx`

### Idea 3: Mobile-First Shift Trading

- [x] **Task 3.1A**: Responsive marketplace layout — full-width cards on mobile, touch-friendly buttons (min 44px), preserve desktop grid. Location: `src/components/marketplace/`
- [x] **Task 3.2A**: Create `QuickSwapModal.tsx` — select my shift → one tap to post → auto-suggest matches → "Post for Coverage" confirmation. Location: `src/components/marketplace/QuickSwapModal.tsx`
- [x] **Task 3.3A**: Integrate push notifications — use existing `src/lib/pwa/pushNotifications.ts` hook, triggers for swap received/approved/reminder. Location: `src/hooks/useSwapNotifications.ts`
- [x] **Task 3.4A**: Swipe-to-approve for managers — mobile swipe left approve/right reject in ShiftSwapBoard. Location: `src/components/ShiftSwapBoard.tsx`

---

## Final Verification Wave

- [x] **F1**: Plan Compliance Audit — verify all tasks implemented per spec
- [x] **F2**: Build + TypeCheck + Lint — `pnpm build && pnpm lint` pass
- [x] **F3**: Unit Tests — `pnpm test` passes, coverage maintained
- [x] **F4**: Visual/UX Review — browser verification of all three features

---

## Key Files (Reference)

### Existing Infrastructure (DO NOT recreate)
- `src/store.ts` — Zustand store with `autoAssign()`, marketplace CRUD, swap requests
- `src/lib/api/multiAgentOptimize.ts` — `multiAgentOptimize()`, `buildOptimizationPreview()`, `applyOptimizationResult()`
- `src/lib/api/scheduleApi.ts` — `fetchScheduleSummary()`, `fetchLastOptimizationResult()`
- `src/lib/pwa/pushNotifications.ts` — Full push notification hook (288 lines)
- `src/lib/pwa/offlineMode.ts` — Offline mode support
- `src/components/ProviderAvailabilityPanel.tsx` — 401-line availability panel
- `src/components/marketplace/ShiftBoard.tsx` — Marketplace with filtering/search/claim
- `server.js` — Backend with `/api/ai/optimize`, `/api/ai/apply`, `/api/ai/rollback`, `/api/marketplace/*`

### New Files to Create
- `src/components/AutoScheduleButton.tsx`
- `src/components/CoverageSummary.tsx`
- `src/components/marketplace/QuickSwapModal.tsx`
- `src/hooks/usePushNotifications.ts`

### Files to Modify
- `src/types/index.ts` — Add ProviderStatus enum
- `src/App.tsx` — Integrate new components into layout
- `src/components/ProviderAvailabilityPanel.tsx` — Dashboard enhancements
- `src/components/ShiftSwapBoard.tsx` — Swipe-to-approve
- `src/components/marketplace/ShiftBoard.tsx` — Responsive layout

## Constraints
- Use existing Zustand store for all new state
- Persist panel visibility to localStorage
- Provider status computed dynamically from assignments
- Reuse existing `/api/ai/optimize` endpoint
- Lazy-load availability panel
- Virtualize provider list for 100+ providers
- Mobile: Complete swap flow in < 3 taps
- Do NOT remove any existing functionality
