# Smart Neuro ICU Hub — Implementation Plan

**Generated:** 2026-03-30
**Design Spec:** `.specs/plans/smart-neuro-icu-hub.design.md`
**Stack:** React 18 + TypeScript + Vite 7 | Express backend | Zustand state | JSON file persistence

---

## Verified Assumptions

| Item | Decision |
|------|----------|
| Fatigue Metrics | Track `shiftsThisMonth` (days assigned count) and `consecutiveShiftsWorked` |
| Auto-Approval | Per-provider boolean toggle (`autoApproveClaims`) |
| Broadcast Channels | SMS, Email, Push only |
| Escalation Timing | 1 hour default, configurable by admin |
| Marketplace Filtering | All providers same skills → filter by **availability only** |
| Platform Priority | Mobile-first for providers, desktop also fully supported |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  My Shifts    │  │  Shift Board  │  │  Admin Command│  │
│  │  (Provider)   │  │  (Marketplace)│  │  Center       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                  │                   │          │
│  ┌──────┴──────────────────┴───────────────────┴──────┐  │
│  │              Zustand Store + API Client              │  │
│  │  (lifecycle state machine, broadcast slice)         │  │
│  └──────────────────────┬──────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────┘
                          │ fetch()
┌─────────────────────────┼────────────────────────────────┐
│                    Express API (port 4000)                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ /api/market-  │  │ /api/broadcast│  │ /api/market-  │  │
│  │ place/shifts  │  │ /dispatch     │  │ place/eligible│  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                  │                   │          │
│  ┌──────┴──────────────────┴───────────────────┴──────┐  │
│  │         JSON File Persistence (data/)               │  │
│  │  marketplace-shifts.json | broadcast-history.json   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Execution Waves & Dependency Graph

```
WAVE 1 (Foundation)     WAVE 2 (Backend)      WAVE 3 (Frontend Core)
┌───────────┐          ┌───────────┐         ┌────────────────┐
│ T1: Types  │─────────▶│ T4: Market│────────▶│ T6: Provider   │
│ T2: State  │─────────▶│    API    │         │    Profile UI   │
│   Machine  │          ├───────────┤         ├────────────────┤
│ T3: Broadcast│────────▶│ T5: Broad │────────▶│ T7: My Shifts  │
│   Slice     │          │    API    │         ├────────────────┤
└───────────┘          └───────────┘         │ T8: Shift Board│
                                                     └───────┬────────┘
WAVE 4 (Frontend Advanced)                           │
┌────────────────────────────────────────────────────┤
│ T9:  Claim Shift Flow                              │
│ T10: Admin Command Center                          │
│ T11: Live Escalation Tracker                       │
│ T12: Push Notification Integration                 │
└──────────────────────┬─────────────────────────────┘
                       │
WAVE 5 (Testing)       │
┌──────────────────────┴─────────────────────────────┐
│ T13: Integration Tests                              │
│ T14: E2E Tests                                      │
└─────────────────────────────────────────────────────┘
```

**Parallel execution within waves:**
- Wave 1: T1, T2, T3 run in parallel
- Wave 2: T4, T5 run in parallel
- Wave 3: T6, T7, T8 run in parallel
- Wave 4: T9, T10, T11, T12 run in parallel
- Wave 5: T13, T14 run in parallel

---

## Task Definitions

---

### T1: Data Model Extensions

**Category:** `quick`
**Skills:** `typescript-pro`
**Depends On:** None
**Files Modified:** `src/types.ts`

#### TDD Cycle
1. **RED:** Write tests in `src/__tests__/types/marketplace.types.test.ts`
   - Test: Provider type accepts `communicationPreferences` object
   - Test: Provider type accepts `fatigueMetrics` object
   - Test: Provider type accepts `autoApproveClaims` boolean
   - Test: `ShiftLifecycleStatus` type covers all 5 states
   - Test: `MarketplaceShift` type has required fields
2. **GREEN:** Implement types
3. **REFACTOR:** Clean up

#### Acceptance Criteria
- [ ] `Provider` type extended with:
  ```typescript
  communicationPreferences: {
    sms: boolean;
    email: boolean;
    push: boolean;
  };
  fatigueMetrics: {
    consecutiveShiftsWorked: number;
    shiftsThisMonth: number;
  };
  autoApproveClaims: boolean;
  ```
