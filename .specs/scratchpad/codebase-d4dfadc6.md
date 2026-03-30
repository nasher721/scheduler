# Codebase Scratchpad: Smart Neuro ICU Hub Feature

## File Analysis Summary

### AI Components (src/lib/ai/)

| File | Lines | Key Exports | Status |
|------|-------|-------------|--------|
| predictiveAnalytics.ts | 525 | `predictCoverage`, `forecastDemand`, `assessBurnoutRisk`, `generateStaffingRecommendations`, `generateAnalyticsDashboard` | Production-ready |
| constraintSolver.ts | 439 | `ConstraintSolver` class, `solve()`, `OptimizationConstraints`, `SolverSolution` | Production-ready |
| naturalLanguageQuery.ts | 572 | `parseQuery`, `executeQuery`, `useNaturalLanguageQuery`, `QueryIntent` types | Feature-complete |
| calendarSync.ts | - | Calendar sync utilities | N/A |

### Store & Types (src/)

| File | Key Types | Location |
|------|-----------|----------|
| store.ts | `MarketplaceShift`, `BroadcastHistoryEntry`, `EscalationConfig`, `SwapRequest`, `Notification` | Lines 84-88, 248-280 |
| types.ts | `ShiftLifecycleStatus` enum, Provider, ShiftSlot, CopilotMessage | Lines 248-280 |

### Server (server.js)

| Pattern | Usage |
|---------|-------|
| Notification endpoints | Lines 899-1037 |
| dispatchNotification | Line 30, 802, 860, 922 |
| marketplace_shifts table | Supabase integration |

### UI Components (src/components/)

| Component | Lines | Extension Target |
|-----------|-------|-----------------|
| CopilotPanel.tsx | 682 | Hub AI interface |
| MobileCopilotSheet.tsx | 313 | Hub mobile |
| ShiftSwapMarketplace.tsx | 416 | Marketplace panel |
| NotificationCenter.tsx | - | Broadcast status |
| calendar/features/AI/* | - | Analytics display |

## Key Integration Points

### 1. AI Pipeline
```
useNaturalLanguageQuery → parseQuery → executeQuery → return QueryResult
usePredictiveAnalytics → generateAnalyticsDashboard → Coverage/Burnout/Staffing
useConstraintSolver → solve() → SolverSolution with violations
```

### 2. Marketplace Lifecycle
```
POSTED → AI_EVALUATING → BROADCASTING → CLAIMED → APPROVED
         ↓ (escalation)
      CANCELLED
```

### 3. Notification Flow
```
dispatchNotification() → persistNotification() → Supabase
                    ↓
            Multi-channel (webhook, slack, email, sms)
```

### 4. Broadcast Tracking
```
addBroadcastEntry() → broadcastHistory[]
updateBroadcastRecipientStatus() → entry status update
```

## Data Structures Reference

### MarketplaceShift
```typescript
{
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

### BroadcastHistoryEntry
```typescript
{
  id: string;
  marketplaceShiftId: string;
  tier: number;
  recipients: BroadcastRecipient[];
  sentAt: string;
  channel: BroadcastChannel;
  status: "sent" | "delivered" | "failed";
}
```

### EscalationConfig
```typescript
{
  autoEscalationDelayMinutes: number;
  maxEscalationTiers: number;
}
```

## API Endpoints Reference

### Notifications
- `GET /api/notifications/channels` - List adapters
- `POST /api/notifications/send` - Manual dispatch
- `GET /api/notifications/history` - Query history
- `PATCH /api/notifications/:id` - Update status
- `POST /api/notifications/dispatch-pending-approvals` - Auto-alerts

### AI
- `POST /api/ai/recommendations`
- `POST /api/ai/optimize`
- `POST /api/ai/simulate`
- `GET /api/ai/providers`
- `GET /api/ai/metrics`

## PWA Infrastructure
- `src/lib/pwa/serviceWorker.ts` - SW registration
- `src/lib/pwa/offlineMode.ts` - Offline handling
- `src/lib/pwa/pushNotifications.ts` - Push support
- vite.config.ts - PWA plugin config

## Recommendations for Implementation

1. **Create Hub Container** - Compose existing AI/analytics into unified view
2. **Extend Copilot Commands** - Add marketplace/broadcast intents
3. **Enhance Marketplace UI** - Expand ShiftSwapMarketplace to full marketplace
4. **Broadcast Dashboard** - Visualize escalation tiers and delivery status
5. **Mobile Integration** - Leverage MobileCopilotSheet for hub access
