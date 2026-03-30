# Decomposition: Smart Neuro ICU Hub Implementation

**Generated:** 2026-03-30
**Task:** implement-smart-neuro-icu-hub.feature.md
**Hex ID:** 69cab2bd

---

## Implementation Summary

| Category | Count | Files |
|----------|-------|-------|
| New Frontend Components | 13 | SmartHub, MyShifts, ShiftBoard, ShiftCard, MarketplaceFilters, ClaimConfirmationModal, BroadcastPanel, EscalationTracker, BroadcastHistoryList, CopilotChatDrawer, CopilotQueryResult, ProviderProfileEditor, FatigueIndicator |
| New Custom Hooks | 3 | useFatigueCheck, useBroadcast, useMarketplace |
| New API Client Modules | 3 | marketplace.ts, broadcast.ts, copilot.ts |
| Existing Files Modified | 6 | store.ts, types.ts, server.js, App.tsx, hooks/index.ts, lib/api/index.ts |
| Backend Routes | 10 | GET/POST /api/marketplace/shifts, POST claim/approve/cancel, GET /api/marketplace/my-shifts, POST /api/broadcast/dispatch, GET /api/broadcast/history, POST /api/broadcast/escalate, POST /api/copilot/query |

---

## Phase 1: Foundation (Types, Store, API Clients)

### Step 1.1: Extend Types (src/types.ts)
**Goal:** Add marketplace, broadcast, and copilot types needed for the feature

**Concrete Output:**
- `MarketplaceFilters` interface
- `ProviderMatch` interface  
- `BroadcastDispatchRequest` interface

**Success Criteria:**
- Types compile without errors
- No TypeScript strict mode violations

**Blockers/Risks:**
- None - pure type additions

**Subtasks:**
- [ ] Add MarketplaceFilters interface
- [ ] Add ProviderMatch interface
- [ ] Add BroadcastDispatchRequest interface

---

### Step 1.2: Extend Zustand Store (src/store.ts)
**Goal:** Add marketplace actions and fatigue middleware

**Concrete Output:**
- `claimShift()` function
- `approveShift()` function  
- Fatigue calculation on provider updates

**Success Criteria:**
- Store actions work with existing state
- Fatigue metrics update correctly on schedule changes

**Blockers/Risks:**
- None - extends existing marketplaceShifts state

**Subtasks:**
- [ ] Add claimShift(shiftId, providerId) action
- [ ] Add approveShift(shiftId, approvedBy) action
- [ ] Add fatigue calculation middleware

---

### Step 1.3: Create API Client Modules
**Goal:** Create wrapper functions for new backend endpoints

**Concrete Output:**
- `src/lib/api/marketplace.ts` - 6 functions
- `src/lib/api/broadcast.ts` - 3 functions
- `src/lib/api/copilot.ts` - 1 function

**Success Criteria:**
- All API calls return typed responses
- Error handling matches existing patterns

**Blockers/Risks:**
- Depends on Step 1.1 (types must exist)

**Subtasks:**
- [ ] Create src/lib/api/marketplace.ts with getMarketplaceShifts, postShiftForCoverage, claimMarketplaceShift, approveMarketplaceShift, cancelMarketplaceShift, getMyShifts
- [ ] Create src/lib/api/broadcast.ts with dispatchBroadcast, getBroadcastHistory, triggerEscalation
- [ ] Create src/lib/api/copilot.ts with queryCopilotCoverage

---

## Phase 2: Backend Routes (server.js)

### Step 2.1: Marketplace Routes
**Goal:** Implement marketplace shift CRUD and state transitions

**Concrete Output:**
- GET /api/marketplace/shifts
- POST /api/marketplace/shifts
- POST /api/marketplace/shifts/:id/claim
- POST /api/marketplace/shifts/:id/approve
- POST /api/marketplace/shifts/:id/cancel
- GET /api/marketplace/my-shifts

**Success Criteria:**
- All routes return correct status codes
- State machine transitions enforce valid paths
- JSON file persistence works

**Blockers/Risks:**
- None - new routes, no conflicts

**Subtasks:**
- [ ] Implement GET /api/marketplace/shifts with filtering
- [ ] Implement POST /api/marketplace/shifts (create)
- [ ] Implement POST /api/marketplace/shifts/:id/claim
- [ ] Implement POST /api/marketplace/shifts/:id/approve
- [ ] Implement POST /api/marketplace/shifts/:id/cancel
- [ ] Implement GET /api/marketplace/my-shifts