- [ ] New `ShiftLifecycleStatus` type: `'POSTED' | 'AI_EVALUATING' | 'BROADCASTING' | 'CLAIMED' | 'APPROVED'`
- [ ] New `MarketplaceShift` interface:
  ```typescript
  interface MarketplaceShift {
    id: string;
    slotId: string;
    postedByProviderId: string;
    date: string;
    shiftType: ShiftType;
    location: string;
    lifecycleState: ShiftLifecycleStatus;
    postedAt: string;
    claimedByProviderId: string | null;
    claimedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    broadcastRecipients: BroadcastRecipient[];
    notes: string;
  }
  ```
- [ ] New `BroadcastRecipient` interface:
  ```typescript
  interface BroadcastRecipient {
    providerId: string;
    channel: 'sms' | 'email' | 'push';
    sentAt: string | null;
    viewedAt: string | null;
    respondedAt: string | null;
  }
  ```
- [ ] New `EscalationConfig` interface:
  ```typescript
  interface EscalationConfig {
    autoEscalationDelayMinutes: number; // default 60
    maxEscalationTiers: number; // default 3
  }
  ```
- [ ] All types exported from `src/types.ts`
- [ ] `pnpm typecheck` passes

#### Atomic Commit
```
feat(marketplace): add data model types for provider profiles, shift lifecycle, and broadcast

- Extend Provider with communicationPreferences, fatigueMetrics, autoApproveClaims
- Add ShiftLifecycleStatus type (POSTED → AI_EVALUATING → BROADCASTING → CLAIMED → APPROVED)
- Add MarketplaceShift, BroadcastRecipient, EscalationConfig interfaces
- All types exported from src/types.ts
```

---

### T2: Shift Lifecycle State Machine

**Category:** `quick`
**Skills:** `typescript-pro`
**Depends On:** T1
**Files Modified:** `src/store.ts`

#### TDD Cycle
1. **RED:** Write tests in `src/__tests__/store/shift-lifecycle.test.ts`
   - Test: POSTED → AI_EVALUATING transition succeeds
   - Test: AI_EVALUATING → BROADCASTING transition succeeds
   - Test: BROADCASTING → CLAIMED transition succeeds
   - Test: CLAIMED → APPROVED transition succeeds
   - Test: POSTED → APPROVED (skip) fails
   - Test: APPROVED → POSTED (reverse) fails
   - Test: Transition creates audit log entry
   - Test: `postShiftForCoverage()` creates marketplace shift in POSTED state
   - Test: `transitionShiftLifecycle()` validates state
2. **GREEN:** Implement state machine in store
3. **REFACTOR:** Extract transition validator

#### Acceptance Criteria
- [ ] Valid transitions enforced:
  ```
  POSTED → AI_EVALUATING → BROADCASTING → CLAIMED → APPROVED
  ```
- [ ] Invalid transitions throw descriptive error
- [ ] New store actions:
  - `postShiftForCoverage(slotId, providerId, notes)` — creates MarketplaceShift in POSTED state
  - `transitionShiftLifecycle(shiftId, newState)` — validates and transitions
  - `cancelMarketplaceShift(shiftId)` — removes from marketplace (only POSTED/CLAIMED)
- [ ] Each transition creates an audit log entry
- [ ] MarketplaceShifts stored in new `marketplaceShifts: MarketplaceShift[]` state field
- [ ] `pnpm typecheck` passes
- [ ] Tests pass: `pnpm test`

#### Atomic Commit
```
feat(marketplace): implement shift lifecycle state machine in Zustand store

- Add valid transition map: POSTED → AI_EVALUATING → BROADCASTING → CLAIMED → APPROVED
- Add store actions: postShiftForCoverage, transitionShiftLifecycle, cancelMarketplaceShift
- Each transition generates an audit log entry
- Invalid transitions rejected with descriptive errors
```

---

### T3: Broadcast History Slice

**Category:** `quick`
**Skills:** `typescript-pro`
**Depends On:** T1, T2
**Files Modified:** `src/store.ts`

#### TDD Cycle
1. **RED:** Write tests in `src/__tests__/store/broadcast-slice.test.ts`
   - Test: `addBroadcastEntry()` creates entry with shift and recipients
   - Test: `updateBroadcastStatus()` updates recipient status
   - Test: `getBroadcastsForShift()` returns filtered list
   - Test: `getPendingEscalations()` returns broadcasts past escalation delay
   - Test: Escalation config defaults to 60 minutes
   - Test: Admin can update escalation config
2. **GREEN:** Implement broadcast slice
3. **REFACTOR:** Clean up

#### Acceptance Criteria
- [ ] New store state fields:
  ```typescript
  broadcastHistory: BroadcastHistoryEntry[];
  escalationConfig: EscalationConfig;
  ```
