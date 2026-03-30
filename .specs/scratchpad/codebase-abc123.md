# Scratchpad: Smart Neuro ICU Hub Implementation

## Date: 2026-03-30

## 1. Existing Types (Already Defined in src/types.ts)
```
ShiftLifecycleStatus: POSTED | AI_EVALUATING | BROADCASTING | CLAIMED | APPROVED | CANCELLED
MarketplaceShift: { id, slotId, postedByProviderId, date, shiftType, location, lifecycleState, ... }
BroadcastHistoryEntry: { id, marketplaceShiftId, tier, recipients, sentAt, channel, status }
BroadcastRecipient: { id, providerId, channel, sentAt, viewedAt, respondedAt }
CommunicationPreferences: { sms: boolean, email: boolean, push: boolean }
FatigueMetrics: { consecutiveShiftsWorked: number, shiftsThisMonth: number }
```

## 2. Existing Store Functions (src/store.ts)
- `postShiftForCoverage(slotId, providerId, notes)` → creates POSTED shift
- `transitionShiftLifecycle(shiftId, newState)` → enforces valid transitions
- `cancelMarketplaceShift(shiftId)` → only in POSTED/CLAIMED
- `addBroadcastEntry(shiftId, recipients, channel)` → creates broadcast history
- `updateBroadcastRecipientStatus(entryId, providerId, status)`
- `updateEscalationConfig(config)`

## 3. Existing API Routes (server.js)
- GET/POST/PATCH /api/shift-requests
- GET /api/notifications/channels
- POST /api/notifications/send
- GET /api/notifications/history
- POST /api/copilot/chat
- POST /api/copilot/intent
- GET/POST /api/ai/*

## 4. Existing AI Components
- NaturalLanguageInterface.tsx (existing)
- naturalLanguageQuery.ts (query parser)
- PredictiveAnalyticsDashboard.tsx

## 5. Key Data Files (JSON persistence)
- data/shift-requests.json
- data/notification-history.json
- data/email-events.json

## 6. Notes for Implementation
- Provider type already has: communicationPreferences, fatigueMetrics, autoApproveClaims fields
- ShiftSlot has all needed fields for marketplace integration
- State machine validation exists in store
- Tests already written for lifecycle and broadcast slices
