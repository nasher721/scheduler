# Architecture Scratchpad: Smart Neuro ICU Hub

**Generated:** 2026-03-30
**Task:** implement-smart-neuro-icu-hub.feature.md

---

## 1. Solution Strategy

### High-Level Approach

The Smart Neuro ICU Hub combines three core systems into a unified scheduling ecosystem:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Smart Neuro ICU Hub                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│   │  Provider   │───▶│   AI        │───▶│  Broadcast │───▶│ Marketplace │ │
│   │  Posts Shift│    │  Copilot    │    │  Service   │    │   Claims    │ │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                  │                  │           │
│         ▼                  ▼                  ▼                  ▼           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │              Shift Lifecycle State Machine                         │   │
│   │   POSTED → AI_EVALUATING → BROADCASTING → CLAIMED → APPROVED      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Responsibility | Key Technologies |
|-----------|----------------|------------------|
| **AI Copilot** | Natural language queries, eligibility scoring, fatigue-aware recommendations | Pattern-based NLP + existing `naturalLanguageQuery.ts` |
| **Broadcast Service** | Multi-channel notifications (SMS/Email/Push), tiered auto-escalation | Webhook-based (existing), Service Worker push |
| **Provider Marketplace** | Shift board, claim/approve workflow, My Shifts view | Zustand store + React components |
| **Fatigue Engine** | Consecutive shifts, monthly limits, eligibility blocking | `useFatigueCheck` hook |
| **State Machine** | Lifecycle enforcement, audit logging | `transitionShiftLifecycle` (existing) |

---

## 2. Key Architectural Decisions

### Technology Choices

| Decision | Rationale |
|----------|-----------|
| **Extend existing Zustand store** | Avoids new state management; `marketplaceShifts[]` and `broadcastHistory[]` already exist |
| **Pattern-based NLP (no LLM)** | Deterministic fallback, <2s response time, no external API dependency |
| **Webhook-based notifications** | Leverages existing `NOTIFY_*_WEBHOOK_URL` env vars; SMS/Email/Push unified |
| **Server-side escalation timestamps** | Prevents drift in background tabs; validated on each request |
| **JSON file persistence** | No database changes; `data/marketplace-shifts.json`, `data/broadcast-history.json` |

### State Machine Design

```
POSTED ──(AI evaluation)──▶ AI_EVALUATING ──(eligible providers found)──▶ BROADCASTING
    │                              │                                       │
    │                              │                                       │
    ▼                              ▼                                       ▼
(CANCELLED)              (no eligible providers)              (provider claims)
                                                            │
                                                            ▼
                                                    CLAIMED ──(approve)──▶ APPROVED
                                                    │
                                                    ▼
                                              (auto-approve if
                                               provider.autoApproveClaims)
```

**Valid Transitions:**
- POSTED → AI_EVALUATING
- AI_EVALUATING → BROADCASTING
- BROADCASTING → CLAIMED
- CLAIMED → APPROVED
- POSTED/CLAIMED → CANCELLED

---

## 3. Component Architecture

### Frontend Components

```
src/components/
├── SmartHub.tsx                    # Main hub (entry point)
├── copilot/
│   ├── CopilotChatDrawer.tsx       # NLP interface
│   └── CopilotQueryResult.tsx      # Ranked providers display
├── marketplace/
│   ├── ShiftBoard.tsx              # Open shifts grid/list
│   ├── MyShifts.tsx                # Provider's assigned shifts
│   ├── ShiftCard.tsx               # Individual shift card
│   ├── MarketplaceFilters.tsx      # Date/type/location filters
│   └── ClaimConfirmationModal.tsx  # Claim dialog
├── broadcast/
│   ├── BroadcastPanel.tsx          # Admin broadcast controls
│   ├── EscalationTracker.tsx       # Live tier status
│   └── BroadcastHistoryList.tsx    # History display
└── profiles/
    ├── ProviderProfileEditor.tsx   # Preferences/fatigue display
    └── FatigueIndicator.tsx        # Visual warning component
```

### Backend Routes (server.js additions)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/marketplace/shifts` | GET | List shifts (filter: status, providerId, date) |
| `/api/marketplace/shifts` | POST | Create POSTED shift |
| `/api/marketplace/shifts/:id/claim` | POST | Transition to CLAIMED |
| `/api/marketplace/shifts/:id/approve` | POST | Transition to APPROVED |
| `/api/marketplace/shifts/:id/cancel` | POST | Cancel (POSTED/CLAIMED only) |
| `/api/marketplace/my-shifts` | GET | Current provider's shifts |
| `/api/broadcast/dispatch` | POST | Send notifications |
| `/api/broadcast/history` | GET | Query broadcast log |
| `/api/broadcast/escalate/:shiftId` | POST | Trigger next tier |
| `/api/copilot/query` | POST | NLP coverage query |

### Store Integration (existing structure)

```typescript
// src/store.ts - already has:
state.marketplaceShifts: MarketplaceShift[]    // line 359
state.broadcastHistory: BroadcastHistoryEntry[] // line 360
state.escalationConfig                         // line ~360

// Add functions:
- claimShift(shiftId, providerId)    // POSTED → CLAIMED
- approveShift(shiftId, approvedBy)  // CLAIMED → APPROVED
- getEligibleProviders(slotId)       // AI evaluation
```

---

## 4. Data Flow

### Primary Flow: Shift Posted → Claimed → Approved