- [ ] New store actions:
  - `addBroadcastEntry(shiftId, recipients, channel)` — creates broadcast record
  - `updateBroadcastRecipientStatus(entryId, providerId, status)` — updates viewed/responded
  - `updateEscalationConfig(config)` — admin updates delay
  - `getBroadcastsForShift(shiftId)` — selector for shift broadcasts
  - `getPendingEscalations()` — selector for broadcasts needing escalation
- [ ] `BroadcastHistoryEntry` interface:
  ```typescript
  interface BroadcastHistoryEntry {
    id: string;
    marketplaceShiftId: string;
    tier: number;
    recipients: BroadcastRecipient[];
    sentAt: string;
    channel: 'sms' | 'email' | 'push';
    status: 'sent' | 'delivered' | 'failed';
  }
  ```
- [ ] Default escalation config: `{ autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 }`
- [ ] Tests pass: `pnpm test`

#### Atomic Commit
```
feat(marketplace): add broadcast history slice to Zustand store

- BroadcastHistoryEntry tracks per-recipient delivery status
- EscalationConfig with 60-minute default delay
- Store actions for creating, querying, and updating broadcast records
- Selector for pending escalations (past delay threshold)
```

---

### T4: Backend API — Marketplace Routes

**Category:** `unspecified-high`
**Skills:** `javascript-pro`
**Depends On:** T1, T2, T3
**Files Modified:** `server.js`, `data/marketplace-shifts.json` (new)

#### TDD Cycle
1. **RED:** Write tests in `server/__tests__/marketplace-routes.test.js`
   - Test: `POST /api/marketplace/shifts` creates marketplace shift
   - Test: `POST /api/marketplace/shifts` validates required fields
   - Test: `GET /api/marketplace/shifts` returns open shifts
   - Test: `GET /api/marketplace/shifts?status=POSTED` filters correctly
   - Test: `POST /api/marketplace/shifts/:id/claim` transitions to CLAIMED
   - Test: `POST /api/marketplace/shifts/:id/claim` rejects if not BROADCASTING state
   - Test: `GET /api/marketplace/eligible-providers/:shiftId` returns available providers
   - Test: `PATCH /api/marketplace/shifts/:id/approve` transitions to APPROVED
   - Test: `DELETE /api/marketplace/shifts/:id` cancels shift
2. **GREEN:** Implement routes
3. **REFACTOR:** Extract validation middleware

#### Acceptance Criteria
- [ ] `POST /api/marketplace/shifts` — Creates marketplace shift from slotId
  - Body: `{ slotId, postedByProviderId, notes }`
  - Returns: `{ marketplaceShift }` with POSTED state
  - Validates slot exists, provider exists
  - Persists to `data/marketplace-shifts.json`
- [ ] `GET /api/marketplace/shifts` — Lists marketplace shifts
  - Query params: `status`, `postedByProviderId`, `dateFrom`, `dateTo`
  - Returns: `{ shifts: MarketplaceShift[] }`
- [ ] `POST /api/marketplace/shifts/:id/claim` — Provider claims shift
  - Body: `{ providerId }`
  - Validates: shift is in BROADCASTING state, provider has availability (no time-off conflict)
  - Transitions to CLAIMED
- [ ] `GET /api/marketplace/eligible-providers/:shiftId` — Returns available providers for shift
  - Filters by: no time-off on shift date, not already assigned that day
  - Sorted by: fewest shifts this month (fairness)
- [ ] `PATCH /api/marketplace/shifts/:id/approve` — Admin approves
  - Body: `{ approvedBy }`
  - Transitions to APPROVED
  - Updates original slot assignment in schedule state
- [ ] `DELETE /api/marketplace/shifts/:id` — Cancel marketplace shift
  - Only allowed in POSTED or CLAIMED state
- [ ] JSON file persistence in `data/marketplace-shifts.json`
- [ ] Proper error responses: 400 for validation, 404 for not found, 409 for state conflict
- [ ] Tests pass

#### Atomic Commit
```
feat(marketplace): add backend API endpoints for shift marketplace

- POST /api/marketplace/shifts — create marketplace shift
- GET /api/marketplace/shifts — list with filters
- POST /api/marketplace/shifts/:id/claim — provider claims shift
- GET /api/marketplace/eligible-providers/:shiftId — AI-ranked eligible providers
- PATCH /api/marketplace/shifts/:id/approve — admin approves
- DELETE /api/marketplace/shifts/:id — cancel
- JSON persistence in data/marketplace-shifts.json
```