---

### Step 2.2: Broadcast Routes
**Goal:** Implement notification dispatch and escalation

**Concrete Output:**
- POST /api/broadcast/dispatch
- GET /api/broadcast/history
- POST /api/broadcast/escalate/:shiftId

**Success Criteria:**
- Broadcast respects communication preferences
- Auto-escalation works with server-side timestamps

**Blockers/Risks:**
- Depends on notification webhook infrastructure

**Subtasks:**
- [ ] Implement POST /api/broadcast/dispatch
- [ ] Implement GET /api/broadcast/history
- [ ] Implement POST /api/broadcast/escalate/:shiftId

---

### Step 2.3: Copilot Query Route
**Goal:** Implement natural language query processing

**Concrete Output:**
- POST /api/copilot/query

**Success Criteria:**
- Query parses provider name and date correctly
- Returns top 3 providers sorted by fairness score
- Response time < 2 seconds

**Blockers/Risks:**
- None - new endpoint

**Subtasks:**
- [ ] Implement POST /api/copilot/query with pattern-based NLP
- [ ] Add fatigue-adjusted fairness scoring

---

## Phase 3: Frontend Components - Marketplace

### Step 3.1: Core Marketplace Components
**Goal:** Create main marketplace UI components

**Concrete Output:**
- SmartHub.tsx - Main entry point
- MyShifts.tsx - Provider's assigned shifts
- ShiftBoard.tsx - Open shifts for claiming
- ShiftCard.tsx - Individual shift display

**Success Criteria:**
- Components render without errors
- Responsive layout works (mobile/desktop)

**Blockers/Risks:**
- Depends on Step 1.3 (API clients)

**Subtasks:**
- [ ] Create src/components/SmartHub.tsx
- [ ] Create src/components/marketplace/MyShifts.tsx
- [ ] Create src/components/marketplace/ShiftBoard.tsx
- [ ] Create src/components/marketplace/ShiftCard.tsx

---

### Step 3.2: Marketplace UI Enhancements
**Goal:** Create filter and confirmation components

**Concrete Output:**
- MarketplaceFilters.tsx
- ClaimConfirmationModal.tsx

**Success Criteria:**
- Filters work correctly on Shift Board
- Confirmation modal prevents accidental claims

**Blockers/Risks:**
- None

**Subtasks:**
- [ ] Create src/components/marketplace/MarketplaceFilters.tsx
- [ ] Create src/components/marketplace/ClaimConfirmationModal.tsx

---

## Phase 4: Frontend Components - Broadcast

### Step 4.1: Broadcast Panel Components
**Goal:** Create admin broadcast controls and tracking

**Concrete Output:**
- BroadcastPanel.tsx - Admin controls
- EscalationTracker.tsx - Live status
- BroadcastHistoryList.tsx - History display

**Success Criteria:**
- 1-click broadcast works
- Escalation status displays correctly

**Blockers/Risks:**
- Depends on Step 2.2 (backend routes)

**Subtasks:**
- [ ] Create src/components/broadcast/BroadcastPanel.tsx
- [ ] Create src/components/broadcast/EscalationTracker.tsx
- [ ] Create src/components/broadcast/BroadcastHistoryList.tsx

---

## Phase 5: Frontend Components - Copilot

### Step 5.1: Copilot Chat Components
**Goal:** Create AI Copilot natural language interface

**Concrete Output:**
- CopilotChatDrawer.tsx - NLP interface drawer
- CopilotQueryResult.tsx - Results display

**Success Criteria:**
- Natural language queries parse correctly
- Results display ranked providers

**Blockers/Risks:**
- Depends on Step 2.3 (backend route)

**Subtasks:**
- [ ] Create src/components/copilot/CopilotChatDrawer.tsx
- [ ] Create src/components/copilot/CopilotQueryResult.tsx

---

## Phase 6: Frontend Components - Profiles

### Step 6.1: Profile Editor Components
**Goal:** Create enhanced provider profile components

**Concrete Output:**
- ProviderProfileEditor.tsx - Profile with fatigue/preferences
- FatigueIndicator.tsx - Visual fatigue warning

**Success Criteria:**
- Communication preferences save correctly
- Fatigue warnings display at >= 3 consecutive shifts

**Blockers/Risks:**
- None

**Subtasks:**
- [ ] Create src/components/profiles/ProviderProfileEditor.tsx
- [ ] Create src/components/profiles/FatigueIndicator.tsx

