# Analysis: Smart Neuro ICU Hub Implementation

## 1. Overview

This analysis covers implementing five integrated features for the Neuro ICU Scheduler:
1. AI Copilot natural language interface for scheduling queries
2. Broadcast notification service with auto-escalation
3. Provider Marketplace (My Shifts + Shift Board)
4. Enhanced provider profiles with fatigue metrics
5. Shift lifecycle state machine

## 2. NEW FILES TO CREATE

### Frontend Components (React/TypeScript)

| File | Purpose |
|------|---------|
| `src/components/SmartHub.tsx` | Main hub component integrating Copilot, Marketplace, Broadcast |
| `src/components/marketplace/MyShifts.tsx` | Provider's upcoming assigned shifts list |
| `src/components/marketplace/ShiftBoard.tsx` | Open shifts available for claiming |
| `src/components/marketplace/ShiftCard.tsx` | Individual shift card with claim action |
| `src/components/marketplace/MarketplaceFilters.tsx` | Filter sidebar for Shift Board |
| `src/components/marketplace/ClaimConfirmationModal.tsx` | Confirm dialog for claiming shifts |
| `src/components/broadcast/BroadcastPanel.tsx` | Admin broadcast controls |
| `src/components/broadcast/EscalationTracker.tsx` | Live escalation status display |
| `src/components/broadcast/BroadcastHistoryList.tsx` | List of broadcast history entries |
| `src/components/copilot/CopilotChatDrawer.tsx` | AI Copilot natural language interface |
| `src/components/copilot/CopilotQueryResult.tsx` | Display ranked provider results |
| `src/components/profiles/ProviderProfileEditor.tsx` | Edit provider profile with fatigue/preferences |
| `src/components/profiles/FatigueIndicator.tsx` | Visual fatigue warning component |
| `src/hooks/useFatigueCheck.ts` | Hook for calculating fatigue metrics |
| `src/hooks/useBroadcast.ts` | Hook for broadcast dispatch logic |
| `src/hooks/useMarketplace.ts` | Hook for marketplace operations |
| `src/hooks/useCopilotQuery.ts` | Hook for AI Copilot queries |
| `src/lib/api/marketplace.ts` | API client for marketplace endpoints |
| `src/lib/api/broadcast.ts` | API client for broadcast endpoints |
| `src/lib/api/copilot.ts` | API client for copilot query endpoints |

### Backend Routes (server.js additions)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/marketplace/shifts` | GET | List marketplace shifts |
| `/api/marketplace/shifts` | POST | Create new marketplace shift |
| `/api/marketplace/shifts/:id/claim` | POST | Claim a shift |
| `/api/marketplace/shifts/:id/approve` | POST | Approve claimed shift |
| `/api/marketplace/shifts/:id/cancel` | POST | Cancel marketplace shift |
| `/api/marketplace/my-shifts` | GET | Get current provider's shifts |
| `/api/broadcast/dispatch` | POST | Dispatch broadcast to providers |
| `/api/broadcast/history` | GET | Get broadcast history |
| `/api/broadcast/escalate/:shiftId` | POST | Trigger escalation |
| `/api/copilot/query` | POST | Natural language query for coverage |

### Data Files (JSON persistence)

| File | Purpose |
|------|---------|
| `data/marketplace-shifts.json` | Persist marketplace shifts |
| `data/broadcast-history.json` | Persist broadcast history |

## 3. EXISTING FILES TO MODIFY

### MUST Change

| File | Modification |
|------|--------------|
| `src/store.ts` | Add: `claimShift(shiftId, providerId)`, `approveShift(shiftId)`, `getEligibleProviders(slotId)`, compute fatigue on provider updates |
| `src/types.ts` | MAY extend: Add `ProviderMatch` type for copilot results, add `BroadcastDispatchRequest` type |
| `server.js` | Add all new API routes (see section 2) |
| `src/components/App.tsx` | Add routing/tab for SmartHub component |
| `src/hooks/index.ts` | Export new hooks |
| `src/lib/api/index.ts` | Export new API functions |

### Can Extend

| File | Notes |
|------|-------|
| `src/lib/ai/naturalLanguageQuery.ts` | Extend with coverage query intent parsing |
| `src/components/NaturalLanguageInterface.tsx` | Integrate with CopilotDrawer |
| `src/components/ProviderManager.tsx` | Add fatigue metrics display |
| `src/components/NotificationCenter.tsx` | Add broadcast notifications |

## 4. Function Signatures (Required Types)

### Store Functions to Add

```typescript
// src/store.ts additions
function claimShift(shiftId: string, providerId: string): void
function approveShift(shiftId: string, approvedBy: string): void
function getEligibleProviders(slotId: string): Provider[]
```

### API Client Functions