---

### T5: Backend API — Broadcast & Escalation

**Category:** `unspecified-high`
**Skills:** `javascript-pro`
**Depends On:** T3, T4
**Files Modified:** `server.js`, `data/broadcast-history.json` (new)

#### TDD Cycle
1. **RED:** Write tests in `server/__tests__/broadcast-routes.test.js`
   - Test: `POST /api/broadcast/dispatch` sends notifications to providers
   - Test: `POST /api/broadcast/dispatch` validates shift exists and is BROADCASTING
   - Test: `POST /api/broadcast/escalate/:shiftId` triggers next tier
   - Test: `GET /api/broadcast/history` returns filtered history
   - Test: `GET /api/broadcast/status/:shiftId` returns current broadcast state
   - Test: Auto-escalation skipped when max tiers reached
   - Test: Broadcast uses provider's communicationPreferences
2. **GREEN:** Implement routes and escalation service
3. **REFACTOR:** Extract escalation timer logic

#### Acceptance Criteria
- [ ] `POST /api/broadcast/dispatch` — Send targeted notifications
  - Body: `{ marketplaceShiftId, channel, providerIds[] }`
  - Uses each provider's `communicationPreferences` to determine channel
  - Falls back to email if preferred channel unavailable
  - Creates BroadcastHistoryEntry records
  - Persists to `data/broadcast-history.json`
- [ ] `POST /api/broadcast/escalate/:shiftId` — Trigger escalation
  - Checks current tier count
  - Sends to next eligible providers (excluding already contacted)
  - Increments tier
  - Returns 409 if max tiers reached
- [ ] `GET /api/broadcast/history` — Query history
  - Query params: `shiftId`, `tier`, `status`
  - Returns: `{ broadcasts: BroadcastHistoryEntry[] }`
- [ ] `GET /api/broadcast/status/:shiftId` — Current broadcast state
  - Returns: `{ shiftId, currentTier, broadcasts[], nextEscalationAt, canEscalate }`
- [ ] `GET /api/broadcast/escalation-config` — Get config
- [ ] `PATCH /api/broadcast/escalation-config` — Update config (admin only)
  - Body: `{ autoEscalationDelayMinutes, maxEscalationTiers }`
- [ ] `nextEscalationAt` calculated as: `lastBroadcast.sentAt + config.autoEscalationDelayMinutes`
- [ ] Tests pass

#### Atomic Commit
```
feat(marketplace): add broadcast dispatch and escalation API endpoints

- POST /api/broadcast/dispatch — send targeted notifications per provider prefs
- POST /api/broadcast/escalate/:shiftId — trigger next-tier escalation
- GET /api/broadcast/history — query broadcast history
- GET /api/broadcast/status/:shiftId — real-time broadcast state with countdown
- PATCH /api/broadcast/escalation-config — admin configures escalation timing
- JSON persistence in data/broadcast-history.json
```

---

### T6: Provider Profile Enhancements (UI)

**Category:** `visual-engineering`
**Skills:** `react-expert`, `typescript-pro`
**Depends On:** T1
**Files Created:** `src/components/marketplace/ProviderProfileSettings.tsx`

#### TDD Cycle
1. **RED:** Write tests in `src/__tests__/components/ProviderProfileSettings.test.tsx`
   - Test: Renders communication preference toggles
   - Test: Toggling SMS updates state
   - Test: Shows fatigue metrics (shiftsThisMonth, consecutiveShiftsWorked)
   - Test: Save button calls updateProvider
   - Test: Mobile layout renders correctly
2. **GREEN:** Implement component
3. **REFACTOR:** Extract preference toggles

#### Acceptance Criteria
- [ ] `ProviderProfileSettings` component with:
  - Communication preferences: SMS, Email, Push toggles
  - Auto-approve claims toggle (per-provider)
  - Fatigue metrics display: `shiftsThisMonth`, `consecutiveShiftsWorked`
  - Fatigue warning indicator when consecutive > threshold
- [ ] Integrated into existing provider profile/edit modal
- [ ] Mobile-responsive layout (stacked on mobile, grid on desktop)
- [ ] Saves via `updateProvider()` store action
- [ ] Follows existing Tailwind + CSS variables theme
- [ ] Uses existing form patterns from codebase

#### Atomic Commit
```
feat(marketplace): add provider profile settings for communication and fatigue

- Communication preferences toggles (SMS, Email, Push)
- Auto-approve claims per-provider toggle
- Fatigue metrics display (shiftsThisMonth, consecutiveShiftsWorked)
- Mobile-responsive layout integrated into existing profile modal
```

