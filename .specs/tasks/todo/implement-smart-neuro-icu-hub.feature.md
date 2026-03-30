---
title: Implement Smart Neuro ICU Hub with AI Copilot, Broadcast, and Marketplace
decomposition: .specs/scratchpad/decomposition-69cab2bd.md
---

## Initial User Prompt

Based on the design document at .specs/plans/smart-neuro-icu-hub.design.md, please create the implementation draft task for the "Smart Neuro ICU Hub" featuring the AI Copilot, Broadcast service, and Provider Marketplace.

# Description

The Smart Neuro ICU Hub is a comprehensive scheduling ecosystem that combines AI-powered assistance, multi-channel notifications, and a self-service marketplace to automate neurointensivist shift coverage.

**What is being built:** Five integrated features:
1. AI Copilot natural language interface for scheduling queries
2. Broadcast notification service (SMS/Email/Push) with auto-escalation
3. Provider Marketplace with responsive mobile/desktop views
4. Enhanced provider profiles with fatigue metrics
5. Shift lifecycle state machine enforcing valid transitions

**Why this is needed:** Manual scheduling coordination is time-consuming, error-prone, and often results in coverage gaps. Providers need self-service tools, schedulers need AI assistance, and the hospital needs automated escalation to prevent uncovered shifts.

**Who will use/benefit:**
- Neurointensivists: Self-service shift trading, notification preferences
- Schedulers/Admins: AI recommendations, 1-click broadcast, live tracking
- Hospital: Reduced uncovered shifts, fatigue compliance

**Key constraints:**
- Mobile-first design required
- Must integrate with existing React/TypeScript/Vite + Express/JSON stack
- Must respect provider communication preferences
- JSON file persistence (no database changes)

**Scope**:
- Included:
  - AI Copilot natural language queries ("Who can cover Dr. Smith tomorrow?")
  - Broadcast notification service with auto-escalation (60 min default)
  - Provider Marketplace (My Shifts + Shift Board views)
  - Enhanced provider profiles (fatigue metrics + communication preferences)
  - Shift lifecycle state machine (POSTED → AI_EVALUATING → BROADCASTING → CLAIMED → APPROVED)
- Excluded:
  - WebSocket real-time updates (future phase)
  - External calendar integrations
  - Subspecialty-based filtering (explicitly excluded per design)
  - Payment/billing features

**User Scenarios**:
1. **Primary Flow**: Provider posts shift → AI evaluates → Broadcast notifies → Provider claims → Approved
2. **Escalation Flow**: No response after 60 mins → Auto-escalate to next tier (max 3 tiers)
3. **Error Handling**: Invalid state transitions rejected, fatigue warnings shown but overridable

---

## Architecture Overview

### References

This implementation builds on prior research and analysis:
- **Analysis Document**: `.specs/analysis/analysis-smart-neuro-icu-hub.md` — Detailed file inventory, type signatures, integration points, and risk assessment from design phase

### Solution Strategy

The Smart Neuro ICU Hub combines three core systems into a unified scheduling ecosystem:

- **AI Copilot**: Natural language query processing using pattern-based NLP with deterministic fallback. Parses queries like "Who can cover Dr. Smith tomorrow?" to extract provider names and dates, then returns top 3 eligible providers sorted by fatigue-adjusted fairness score.
- **Broadcast Service**: Multi-channel notifications (SMS/Email/Push) with tiered auto-escalation. Uses existing webhook infrastructure, respects provider communication preferences, auto-escalates every 60 minutes (configurable) up to 3 tiers.
- **Provider Marketplace**: Self-service shift claiming with two views: My Shifts (provider's assigned shifts) and Shift Board (open shifts). Mobile-first responsive design with 44px minimum tap targets.

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Extend existing Zustand store | Avoids new state management; `marketplaceShifts[]` and `broadcastHistory[]` already exist |
| Pattern-based NLP (no LLM) | Deterministic fallback, <2s response time, no external API dependency |
| Webhook-based notifications | Leverages existing `NOTIFY_*_WEBHOOK_URL` env vars; SMS/Email/Push unified |
| Server-side escalation timestamps | Prevents drift in background tabs; validated on each request |
| JSON file persistence | No database changes; `data/marketplace-shifts.json`, `data/broadcast-history.json` |

### Trade-offs

| Decision | Trade-off |
|----------|-----------|
| **Pattern-based NLP (no LLM)** | Traded AI sophistication for deterministic reliability, <2s response time, and zero external API dependency |
| **JSON file persistence** | Traded relational data integrity for simplicity — no transactions, potential race conditions on concurrent writes require file locking |
| **Server-side escalation timestamps** | Traded client-side simplicity for consistency across devices/tabs, but requires API calls to check status |
| **Mobile-first responsive** | Tracked development time for touch-optimized UI, but ensures accessibility compliance |
| **Zustand store extension** | Traded clean separation for faster integration — marketplace state coexists with existing schedule state |
| **Auto-approve toggle per provider** | Traded automation speed for manual control — some schedulers may prefer review gates |
| **Webhook-based notifications** | Traded push reliability for unified API — depends on external webhook service uptime |

### Component Architecture

**Frontend Components:**
- `src/components/SmartHub.tsx` - Main hub entry point
- `src/components/marketplace/ShiftBoard.tsx` - Open shifts grid/list
- `src/components/marketplace/MyShifts.tsx` - Provider's assigned shifts
- `src/components/marketplace/ShiftCard.tsx` - Individual shift display
- `src/components/copilot/CopilotChatDrawer.tsx` - NLP interface
- `src/components/broadcast/BroadcastPanel.tsx` - Admin broadcast controls
- `src/components/profiles/ProviderProfileEditor.tsx` - Preferences/fatigue display

**Backend Routes (server.js):**
- `GET/POST /api/marketplace/shifts` - List/create shifts
- `POST /api/marketplace/shifts/:id/claim` - Claim shift
- `POST /api/marketplace/shifts/:id/approve` - Approve claim
- `POST /api/marketplace/shifts/:id/cancel` - Cancel shift
- `POST /api/broadcast/dispatch` - Send notifications
- `POST /api/broadcast/escalate/:shiftId` - Trigger escalation
- `POST /api/copilot/query` - NLP coverage query

### Data Flow

```
1. Provider posts shift → POST /api/marketplace/shifts → State: POSTED
2. AI evaluation → POST /api/copilot/query → Returns top 3 eligible providers
3. Broadcast → POST /api/broadcast/dispatch → State: BROADCASTING
4. Provider claims → POST /api/marketplace/shifts/:id/claim → State: CLAIMED
5. Approval → POST /api/marketplace/shifts/:id/approve → State: APPROVED
```

**Escalation Flow:** T+0 (Tier 1), T+60min (Tier 2), T+120min (Tier 3), stop at max 3 tiers.

### Integration Points

| Integration | Point | Method |
|-------------|-------|--------|
| Zustand Store | `src/store.ts` | Extend with `claimShift`, `approveShift`, fatigue middleware |
| AI Scaffold | `src/lib/ai/naturalLanguageQuery.ts` | Extend with marketplace intents |
| Notifications | `server.js` existing `/api/notifications/*` | Extend for broadcast |
| Provider Profiles | `src/types.ts` Provider | Add `communicationPreferences`, `fatigueMetrics`, `autoApproveClaims` |

### Expected Changes

#### NEW Files to CREATE (19 total)

**Frontend Components (13 files):**
- `src/components/SmartHub.tsx` — Main hub entry point
- `src/components/marketplace/MyShifts.tsx` — Provider's assigned shifts list
- `src/components/marketplace/ShiftBoard.tsx` — Open shifts grid/list
- `src/components/marketplace/ShiftCard.tsx` — Individual shift display
- `src/components/marketplace/MarketplaceFilters.tsx` — Filter sidebar
- `src/components/marketplace/ClaimConfirmationModal.tsx` — Claim confirmation dialog
- `src/components/broadcast/BroadcastPanel.tsx` — Admin broadcast controls
- `src/components/broadcast/EscalationTracker.tsx` — Live escalation status
- `src/components/broadcast/BroadcastHistoryList.tsx` — Broadcast history entries
- `src/components/copilot/CopilotChatDrawer.tsx` — NLP interface drawer
- `src/components/copilot/CopilotQueryResult.tsx` — Ranked provider results display
- `src/components/profiles/ProviderProfileEditor.tsx` — Profile with fatigue/preferences
- `src/components/profiles/FatigueIndicator.tsx` — Visual fatigue warning

**Custom Hooks (3 files):**
- `src/hooks/useFatigueCheck.ts` — Fatigue metrics calculation
- `src/hooks/useBroadcast.ts` — Broadcast dispatch logic
- `src/hooks/useMarketplace.ts` — Marketplace operations

**API Client Modules (3 files):**
- `src/lib/api/marketplace.ts` — Marketplace endpoint wrappers
- `src/lib/api/broadcast.ts` — Broadcast endpoint wrappers
- `src/lib/api/copilot.ts` — Copilot query wrappers

#### EXISTING Files to MODIFY (6 files)

| File | Changes |
|------|---------|
| `src/store.ts` | Add `claimShift()`, `approveShift()`, fatigue middleware |
| `src/types.ts` | Add `MarketplaceFilters`, `ProviderMatch`, `BroadcastDispatchRequest`, extend `Provider` with `communicationPreferences`, `fatigueMetrics`, `autoApproveClaims` |
| `server.js` | Add all new API routes (see Component Architecture) |
| `src/components/App.tsx` | Add routing/tab for SmartHub |
| `src/hooks/index.ts` | Export new hooks |
| `src/lib/api/index.ts` | Export new API functions |

#### Data Files (Auto-created)

- `data/marketplace-shifts.json` — Marketplace shift persistence
- `data/broadcast-history.json` — Broadcast history persistence

---

## Implementation Steps

### Step 1: TypeScript Types & Store Extensions
**Goal:** Add all required TypeScript types and extend Zustand store with marketplace actions

**Dependencies:** None (foundational - all other steps depend on this)
**Agent:** sonnet

**Output:**
- `src/types.ts` - Add `MarketplaceFilters`, `ProviderMatch`, `BroadcastDispatchRequest`, extend `Provider` with `communicationPreferences`, `fatigueMetrics`, `autoApproveClaims`
- `src/store.ts` - Add `claimShift()`, `approveShift()`, `cancelMarketplaceShift()`, fatigue middleware, `addBroadcastEntry()`, `updateBroadcastRecipientStatus()`

**Success Criteria:**
- [ ] All new types exported from `src/types.ts` without TypeScript errors
- [ ] `pnpm typecheck` passes for types
- [ ] Store has `claimShift`, `approveShift`, `cancelMarketplaceShift` actions

**Subtasks:**
- 1.1 Add `MarketplaceFilters` interface to types
- 1.2 Add `ProviderMatch` interface with fatigue score
- 1.3 Add `BroadcastDispatchRequest` interface
- 1.4 Extend `Provider` type with optional `communicationPreferences`, `fatigueMetrics`, `autoApproveClaims`
- 1.5 Add `claimShift(shiftId, providerId)` action to store
- 1.6 Add `approveShift(shiftId, approvedBy)` action to store
- 1.7 Add `cancelMarketplaceShift(shiftId)` action to store
- 1.8 Add fatigue calculation middleware for provider matching

**Blockers:**
- Need to verify existing types don't conflict with new additions
- Resolution: Use optional properties to maintain backward compatibility

**Risks:**
- Type conflicts with existing Provider fields - **Mitigation:** Use partial/optional extensions

### Verification
- **Level:** Panel (HIGH)
- **Rubric:**
  1. [All new types exported without TypeScript errors] (weight: 0.25)
  2. [pnpm typecheck passes for types] (weight: 0.25)
  3. [Store has claimShift, approveShift, cancelMarketplaceShift actions] (weight: 0.25)
  4. [Fatigue middleware correctly calculates metrics] (weight: 0.25)
- **Threshold:** 4.0/5.0

---

### Step 2: Backend API Routes - Core Marketplace
**Goal:** Implement server-side marketplace API endpoints for shift CRUD and lifecycle transitions

**Dependencies:** Depends on: Step 1
**Can run parallel with:** Steps 3, 4
**Agent:** opus

**Output:**
- `server.js` - Add `/api/marketplace/shifts` GET/POST routes
- `server.js` - Add `/api/marketplace/shifts/:id/claim` POST route
- `server.js` - Add `/api/marketplace/shifts/:id/approve` POST route  
- `server.js` - Add `/api/marketplace/shifts/:id/cancel` POST route
- `data/marketplace-shifts.json` - Persistence file

**Success Criteria:**
- [ ] `GET /api/marketplace/shifts` returns all marketplace shifts
- [ ] `POST /api/marketplace/shifts` creates new marketplace shift in POSTED state
- [ ] `POST /api/marketplace/shifts/:id/claim` transitions shift to CLAIMED
- [ ] `POST /api/marketplace/shifts/:id/approve` transitions shift to APPROVED
- [ ] `POST /api/marketplace/shifts/:id/cancel` cancels shift with validation
- [ ] All endpoints persist to `data/marketplace-shifts.json`

**Subtasks:**
- 2.1 Create `data/marketplace-shifts.json` with empty array
- 2.2 Implement GET /api/marketplace/shifts with optional filters
- 2.3 Implement POST /api/marketplace/shifts (post shift for coverage)
- 2.4 Implement state machine validation for transitions
- 2.5 Implement POST /api/marketplace/shifts/:id/claim with auto-approve logic
- 2.6 Implement POST /api/marketplace/shifts/:id/approve
- 2.7 Implement POST /api/marketplace/shifts/:id/cancel with state validation

**Blockers:**
- Need file locking for concurrent writes to JSON persistence
- Resolution: Use `fs.promises.writeFile` with try-catch retry pattern

**Risks:**
- Race conditions on concurrent marketplace operations - **Mitigation:** Add file locking, implement optimistic concurrency

### Verification
- **Level:** Panel (HIGH)
- **Rubric:**
  1. [GET /api/marketplace/shifts returns filtered marketplace shifts] (weight: 0.20)
  2. [POST /api/marketplace/shifts creates shift in POSTED state] (weight: 0.20)
  3. [POST /api/marketplace/shifts/:id/claim transitions to CLAIMED] (weight: 0.20)
  4. [POST /api/marketplace/shifts/:id/approve transitions to APPROVED] (weight: 0.20)
  5. [POST /api/marketplace/shifts/:id/cancel validates state before cancel] (weight: 0.20)
- **Threshold:** 4.0/5.0

---

### Step 3: Backend API Routes - Broadcast Service
**Goal:** Implement broadcast notification dispatch and auto-escalation endpoints

**Dependencies:** Depends on: Step 1
**Can run parallel with:** Steps 2, 4
**Agent:** opus

**Output:**
- `server.js` - Add `/api/broadcast/dispatch` POST route
- `server.js` - Add `/api/broadcast/escalate/:shiftId` POST route
- `server.js` - Add `/api/broadcast/history` GET route
- `data/broadcast-history.json` - Persistence file

**Success Criteria:**
- [ ] `POST /api/broadcast/dispatch` sends notifications via configured webhooks
- [ ] Respects provider communication preferences (SMS/Email/Push)
- [ ] Creates broadcast history entry with tier tracking
- [ ] `POST /api/broadcast/escalate/:shiftId` triggers next tier escalation
- [ ] Escalation respects max tier limit (default 3)
- [ ] `GET /api/broadcast/history` returns broadcast history

**Subtasks:**
- 3.1 Create `data/broadcast-history.json` with empty array
- 3.2 Implement broadcast dispatch logic using existing webhook infrastructure
- 3.3 Add provider preference filtering to dispatch
- 3.4 Implement escalation timer tracking with timestamps
- 3.5 Implement tier escalation logic (T+0, T+60min, T+120min)
- 3.6 Add broadcast history CRUD operations

**Blockers:**
- External webhook service availability
- Resolution: Add graceful degradation with fallback to log channel

**Risks:**
- Webhook delivery failures not tracked - **Mitigation:** Implement retry logic and status polling

### Verification
- **Level:** Panel (HIGH)
- **Rubric:**
  1. [POST /api/broadcast/dispatch sends notifications via webhooks] (weight: 0.20)
  2. [Respects provider communication preferences] (weight: 0.20)
  3. [Creates broadcast history entry with tier tracking] (weight: 0.20)
  4. [POST /api/broadcast/escalate triggers next tier] (weight: 0.20)
  5. [Escalation respects max tier limit (default 3)] (weight: 0.20)
- **Threshold:** 4.0/5.0

---

### Step 4: Backend API Routes - AI Copilot Query
**Goal:** Implement natural language query processing for coverage suggestions

**Dependencies:** Depends on: Step 1
**Can run parallel with:** Steps 2, 3
**Agent:** sonnet

**Output:**
- `server.js` - Add `/api/copilot/query` POST route
- `src/lib/ai/naturalLanguageQuery.ts` - Extend with marketplace intents (or create if not exists)

**Success Criteria:**
- [ ] `POST /api/copilot/query` accepts natural language input
- [ ] Extracts provider name and date from queries like "Who can cover Dr. Smith tomorrow?"
- [ ] Returns top 3 eligible providers sorted by fatigue-adjusted fairness
- [ ] Response time < 2 seconds
- [ ] Returns error message for invalid/no-results queries

**Subtasks:**
- 4.1 Implement pattern-based NLP parser for coverage queries
- 4.2 Add provider name extraction (e.g., "Dr. Smith" → providerId)
- 4.3 Add date extraction (e.g., "tomorrow" → YYYY-MM-DD)
- 4.4 Implement eligibility filtering based on skills and fatigue
- 4.5 Implement fairness scoring (fewest shiftsThisMonth)
- 4.6 Add error handling for no-results scenarios

**Blockers:**
- Need to integrate with existing AI scaffold
- Resolution: Extend existing `src/lib/ai/` module if present

**Risks:**
- NLP patterns may not cover all query variations - **Mitigation:** Add fallbacks and "did you mean" suggestions

### Verification
- **Level:** Panel (HIGH)
- **Rubric:**
  1. [POST /api/copilot/query accepts natural language input] (weight: 0.20)
  2. [Extracts provider name and date from queries] (weight: 0.20)
  3. [Returns top 3 eligible providers sorted by fatigue-adjusted fairness] (weight: 0.20)
  4. [Response time < 2 seconds] (weight: 0.20)
  5. [Returns error message for invalid/no-results queries] (weight: 0.20)
- **Threshold:** 4.0/5.0

---

### Step 5: Frontend API Client Modules
**Goal:** Create TypeScript API client modules for marketplace, broadcast, and copilot endpoints

**Dependencies:** Depends on: Steps 2, 3, 4
**Agent:** haiku

**Output:**
- `src/lib/api/marketplace.ts` - Marketplace endpoint wrappers
- `src/lib/api/broadcast.ts` - Broadcast endpoint wrappers
- `src/lib/api/copilot.ts` - Copilot query wrappers
- `src/lib/api/index.ts` - Export all new functions

**Success Criteria:**
- [ ] All API modules created with proper TypeScript types
- [ ] Functions call correct backend endpoints
- [ ] Handle error responses gracefully
- [ ] Export all functions from `src/lib/api/index.ts`

**Subtasks:**
- 5.1 Create `src/lib/api/marketplace.ts` with getShifts, createShift, claimShift, approveShift, cancelShift
- 5.2 Create `src/lib/api/broadcast.ts` with dispatchBroadcast, escalateShift, getHistory
- 5.3 Create `src/lib/api/copilot.ts` with queryCoverage
- 5.4 Update `src/lib/api/index.ts` exports

**Blockers:**
- None - pure frontend integration with backend APIs

**Risks:**
- API response format changes - **Mitigation:** Add runtime validation with Zod

### Verification
- **Level:** Per-Item (MEDIUM)
- **Rubric:**
  1. [All API modules created with proper TypeScript types] (weight: 0.25)
  2. [Functions call correct backend endpoints] (weight: 0.25)
  3. [Handle error responses gracefully] (weight: 0.25)
  4. [Export all functions from src/lib/api/index.ts] (weight: 0.25)
- **Threshold:** 4.0/5.0

---

### Step 6: Custom Hooks for Business Logic
**Goal:** Create React hooks encapsulating marketplace, broadcast, and fatigue check logic

**Dependencies:** Depends on: Steps 1, 5
**Agent:** sonnet

**Output:**
- `src/hooks/useMarketplace.ts` - Marketplace operations (list, claim, approve, cancel)
- `src/hooks/useBroadcast.ts` - Broadcast dispatch and escalation
- `src/hooks/useFatigueCheck.ts` - Fatigue metrics calculation
- `src/hooks/index.ts` - Export all new hooks

**Success Criteria:**
- [ ] `useMarketplace` hook provides all marketplace operations
- [ ] `useBroadcast` hook manages broadcast state and escalation
- [ ] `useFatigueCheck` calculates consecutiveShiftsWorked and shiftsThisMonth
- [ ] All hooks exported from `src/hooks/index.ts`
- [ ] Hooks integrate with Zustand store and API modules

**Subtasks:**
- 6.1 Create `useMarketplace.ts` with state and actions for marketplace
- 6.2 Create `useBroadcast.ts` with dispatch and escalation logic
- 6.3 Create `useFatigueCheck.ts` with fatigue metrics calculation
- 6.4 Add hooks to `src/hooks/index.ts` exports

**Blockers:**
- None - depends on Step 5 (API modules) and Step 1 (store)

**Risks:**
- Hooks may cause excessive re-renders - **Mitigation:** Use proper memoization and selectors

### Verification
- **Level:** Per-Item (MEDIUM)
- **Rubric:**
  1. [useMarketplace hook provides all marketplace operations] (weight: 0.33)
  2. [useBroadcast hook manages broadcast state and escalation] (weight: 0.33)
  3. [useFatigueCheck calculates consecutiveShiftsWorked and shiftsThisMonth] (weight: 0.34)
- **Threshold:** 4.0/5.0

---

### Step 7: Frontend Components - Marketplace UI
**Goal:** Build marketplace components (MyShifts, ShiftBoard, ShiftCard, Filters)

**Dependencies:** Depends on: Step 6
**Can run parallel with:** Steps 8, 9
**Agent:** sonnet

**Output:**
- `src/components/marketplace/ShiftCard.tsx` - Individual shift display
- `src/components/marketplace/MyShifts.tsx` - Provider's assigned shifts list
- `src/components/marketplace/ShiftBoard.tsx` - Open shifts grid/list
- `src/components/marketplace/MarketplaceFilters.tsx` - Filter sidebar
- `src/components/marketplace/ClaimConfirmationModal.tsx` - Claim confirmation dialog

**Success Criteria:**
- [ ] ShiftCard displays shift info with claim button
- [ ] MyShifts shows current provider's assigned shifts
- [ ] ShiftBoard shows all BROADCASTING state shifts
- [ ] Filters work for date range, shift type, location
- [ ] ClaimConfirmationModal shows confirmation before claiming
- [ ] Mobile-responsive: single-column, 44px tap targets
- [ ] Desktop-responsive: multi-column grid with sidebar

**Subtasks:**
- 7.1 Create ShiftCard component with shift details and claim button
- 7.2 Create MyShifts component with assigned shifts list
- 7.3 Create ShiftBoard component with BROADCASTING shifts
- 7.4 Create MarketplaceFilters component
- 7.5 Create ClaimConfirmationModal component
- 7.6 Add responsive CSS (mobile-first)

**Blockers:**
- Need to verify existing component patterns match
- Resolution: Follow existing component structure in `src/components/`

**Risks:**
- Complex responsive layout - **Mitigation:** Use Tailwind CSS with mobile-first approach

### Verification
- **Level:** Per-Item (MEDIUM)
- **Rubric:**
  1. [ShiftCard displays shift info with claim button] (weight: 0.17)
  2. [MyShifts shows current provider's assigned shifts] (weight: 0.17)
  3. [ShiftBoard shows all BROADCASTING state shifts] (weight: 0.17)
  4. [Filters work for date range, shift type, location] (weight: 0.17)
  5. [ClaimConfirmationModal shows confirmation before claiming] (weight: 0.16)
  6. [Mobile-responsive: single-column, 44px tap targets] (weight: 0.16)
- **Threshold:** 4.0/5.0

---

### Step 8: Frontend Components - Broadcast & Copilot UI
**Goal:** Build broadcast panel, escalation tracker, and copilot chat drawer

**Dependencies:** Depends on: Step 6
**Can run parallel with:** Steps 7, 9
**Agent:** sonnet

**Output:**
- `src/components/broadcast/BroadcastPanel.tsx` - Admin broadcast controls
- `src/components/broadcast/EscalationTracker.tsx` - Live escalation status
- `src/components/broadcast/BroadcastHistoryList.tsx` - History entries
- `src/components/copilot/CopilotChatDrawer.tsx` - NLP interface drawer
- `src/components/copilot/CopilotQueryResult.tsx` - Ranked provider results

**Success Criteria:**
- [ ] BroadcastPanel allows 1-click broadcast dispatch
- [ ] EscalationTracker shows countdown to next tier
- [ ] BroadcastHistoryList shows past broadcasts
- [ ] CopilotChatDrawer opens as drawer/sidebar
- [ ] CopilotQueryResult displays ranked providers with scores

**Subtasks:**
- 8.1 Create BroadcastPanel with dispatch button and provider selection
- 8.2 Create EscalationTracker with countdown timer display
- 8.3 Create BroadcastHistoryList component
- 8.4 Create CopilotChatDrawer with input and message display
- 8.5 Create CopilotQueryResult with provider cards

**Blockers:**
- None - depends on Step 6 (hooks) and Step 5 (API)

**Risks:**
- Escalation timer drift in background tabs - **Mitigation:** Use server-side timestamps, refresh on focus

### Verification
- **Level:** Per-Item (MEDIUM)
- **Rubric:**
  1. [BroadcastPanel allows 1-click broadcast dispatch] (weight: 0.20)
  2. [EscalationTracker shows countdown to next tier] (weight: 0.20)
  3. [BroadcastHistoryList shows past broadcasts] (weight: 0.20)
  4. [CopilotChatDrawer opens as drawer/sidebar] (weight: 0.20)
  5. [CopilotQueryResult displays ranked providers with scores] (weight: 0.20)
- **Threshold:** 4.0/5.0

---

### Step 9: Frontend Components - Provider Profiles & Smart Hub
**Goal:** Build provider profile editor and main Smart Hub entry point

**Dependencies:** Depends on: Step 6
**Can run parallel with:** Steps 7, 8
**Agent:** sonnet

**Output:**
- `src/components/profiles/FatigueIndicator.tsx` - Visual fatigue warning
- `src/components/profiles/ProviderProfileEditor.tsx` - Profile with fatigue/preferences
- `src/components/SmartHub.tsx` - Main hub entry point
- `src/components/App.tsx` - Add SmartHub tab/routing

**Success Criteria:**
- [ ] FatigueIndicator shows warning when consecutiveShifts >= 3
- [ ] ProviderProfileEditor shows communication preferences toggles
- [ ] ProviderProfileEditor shows auto-approve claims toggle
- [ ] SmartHub integrates all components in unified view
- [ ] App.tsx has tab/route for SmartHub access

**Subtasks:**
- 9.1 Create FatigueIndicator component with warning styling
- 9.2 Create ProviderProfileEditor with communication preferences
- 9.3 Add auto-approve toggle to ProviderProfileEditor
- 9.4 Create SmartHub container component
- 9.5 Add SmartHub tab to App.tsx navigation

**Blockers:**
- Need to integrate with existing App.tsx navigation
- Resolution: Add as new tab alongside existing calendar/excel views

**Risks:**
- Profile editor may conflict with existing profile management - **Mitigation:** Extend existing profile components if present

### Verification
- **Level:** Per-Item (MEDIUM)
- **Rubric:**
  1. [FatigueIndicator shows warning when consecutiveShifts >= 3] (weight: 0.20)
  2. [ProviderProfileEditor shows communication preferences toggles] (weight: 0.20)
  3. [ProviderProfileEditor shows auto-approve claims toggle] (weight: 0.20)
  4. [SmartHub integrates all components in unified view] (weight: 0.20)
  5. [App.tsx has tab/route for SmartHub access] (weight: 0.20)
- **Threshold:** 4.0/5.0

---

### Step 10: Integration & Testing
**Goal:** Verify all components work together and pass tests

**Dependencies:** Depends on: All previous steps (Steps 1-9)
**Agent:** sonnet

**Output:**
- All acceptance criteria verified
- Unit tests for new hooks and utilities
- E2E tests for key flows
- Build passes

**Success Criteria:**
- [ ] `pnpm typecheck` passes without errors
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes for new components
- [ ] All 35+ acceptance criteria pass
- [ ] Shift lifecycle state machine enforces valid transitions
- [ ] Broadcast respects provider preferences
- [ ] AI Copilot returns results in < 2 seconds

**Subtasks:**
- 10.1 Run typecheck and fix any errors
- 10.2 Run build and fix any errors
- 10.3 Run tests and fix failures
- 10.4 Test marketplace flow end-to-end
- 10.5 Test broadcast dispatch and escalation
- 10.6 Test copilot query parsing and results

**Blockers:**
- Integration issues between components
- Resolution: Use Playwright for E2E, Vitest for unit tests

**Risks:**
- Full test coverage may be time-consuming - **Mitigation:** Prioritize critical path tests

### Verification
- **Level:** Panel (HIGH)
- **Rubric:**
  1. [pnpm typecheck passes without errors] (weight: 0.15)
  2. [pnpm build succeeds] (weight: 0.15)
  3. [pnpm test passes for new components] (weight: 0.15)
  4. [Shift lifecycle state machine enforces valid transitions] (weight: 0.20)
  5. [Broadcast respects provider preferences] (weight: 0.15)
  6. [AI Copilot returns results in < 2 seconds] (weight: 0.20)
- **Threshold:** 4.0/5.0

---

## Execution Plan

### Dependency Analysis

| Step | Depends On | Can Run Parallel With |
|------|-----------|----------------------|
| Step 1 (Types/Store) | None | - |
| Step 2 (Marketplace Backend) | Step 1 | Steps 3, 4 |
| Step 3 (Broadcast Backend) | Step 1 | Steps 2, 4 |
| Step 4 (Copilot Backend) | Step 1 | Steps 2, 3 |
| Step 5 (API Clients) | Steps 2,3,4 | - |
| Step 6 (Hooks) | Steps 1, 5 | - |
| Step 7 (Marketplace UI) | Step 6 | Steps 8, 9 |
| Step 8 (Broadcast/Copilot UI) | Step 6 | Steps 7, 9 |
| Step 9 (Profiles/SmartHub) | Step 6 | Steps 7, 8 |
| Step 10 (Integration) | All previous | - |

### Execution Waves

**Wave 1 (Foundation)**
- Step 1: TypeScript Types & Store Extensions
- **Agent:** sonnet (medium complexity - type definitions + Zustand store)

**Wave 2 (Backend APIs - Parallel)**
- Step 2: Core Marketplace Routes
- Step 3: Broadcast Service Routes
- Step 4: AI Copilot Query Route
- **Agent:** opus (complex) for Steps 2,3; sonnet (medium) for Step 4

**Wave 3 (Frontend Integration)**
- Step 5: Frontend API Client Modules
- **Agent:** haiku (simple - straightforward API wrappers)

**Wave 4 (Business Logic)**
- Step 6: Custom Hooks for Business Logic
- **Agent:** sonnet (medium complexity - React hooks with state)

**Wave 5 (UI Components - Parallel)**
- Step 7: Marketplace UI Components
- Step 8: Broadcast & Copilot UI Components
- Step 9: Provider Profiles & Smart Hub
- **Agent:** sonnet (medium complexity - React components)

**Wave 6 (Final Integration)**
- Step 10: Integration & Testing
- **Agent:** sonnet (medium complexity - testing + integration)

### Total Waves: 6

---

## Acceptance Criteria

Clear, testable criteria using Given/When/Then or checkbox format:

### Functional Requirements

#### 1. AI Copilot Natural Language Interface

- [ ] **[AI-COPILOT-QUERY-1]**: Natural language query returns ranked eligible providers within 2 seconds
  - Given: Admin enters natural language query like "Who can cover Dr. Smith tomorrow?"
  - When: Query submitted to AI Copilot endpoint
  - Then: Returns JSON array of eligible providers sorted by fairness score

- [ ] **[AI-COPILOT-QUERY-2]**: Query extracts provider name and date from natural language
  - Given: Query "Who can cover Dr. Smith on 2026-04-15?"
  - When: AI Copilot parses the query
  - Then: Extracts providerId="smith" and date="2026-04-15" correctly

- [ ] **[AI-COPILOT-QUERY-3]**: Returns top 3 providers sorted by fatigue-adjusted fairness
  - Given: Multiple eligible providers available
  - When: AI Copilot processes query
  - Then: Returns maximum 3 providers sorted by fewest shiftsThisMonth

- [ ] **[AI-COPILOT-QUERY-4]**: Error message for invalid queries
  - Given: Query with no available results
  - When: Query submitted
  - Then: Returns error message "No providers available for this shift"

#### 2. Broadcast Notification Service

- [ ] **[BROADCAST-1]**: Dispatch notifications to selected providers via preferred channel
  - Given: Marketplace shift in BROADCASTING state, eligible providers selected
  - When: Admin triggers 1-click broadcast
  - Then: Each provider receives notification via their preferred channel (SMS/Email/Push)

- [ ] **[BROADCAST-2]**: Respect provider communication preferences
  - Given: Provider has communicationPreferences = { sms: true, email: false, push: true }
  - When: Broadcast sent to this provider
  - Then: Notification sent via SMS and Push only

- [ ] **[BROADCAST-3]**: Fallback to available channel if preferred unavailable
  - Given: Provider prefers SMS but no phone number on file
  - When: Broadcast dispatched
  - Then: Falls back to email as default

- [ ] **[BROADCAST-4]**: Create broadcast history entry with delivery tracking
  - Given: Broadcast dispatched to providers
  - Then: BroadcastHistoryEntry created with status: 'sent', tracks viewedAt/respondedAt

- [ ] **[BROADCAST-5]**: Auto-escalation triggers after 60 minutes if no response
  - Given: Broadcast sent, no provider responded within escalation delay
  - When: Auto-escalation timer expires
  - Then: Next tier of providers notified automatically

- [ ] **[BROADCAST-6]**: Escalation stops at max tier limit (default 3)
  - Given: Max escalation tiers reached with no claim
  - When: Next escalation attempted
  - Then: Returns status indicating "max tiers reached", stops escalation

#### 3. Provider Marketplace

- [ ] **[MARKETPLACE-1]**: My Shifts displays current provider's upcoming assigned shifts
  - Given: User logged in as neurointensivist
  - When: Navigate to My Shifts
  - Then: Shows list of assigned shifts sorted by date

- [ ] **[MARKETPLACE-2]**: Request Coverage action posts shift to marketplace
  - Given: User has assigned shift
  - When: User taps "Request Coverage" button
  - Then: MarketplaceShift created in POSTED state

- [ ] **[MARKETPLACE-3]**: Shift Board displays open shifts available for claiming
  - Given: User navigates to Shift Board
  - Then: Shows all shifts in BROADCASTING state with filter options

- [ ] **[MARKETPLACE-4]**: Filter shifts by date range, shift type, location
  - Given: Shift Board open
  - When: User applies filters
  - Then: Only matching shifts displayed

- [ ] **[MARKETPLACE-5]**: Claim shift with confirmation dialog
  - Given: Shift in BROADCASTING state, user taps "Claim Shift"
  - When: User confirms claim
  - Then: Shift transitions to CLAIMED state

- [ ] **[MARKETPLACE-6]**: Mobile-responsive layout (stacked cards, touch-friendly)
  - Given: Viewing marketplace on mobile viewport (< 768px)
  - Then: Single-column card layout, 44px minimum tap targets

- [ ] **[MARKETPLACE-7]**: Desktop responsive layout (grid with sidebar filters)
  - Given: Viewing marketplace on desktop viewport (>= 1024px)
  - Then: Multi-column grid with filter sidebar

- [ ] **[MARKETPLACE-8]**: Auto-approve claims when provider has toggle enabled
  - Given: Provider.autoApproveClaims = true, shift claimed
  - When: Claim submitted
  - Then: Shift automatically transitions to APPROVED without admin action

- [ ] **[MARKETPLACE-9]**: Show "Pending approval" state when auto-approve disabled
  - Given: Provider.autoApproveClaims = false, shift claimed
  - When: Claim submitted
  - Then: Shift shows CLAIMED state pending admin approval

#### 4. Enhanced Provider Profiles with Fatigue Metrics

- [ ] **[PROFILE-1]**: Display fatigue metrics on provider profile
  - Given: Provider profile page
  - Then: Shows consecutiveShiftsWorked and shiftsThisMonth

- [ ] **[PROFILE-2]**: Fatigue warning indicator when consecutive shifts >= 3
  - Given: Provider has consecutiveShiftsWorked >= 3
  - Then: Profile displays warning indicator

- [ ] **[PROFILE-3]**: Communication preferences toggles (SMS/Email/Push)
  - Given: Provider editing profile
  - When: User toggles communication channel
  - Then: Provider.communicationPreferences updated accordingly

- [ ] **[PROFILE-4]**: Auto-approve claims toggle per provider
  - Given: Provider editing profile
  - When: User toggles "Auto-approve my shift claims"
  - Then: Provider.autoApproveClaims updated

#### 5. Shift Lifecycle State Machine

- [ ] **[LIFECYCLE-1]**: Enforce valid state transitions only
  - Given: Shift in POSTED state
  - When: Attempt transition to CLAIMED
  - Then: Transition rejected with error "Invalid transition: POSTED → CLAIMED"

- [ ] **[LIFECYCLE-2]**: POSTED → AI_EVALUATING transition succeeds
  - Given: Shift in POSTED state
  - When: AI Copilot evaluates the shift
  - Then: Shift transitions to AI_EVALUATING

- [ ] **[LIFECYCLE-3]**: AI_EVALUATING → BROADCASTING transition succeeds
  - Given: Shift in AI_EVALUATING state
  - When: AI evaluation complete
  - Then: Shift transitions to BROADCASTING

- [ ] **[LIFECYCLE-4]**: BROADCASTING → CLAIMED transition succeeds
  - Given: Shift in BROADCASTING state
  - When: Provider claims shift
  - Then: Shift transitions to CLAIMED

- [ ] **[LIFECYCLE-5]**: CLAIMED → APPROVED transition succeeds
  - Given: Shift in CLAIMED state
  - When: Admin approves OR auto-approve triggered
  - Then: Shift transitions to APPROVED

- [ ] **[LIFECYCLE-6]**: Each transition creates audit log entry
  - Given: Any state transition occurs
  - Then: Audit entry created with timestamp, fromState, toState

- [ ] **[LIFECYCLE-7]**: Cancel marketplace shift only in POSTED or CLAIMED states
  - Given: Shift in APPROVED state
  - When: Attempt to cancel
  - Then: Rejected with error "Cannot cancel approved shift"

### Non-Functional Requirements

- [ ] **Performance**: AI Copilot query response time < 2 seconds
- [ ] **Performance**: Marketplace shift list loads < 1 second
- [ ] **Performance**: Broadcast dispatch completes < 500ms
- [ ] **Reliability**: Broadcast history persisted to JSON file
- [ ] **Usability**: Mobile-first design with 44px minimum tap targets
- [ ] **Accessibility**: WCAG 2.1 AA compliance on new components
- [ ] **Compatibility**: Works on Chrome, Safari, Firefox (latest 2 versions)

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Tests written and passing: `pnpm test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build`
- [ ] E2E tests pass: `pnpm test:e2e`
- [ ] Documentation updated in /docs