```
1. PROVIDER POSTS SHIFT
   └─ POST /api/marketplace/shifts { slotId, notes }
   └─ Store: marketplaceShifts.push(newShift)
   └─ State: POSTED

2. AI COPILOT EVALUATION
   └─ POST /api/copilot/query { "Who can cover Dr. Smith tomorrow?" }
   └─ Parse: extracts providerId="smith", date (tomorrow)
   └─ Score: fatigue-adjusted fairness (fewest shiftsThisMonth)
   └─ Return: top 3 eligible providers

3. BROADCAST NOTIFICATION
   └─ POST /api/broadcast/dispatch { shiftId, providerIds[], channel }
   └─ For each provider:
      ├─ Check communicationPreferences
      └─ Send via preferred channel (SMS/Email/Push)
   └─ Store: broadcastHistory.push(entry)
   └─ State: POSTED → AI_EVALUATING → BROADCASTING

4. PROVIDER CLAIMS
   └─ POST /api/marketplace/shifts/:id/claim { providerId }
   └─ Fatigue check: block if consecutiveShiftsWorked >= 7
   └─ Auto-approve: if provider.autoApproveClaims = true
   └─ State: BROADCASTING → CLAIMED → (APPROVED)

5. APPROVAL COMPLETE
   └─ POST /api/marketplace/shifts/:id/approve { approvedBy }
   └─ Update schedule slot assignment
   └─ State: CLAIMED → APPROVED
```

### Escalation Flow

```
T+0:   Initial broadcast to Tier 1 (top 3 providers)
T+60m: Auto-escalation check (if no response)
       └─ Tier 2: next 3 providers notified
       └─ BroadcastHistoryEntry.tier = 2
T+120m: Auto-escalation check
       └─ Tier 3: final providers notified
T+180m: Max tier reached (3)
       └─ Stop escalation, mark shift as "needs attention"
```

---

## 5. Integration Points

### Existing System Integration

| Integration | Point | Method |
|-------------|-------|--------|
| **Zustand Store** | `src/store.ts` | Extend with `claimShift`, `approveShift`, fatigue middleware |
| **AI Scaffold** | `src/lib/ai/naturalLanguageQuery.ts` | Extend with `FIND_COVERAGE_OPTIONS`, `FIND_ELIGIBLE_PROVIDERS` intents |
| **Notifications** | `server.js` existing `/api/notifications/*` | Extend `/api/notifications/send` for broadcast |
| **Provider Profiles** | `src/types.ts` existing `Provider` | Add `communicationPreferences`, `fatigueMetrics`, `autoApproveClaims` |
| **PWA Push** | `src/lib/pwa/pushNotifications.ts` | Extend for marketplace shift notifications |
| **JSON Persistence** | `data/schedule-state.json` | Already stores marketplaceShifts, broadcastHistory |

### Type Extensions Required

```typescript
// src/types.ts - add to existing Provider interface
interface Provider {
  // ... existing fields
  communicationPreferences?: {
    sms: boolean;
    email: boolean;
    push: boolean;
  };
  fatigueMetrics?: {
    consecutiveShiftsWorked: number;
    shiftsThisMonth: number;
  };
  autoApproveClaims?: boolean;
}

// New types
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
```

---

## 6. Expected Changes

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/components/SmartHub.tsx` | Main hub entry |
| `src/components/marketplace/ShiftBoard.tsx` | Open shifts view |
| `src/components/marketplace/MyShifts.tsx` | Provider's shifts |
| `src/components/marketplace/ShiftCard.tsx` | Shift display |
| `src/components/marketplace/MarketplaceFilters.tsx` | Filters |
| `src/components/copilot/CopilotChatDrawer.tsx` | NLP UI |
| `src/components/broadcast/BroadcastPanel.tsx` | Admin UI |
| `src/components/broadcast/EscalationTracker.tsx` | Live status |
| `src/hooks/useFatigueCheck.ts` | Fatigue calculation |
| `src/hooks/useMarketplace.ts` | Marketplace ops |
| `src/hooks/useBroadcast.ts` | Broadcast ops |
| `src/lib/api/marketplace.ts` | API client |
| `src/lib/api/broadcast.ts` | API client |
| `data/marketplace-shifts.json` | Persistence |
| `data/broadcast-history.json` | Persistence |

### Files to MODIFY

| File | Changes |
|------|---------|
| `src/store.ts` | Add `claimShift`, `approveShift`, fatigue middleware |
| `src/types.ts` | Add `communicationPreferences`, `fatigueMetrics`, `autoApproveClaims` to Provider |
| `server.js` | Add 10 new API routes (see section 3) |
| `src/components/App.tsx` | Add SmartHub route/tab |
| `src/lib/ai/naturalLanguageQuery.ts` | Extend intents |
| `src/lib/pwa/pushNotifications.ts` | Deep linking for shift claims |

---

## 7. Risk Mitigation Summary

| Risk | Mitigation |
|------|------------|
| Notification timeout | Retry with exponential backoff (max 3), queue failures |
| Escalation timer drift | Server-side timestamps, validate on request |
| JSON concurrency | Atomic writes, consider file locking |
| State machine race | Optimistic locking with version field |
| Fatigue staleness | Recalculate on schedule load |

---

## 8. Implementation Phases

1. **Phase 1:** Backend routes + API clients
2. **Phase 2:** Marketplace components (MyShifts, ShiftBoard)
3. **Phase 3:** Broadcast components + escalation
4. **Phase 4:** Copilot drawer + query integration
5. **Phase 5:** Provider profile enhancements
6. **Phase 6:** Integration + E2E testing