---

### T7: My Shifts Component

**Category:** `visual-engineering`
**Skills:** `react-expert`, `typescript-pro`
**Depends On:** T2, T4
**Files Created:** `src/components/marketplace/MyShifts.tsx`, `src/hooks/useMyShifts.ts`

#### TDD Cycle
1. **RED:** Write tests:
   - `src/__tests__/hooks/useMyShifts.test.ts` — hook returns current user's shifts
   - `src/__tests__/components/MyShifts.test.tsx` — renders shift list, swap button
2. **GREEN:** Implement
3. **REFACTOR:** Extract shift card component

#### Acceptance Criteria
- [ ] `useMyShifts` hook:
  - Returns `shifts: ShiftSlot[]` for current user
  - Returns `upcomingShifts` (future only, sorted by date)
  - Returns `postForCoverage(slotId, notes)` function
- [ ] `MyShifts` component:
  - List view of currentUser's upcoming assigned shifts
  - Each shift card shows: date (formatted), shift type, location, lifecycle state
  - "Request Coverage" button → calls `postShiftForCoverage()`
  - Calendar view toggle (using existing calendar patterns)
  - Empty state when no shifts assigned
- [ ] Mobile-optimized: cards stack vertically, touch-friendly buttons
- [ ] Desktop: side-by-side list + calendar view
- [ ] Uses Framer Motion for card animations (existing pattern)

#### Atomic Commit
```
feat(marketplace): add My Shifts component with coverage request action

- useMyShifts hook for current user's shift data
- MyShifts component with list/calendar toggle
- "Request Coverage" button posts shift to marketplace
- Mobile-first card layout
```

---

### T8: Shift Board (Marketplace)

**Category:** `visual-engineering`
**Skills:** `react-expert`, `typescript-pro`
**Depends On:** T2, T4, T5
**Files Created:** `src/components/marketplace/ShiftBoard.tsx`, `src/components/marketplace/ShiftBoardCard.tsx`, `src/hooks/useMarketplaceShifts.ts`

#### TDD Cycle
1. **RED:** Write tests:
   - `src/__tests__/hooks/useMarketplaceShifts.test.ts` — fetches open shifts, filters
   - `src/__tests__/components/ShiftBoard.test.tsx` — renders cards, filter controls
   - `src/__tests__/components/ShiftBoardCard.test.tsx` — renders shift info, claim button
2. **GREEN:** Implement
3. **REFACTOR:** Extract shared card styles

#### Acceptance Criteria
- [ ] `useMarketplaceShifts` hook:
  - Fetches from `GET /api/marketplace/shifts`
  - Filters by current user's availability (no time-off conflict)
  - Returns `eligibleShifts`, `isLoading`, `refetch()`
- [ ] `ShiftBoard` component:
  - Card-based feed of open marketplace shifts
  - Filter bar: date range picker, shift type dropdown, location dropdown
  - Cards sorted by: posted date (newest first), then priority
  - Empty state when no shifts available
  - Auto-refresh every 30 seconds
- [ ] `ShiftBoardCard` component:
  - Shows: date, shift type, location, posted by (name), time elapsed since posted
  - Shows: lifecycle state badge
  - Shows: "Claim Shift" button (only for BROADCASTING state)
  - Shows: number of broadcasts sent indicator
- [ ] Mobile: single-column card feed with pull-to-refresh
- [ ] Desktop: multi-column grid with filters sidebar

#### Atomic Commit
```
feat(marketplace): add Shift Board with AI-filtered open shifts feed

- useMarketplaceShifts hook with availability filtering
- ShiftBoard with filter bar and auto-refresh
- ShiftBoardCard with claim button and lifecycle state badges
- Mobile pull-to-refresh, desktop multi-column grid
```

---

### T9: Claim Shift Flow

**Category:** `visual-engineering`
**Skills:** `react-expert`, `typescript-pro`
**Depends On:** T4, T8
**Files Created:** `src/components/marketplace/ClaimShiftDialog.tsx`
**Files Modified:** `src/components/marketplace/ShiftBoardCard.tsx`

#### TDD Cycle
1. **RED:** Write tests:
   - `src/__tests__/components/ClaimShiftDialog.test.tsx` — renders confirmation, fatigue check
   - Test: Claim button triggers API call
   - Test: Optimistic update removes shift from board
   - Test: Error state shows toast and reverts
2. **GREEN:** Implement
3. **REFACTOR:** Extract confirmation dialog pattern