```typescript
// src/lib/api/marketplace.ts
export async function getMarketplaceShifts(filters?: MarketplaceFilters): Promise<MarketplaceShift[]>
export async function postShiftForCoverage(slotId: string, notes: string): Promise<MarketplaceShift>
export async function claimMarketplaceShift(shiftId: string): Promise<MarketplaceShift>
export async function approveMarketplaceShift(shiftId: string): Promise<MarketplaceShift>
export async function cancelMarketplaceShift(shiftId: string): Promise<void>
export async function getMyShifts(): Promise<MarketplaceShift[]>

// src/lib/api/broadcast.ts
export async function dispatchBroadcast(shiftId: string, providerIds: string[], channel: BroadcastChannel): Promise<BroadcastHistoryEntry>
export async function getBroadcastHistory(shiftId?: string): Promise<BroadcastHistoryEntry[]>
export async function triggerEscalation(shiftId: string): Promise<BroadcastHistoryEntry>

// src/lib/api/copilot.ts additions
export async function queryCopilotCoverage(query: string): Promise<ProviderMatch[]>
```

### New Types Required

```typescript
// src/types.ts additions
interface MarketplaceFilters {
  dateRange?: { start: string; end: string };
  shiftType?: ShiftType;
  location?: string;
  states?: ShiftLifecycleStatus[];
}

interface ProviderMatch {
  provider: Provider;
  eligibilityScore: number;
  fatigueScore: number;
  fairnessScore: number;
  reasons: string[];
}

interface BroadcastDispatchRequest {
  shiftId: string;
  providerIds: string[];
  channel: BroadcastChannel;
  message?: string;
}
```

## 5. Integration Point Mapping

### Zustand Store Integration

The marketplace and broadcast integrate with existing Zustand store at `src/store.ts`:

1. **Marketplace Shifts**: Already stored in `state.marketplaceShifts[]` - existing functions `postShiftForCoverage`, `transitionShiftLifecycle` handle lifecycle
2. **Broadcast History**: Already stored in `state.broadcastHistory[]` - existing functions `addBroadcastEntry`, `updateBroadcastRecipientStatus`
3. **Escalation Config**: Already stored in `state.escalationConfig` - existing function `updateEscalationConfig`

**NEW**: Need to add:
- `claimShift` → calls `transitionShiftLifecycle(shiftId, "CLAIMED")`, then auto-approve if `provider.autoApproveClaims`
- `approveShift` → calls `transitionShiftLifecycle(shiftId, "APPROVED")`
- Fatigue calculation in provider update middleware

### API Routes to Add in server.js

All new routes follow existing patterns (async handlers with try/catch, JSON responses):

```javascript
// After existing /api/shift-requests routes (~line 877)
app.get("/api/marketplace/shifts", ...)
app.post("/api/marketplace/shifts", ...)
app.post("/api/marketplace/shifts/:id/claim", ...)
app.post("/api/marketplace/shifts/:id/approve", ...)

// After existing /api/notifications routes (~line 1022)
app.post("/api/broadcast/dispatch", ...)
app.get("/api/broadcast/history", ...)
app.post("/api/broadcast/escalate/:shiftId", ...)

// After existing /api/copilot/chat (~line 1656)
app.post("/api/copilot/query", ...)
```

### Similar Multi-Component Integration Patterns

Reference implementations in codebase:
- `src/components/ShiftSwapMarketplace.tsx` - Existing marketplace UI (extend for new features)
- `src/components/CopilotPanel.tsx` - Existing copilot panel (use as template for drawer)
- `src/components/NotificationCenter.tsx` - Notification display (extend for broadcast)

## 6. Risk Assessment

### HIGH Risk Technical Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Notification service timeout** | Broadcast dispatch fails silently | Add retry logic with exponential backoff (max 3 retries), queue failed dispatches for manual retry |
| **Auto-escalation timer precision** | Timers may drift in background tabs | Use server-side timestamps for escalation logic, validate on each request |
| **JSON file concurrency** | Race conditions when multiple users modify marketplace | Add file locking or use atomic writes |
| **Large broadcast lists** | Performance degradation with many providers | Implement pagination for broadcast history |
| **State machine race conditions** | Invalid transitions if multiple actions on same shift | Add optimistic locking with version field |

### MEDIUM Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Fatigue metrics staleness** | Fatigue data may be outdated | Recalculate on each schedule load |
| **Mobile responsive issues** | Touch targets too small | Enforce 44px minimum, use mobile-first CSS |
| **Notification delivery tracking** | Can't reliably detect delivery | Use webhooks for status updates where available |

### LOW Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Copilot query parsing** | May misparse complex queries | Return confidence score, allow manual override |
| **Filter performance** | Slow with many shifts | Add client-side memoization |

## 7. Dependencies

### Already Available

- React 18, TypeScript, Vite
- Zustand for state management
- Express for backend
- Existing AI scaffold (naturalLanguageQuery.ts)
- Existing notification service (notification-service.js)
- JSON file persistence

### Need to Install (if any)

- None required - all features use existing dependencies

## 8. Implementation Order

1. **Phase 1**: Backend API routes (marketplace, broadcast, copilot query)
2. **Phase 2**: API clients in frontend
3. **Phase 3**: Marketplace components (MyShifts, ShiftBoard)
4. **Phase 4**: Broadcast components (BroadcastPanel, EscalationTracker)
5. **Phase 5**: Copilot drawer and query integration
6. **Phase 6**: Provider profile enhancements (fatigue, preferences)
7. **Phase 7**: Integration and testing