---

## Phase 7: Integration

### Step 7.1: Hooks and API Exports
**Goal:** Export new hooks and API functions

**Concrete Output:**
- src/hooks/index.ts updated
- src/lib/api/index.ts updated

**Success Criteria:**
- All new hooks importable
- All new API functions importable

**Blockers/Risks:**
- Depends on Phase 1-6 completion

**Subtasks:**
- [ ] Export useFatigueCheck, useBroadcast, useMarketplace from hooks/index.ts
- [ ] Export API functions from lib/api/index.ts

---

### Step 7.2: App Integration
**Goal:** Add SmartHub to main app routing

**Concrete Output:**
- SmartHub accessible via navigation

**Success Criteria:**
- Navigation works without errors

**Blockers/Risks:**
- None

**Subtasks:**
- [ ] Add routing/tab for SmartHub in App.tsx

---

## Phase 8: Testing & Verification

### Step 8.1: Unit Tests
**Goal:** Write tests for new functionality

**Concrete Output:**
- Tests for store actions
- Tests for API clients
- Tests for utility functions

**Success Criteria:**
- `pnpm test` passes

**Blockers/Risks:**
- Depends on all implementation

---

### Step 8.2: TypeScript & Build
**Goal:** Verify code compiles and builds

**Concrete Output:**
- Clean TypeScript compilation
- Successful production build

**Success Criteria:**
- `pnpm typecheck` passes
- `pnpm build` succeeds

**Blockers/Risks:**
- Depends on all implementation

---

### Step 8.3: E2E Tests
**Goal:** Verify end-to-end flows work

**Concrete Output:**
- E2E tests for marketplace flows
- E2E tests for broadcast flows

**Success Criteria:**
- `pnpm test:e2e` passes

**Blockers/Risks:**
- Depends on all implementation

---

## Dependency Graph

```
Phase 1 (Foundation)
├── 1.1 Types ──────────┐
├── 1.2 Store ─────────┼──► Phase 7.1 (Exports)
└── 1.3 API Clients ───┘         │
                                ▼
Phase 2 (Backend)         Phase 3 (Marketplace UI)
├── 2.1 Marketplace ────► ├── 3.1 Core Components
├── 2.2 Broadcast ───────► └── 3.2 UI Enhancements
└── 2.3 Copilot ────────► Phase 5 (Copilot UI)
                                │
Phase 4 (Broadcast UI) ◄────────┘
Phase 6 (Profile UI) ◄───────────┘
                                ▼
                      Phase 7.2 (App Integration)
                                │
                                ▼
                      Phase 8 (Testing & Verification)
```

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Notification service timeout | High | Medium | Add retry logic with exponential backoff |
| Auto-escalation timer drift | Medium | Medium | Use server-side timestamps |
| JSON file concurrency | Medium | Low | Add file locking |
| State machine race conditions | High | Low | Add optimistic locking with version field |
| Mobile responsive issues | Low | Medium | Enforce 44px minimum tap targets |

---

## Definition of Done

- [ ] All 19 new frontend components created
- [ ] All 3 new hooks created and exported
- [ ] All 3 new API client modules created and exported
- [ ] All 6 existing files modified
- [ ] All 10 backend routes implemented
- [ ] AI Copilot query response time < 2 seconds
- [ ] Marketplace shift list loads < 1 second
- [ ] Broadcast dispatch completes < 500ms
- [ ] Mobile-first design with 44px minimum tap targets
- [ ] WCAG 2.1 AA compliance on new components
- [ ] Shift lifecycle state machine enforces valid transitions only
- [ ] Auto-escalation works with 60-minute default, max 3 tiers
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm test:e2e` passes

---

## Implementation Order (Critical Path)

1. **Step 1.1** - Extend Types (prerequisite for all)
2. **Step 1.2** - Extend Store (prerequisite for UI)
3. **Step 1.3** - Create API Clients (prerequisite for UI)
4. **Step 2.1** - Marketplace Routes (backend first)
5. **Step 2.2** - Broadcast Routes
6. **Step 2.3** - Copilot Route
7. **Step 3.1** - Core Marketplace Components
8. **Step 4.1** - Broadcast Panel Components
9. **Step 5.1** - Copilot Chat Components
10. **Step 6.1** - Profile Components
11. **Step 7.1** - Exports
12. **Step 7.2** - App Integration
13. **Step 8.x** - Testing & Verification