#### Acceptance Criteria
- [ ] `ClaimShiftDialog` component:
  - Shows shift details: date, type, location, who posted
  - Fatigue warning if `consecutiveShiftsWorked >= 3` or `shiftsThisMonth >= 15`
  - "Confirm Claim" and "Cancel" buttons
  - Loading state during API call
- [ ] Claim flow:
  1. User taps "Claim Shift" on ShiftBoardCard
  2. ClaimShiftDialog opens with shift details
  3. User confirms → `POST /api/marketplace/shifts/:id/claim`
  4. Optimistic: card removed from board immediately
  5. Success: toast "Shift claimed!"
  6. Error: toast error, card restored to board
- [ ] If provider has auto-approve enabled: skip admin approval, directly update slot
- [ ] If auto-approve disabled: show "Pending admin approval" state
- [ ] Mobile: full-screen dialog
- [ ] Desktop: centered modal overlay

#### Atomic Commit
```
feat(marketplace): add claim shift flow with fatigue check and optimistic updates

- ClaimShiftDialog with shift details and fatigue warning
- Optimistic UI update on claim (remove from board)
- Error rollback with toast notification
- Auto-approve path when provider has toggle enabled
```

---

### T10: Admin Command Center UI

**Category:** `visual-engineering`
**Skills:** `react-expert`, `typescript-pro`
**Depends On:** T5, T6
**Files Modified:** `src/components/CopilotPanel.tsx`
**Files Created:** `src/components/marketplace/AdminCommandCenter.tsx`, `src/components/marketplace/BroadcastControl.tsx`

#### TDD Cycle
1. **RED:** Write tests:
   - Test: Admin Command Center renders copilot drawer and broadcast controls
   - Test: Natural language query returns eligible providers
   - Test: 1-click broadcast sends to top 3 providers
2. **GREEN:** Implement
3. **REFACTOR:** Extract shared panel patterns

#### Acceptance Criteria
- [ ] `AdminCommandCenter` component:
  - Extends existing `CopilotPanel` with marketplace tab
  - Marketplace-aware queries: "Who can cover Dr. Smith tomorrow?"
  - Shows AI-ranked eligible providers list
- [ ] `BroadcastControl` component:
  - Shows AI recommendations (top 3 eligible providers)
  - "1-Click Broadcast" button → dispatches to all 3
  - Channel selector: uses each provider's preferred channel
  - Shows dispatch status in real-time
- [ ] Admin-only access (role check from store)
- [ ] Mobile: bottom sheet with tabs
- [ ] Desktop: right drawer panel (existing pattern)

#### Atomic Commit
```
feat(marketplace): add admin command center with AI copilot and 1-click broadcast

- AdminCommandCenter extends CopilotPanel with marketplace queries
- BroadcastControl with AI-ranked provider recommendations
- 1-click broadcast dispatches to top 3 eligible providers
- Admin role-gated access
```

---

### T11: Live Escalation Tracker

**Category:** `visual-engineering`
**Skills:** `react-expert`, `typescript-pro`
**Depends On:** T5, T10
**Files Created:** `src/components/marketplace/EscalationTracker.tsx`, `src/components/marketplace/BroadcastActivityItem.tsx`, `src/hooks/useBroadcastStatus.ts`

#### TDD Cycle
1. **RED:** Write tests:
   - `src/__tests__/hooks/useBroadcastStatus.test.ts` — polls broadcast status
   - `src/__tests__/components/EscalationTracker.test.tsx` — renders activity feed
   - Test: Countdown timer shows remaining time
   - Test: Manual escalation button triggers escalation
2. **GREEN:** Implement
3. **REFACTOR:** Extract timer hook

#### Acceptance Criteria
- [ ] `useBroadcastStatus` hook:
  - Polls `GET /api/broadcast/status/:shiftId` every 15 seconds
  - Returns: `{ broadcasts, currentTier, nextEscalationAt, canEscalate }`
  - Returns: `secondsUntilEscalation` computed from nextEscalationAt
- [ ] `EscalationTracker` component:
  - Activity feed showing: broadcast sent → provider viewed → response
  - Each entry: timestamp, provider name, channel, status badge
  - Countdown timer to auto-escalation (mm:ss format)
  - "Escalate Now" button (manual trigger)
  - Tier indicator: "Tier 1 of 3"
- [ ] `BroadcastActivityItem` component:
  - Shows per-recipient: name, channel icon, status (sent/viewed/responded)
  - Color-coded: pending (gray), sent (blue), viewed (amber), responded (green)
- [ ] Real-time feel: polling + optimistic UI
- [ ] Mobile: stacked feed
- [ ] Desktop: sidebar feed with compact view

#### Atomic Commit
```
feat(marketplace): add live escalation tracker with real-time activity feed

- useBroadcastStatus hook with 15s polling
- EscalationTracker with countdown timer and activity feed
- BroadcastActivityItem with per-recipient status indicators
- Manual "Escalate Now" button
```

---

### T12: Push Notification Integration

**Category:** `visual-engineering`
**Skills:** `react-expert`, `typescript-pro`
**Depends On:** T5, T8
**Files Modified:** `src/lib/pwa/pushNotifications.ts`, `src/lib/pwa/serviceWorker.ts`
**Files Created:** `src/components/marketplace/NotificationPermissionPrompt.tsx`

#### TDD Cycle
1. **RED:** Write tests:
   - Test: Push event handler extracts shiftId from payload
   - Test: Notification click navigates to Shift Board with shift highlighted
   - Test: Permission prompt renders correctly
2. **GREEN:** Implement
3. **REFACTOR:** Clean up service worker

#### Acceptance Criteria
- [ ] Update `src/lib/pwa/pushNotifications.ts`:
  - New `sendMarketplaceNotification(providerId, shiftId, type)` function
  - Types: 'SHIFT_AVAILABLE', 'SHIFT_CLAIMED', 'SHIFT_APPROVED', 'ESCALATION'
  - Push payload includes: `{ shiftId, type, deepLink: '/marketplace?shift=<id>' }`
- [ ] Update service worker push handler:
  - Shows notification with shift details
  - Click action: opens app at `/marketplace?shift=<shiftId>`
  - Shift Board auto-scrolls to highlighted shift
- [ ] `NotificationPermissionPrompt` component:
  - Shows in marketplace settings
  - Request push permission with clear explanation
  - Shows current permission state
- [ ] Fallback: if push not supported, log notification in-app only
- [ ] Test with existing PWA infrastructure

#### Atomic Commit
```
feat(marketplace): add push notifications with deep linking to Shift Board

- Marketplace notification types: SHIFT_AVAILABLE, CLAIMED, APPROVED, ESCALATION
- Service worker push handler with deep link to /marketplace?shift=<id>
- NotificationPermissionPrompt in marketplace settings
- Graceful fallback when push not supported
```

---

### T13: Integration Tests

**Category:** `quick`
**Skills:** `test-master`, `typescript-pro`
**Depends On:** T4, T5, T7, T8, T9
**Files Created:** `src/__tests__/integration/marketplace-flow.test.ts`

#### TDD Cycle
These tests verify end-to-end flows combining multiple units.

#### Acceptance Criteria
- [ ] **Post and Claim Flow:**
  - Provider A posts shift for coverage
  - AI evaluates and transitions to AI_EVALUATING
  - System broadcasts to eligible providers
  - Provider B claims the shift
  - Admin approves (or auto-approve triggers)
  - Slot assignment updated in schedule
- [ ] **Escalation Flow:**
  - Broadcast sent to Tier 1 providers
  - No response after configured delay
  - Auto-escalation triggers Tier 2
  - Status reflects escalation
- [ ] **Validation Flow:**
  - Cannot claim shift with time-off conflict
  - Cannot transition invalid lifecycle states
  - Cannot approve already-approved shift
- [ ] **Provider Filtering:**
  - Only available providers shown
  - Sorted by fewest shifts this month
- [ ] Coverage threshold met: 70% on new marketplace code

#### Atomic Commit
```
test(marketplace): add integration tests for marketplace and broadcast flows

- Post → evaluate → broadcast → claim → approve full flow
- Escalation tier progression with auto-trigger
- Validation edge cases (time-off, state conflicts)
- Provider availability filtering and fairness sorting
```

---

### T14: E2E Tests

**Category:** `unspecified-high`
**Skills:** `playwright-expert`
**Depends On:** T7, T8, T9, T10, T11, T12
**Files Created:** `e2e/marketplace.spec.ts`

#### TDD Cycle
Full user journey tests via Playwright.

#### Acceptance Criteria
- [ ] **Provider Journey (Mobile Viewport):**
  1. Login as provider
  2. Navigate to "My Shifts"
  3. Request coverage for a shift
  4. Verify shift appears in marketplace
  5. Login as different provider
  6. Navigate to Shift Board
  7. See the posted shift
  8. Claim the shift
  9. Verify confirmation toast
- [ ] **Admin Journey (Desktop Viewport):**
  1. Login as admin
  2. Open Command Center
  3. Query: "Who can cover Dr. Adams on 2026-04-15?"
  4. See AI recommendations
  5. Click "1-Click Broadcast"
  6. See escalation tracker update
  7. Verify broadcast status shows sent
- [ ] **Escalation Journey:**
  1. Post shift for coverage
  2. Broadcast to providers
  3. Wait for escalation timeout (mocked)
  4. Verify auto-escalation triggers
  5. Verify next tier providers notified
- [ ] Tests run against: Chromium (mobile + desktop), WebKit (mobile)
- [ ] All tests pass: `pnpm test:e2e`

#### Atomic Commit
```
test(marketplace): add E2E tests for provider and admin marketplace journeys

- Provider: login → my shifts → request coverage → claim shift
- Admin: login → command center → AI query → 1-click broadcast → tracker
- Escalation: post → broadcast → timeout → auto-escalate
- Chromium (mobile + desktop), WebKit (mobile)
```

---

## Commit Sequence Summary

| # | Commit Message | Wave | Files Changed (approx) |
|---|----------------|------|----------------------|
| 1 | `feat(marketplace): add data model types for provider profiles, shift lifecycle, and broadcast` | 1 | `src/types.ts` + test |
| 2 | `feat(marketplace): implement shift lifecycle state machine in Zustand store` | 1 | `src/store.ts` + test |
| 3 | `feat(marketplace): add broadcast history slice to Zustand store` | 1 | `src/store.ts` + test |
| 4 | `feat(marketplace): add backend API endpoints for shift marketplace` | 2 | `server.js`, `data/marketplace-shifts.json` + test |
| 5 | `feat(marketplace): add broadcast dispatch and escalation API endpoints` | 2 | `server.js`, `data/broadcast-history.json` + test |
| 6 | `feat(marketplace): add provider profile settings for communication and fatigue` | 3 | `src/components/marketplace/ProviderProfileSettings.tsx` + test |
| 7 | `feat(marketplace): add My Shifts component with coverage request action` | 3 | `src/components/marketplace/MyShifts.tsx`, `src/hooks/useMyShifts.ts` + tests |
| 8 | `feat(marketplace): add Shift Board with AI-filtered open shifts feed` | 3 | `src/components/marketplace/ShiftBoard.tsx` + related + tests |
| 9 | `feat(marketplace): add claim shift flow with fatigue check and optimistic updates` | 4 | `src/components/marketplace/ClaimShiftDialog.tsx` + test |
| 10 | `feat(marketplace): add admin command center with AI copilot and 1-click broadcast` | 4 | `src/components/marketplace/AdminCommandCenter.tsx` + related |
| 11 | `feat(marketplace): add live escalation tracker with real-time activity feed` | 4 | `src/components/marketplace/EscalationTracker.tsx` + related + tests |
| 12 | `feat(marketplace): add push notifications with deep linking to Shift Board` | 4 | `src/lib/pwa/*.ts` + related |
| 13 | `test(marketplace): add integration tests for marketplace and broadcast flows` | 5 | `src/__tests__/integration/` |
| 14 | `test(marketplace): add E2E tests for provider and admin marketplace journeys` | 5 | `e2e/marketplace.spec.ts` |

---

## Verification Checklist

After each wave, run:

```bash
pnpm typecheck     # TypeScript compiles
pnpm lint          # ESLint passes
pnpm test          # Vitest passes
pnpm build         # Production build succeeds
```

After all waves:

```bash
pnpm test:e2e      # Playwright E2E passes
pnpm dev:fullstack  # Manual smoke test
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Store.ts grows too large | Keep marketplace state in separate slice, compose in store |
| Broadcast polling overhead | 15s polling is reasonable; WebSocket upgrade can follow later |
| Mobile performance | Lazy-load marketplace components with React.lazy |
| JSON file contention | Marketplace JSON files separate from main schedule-state.json |
| Existing features break | Each wave validates against full test suite before proceeding |

---

## Estimated Effort

| Wave | Tasks | Est. Time (parallel execution) |
|------|-------|-------------------------------|
| Wave 1 | T1, T2, T3 | 1 session |
| Wave 2 | T4, T5 | 1 session |
| Wave 3 | T6, T7, T8 | 1-2 sessions |
| Wave 4 | T9, T10, T11, T12 | 1-2 sessions |
| Wave 5 | T13, T14 | 1 session |
| **Total** | **14 tasks** | **5-7 sessions** |
