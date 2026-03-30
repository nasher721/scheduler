# Research: Smart Neuro ICU Hub - AI-Powered Medical Scheduling

## Project Context
- **Project**: Neuro ICU Scheduler - Full-stack medical shift scheduling
- **Stack**: React 18 + TypeScript (Vite), Express backend, Zustand state, JSON persistence
- **Goal**: Create reusable skill for building AI-powered scheduling with NLP, notifications, marketplace, and PWA

## Research Areas

### 1. Natural Language Query Processing for Medical Scheduling

**Existing Implementation Analysis:**
- Located: `src/lib/ai/naturalLanguageQuery.ts`
- Implements: Pattern-based intent detection with regex matching
- Supported intents: FIND_PROVIDER_SCHEDULE, FIND_DATE_SCHEDULE, FIND_NEXT_SHIFT, COUNT_SHIFTS, CHECK_AVAILABILITY, FIND_UNFILLED, SHOW_STATISTICS, COMPARE_PROVIDERS
- Pattern matching: Date patterns (today, tomorrow, weekdays), shift types (day, night, nmet, consults, jeopardy)
- Provider extraction: "Dr. Name" or last name matching

**Key Patterns:**
- Parse → Execute pipeline
- Confidence scoring for intent detection
- Entity extraction (provider, date, shift type)
- Hook interface: `useNaturalLanguageQuery(providers, slots)`

**Enhancement Opportunities:**
- LLM-powered intent classification for complex queries
- Context-aware follow-up queries
- Medical domain-specific vocabulary
- Temporal reasoning (e.g., "3rd week of April")

### 2. Real-Time Notification Services

**Existing Types** (from marketplace.types.test.ts):
- `BroadcastChannel`: "sms" | "email" | "push"
- `BroadcastRecipient`: tracks sentAt, viewedAt, respondedAt
- `BroadcastHistoryEntry`: tier, recipients, status

**Existing API** (from notifications.ts):
- `sendNotification()` - Supabase insert
- `listNotificationHistory()` - paginated history
- `updateNotification()` - PATCH
- `deleteNotification()` - DELETE

**Backend Endpoints:**
- `GET /api/notifications/channels` - list adapters
- `POST /api/notifications/send` - dispatch alerts
- `GET /api/notifications/history` - query history

**Environment Variables:**
- `NOTIFY_WEBHOOK_URL`
- `NOTIFY_SLACK_WEBHOOK_URL`
- `NOTIFY_TEAMS_WEBHOOK_URL`
- `NOTIFY_EMAIL_WEBHOOK_URL`
- `NOTIFY_SMS_WEBHOOK_URL`

**Enhancement Opportunities:**
- Push notifications via Service Worker (PWA)
- WebSocket for real-time updates
- Delivery receipts and retry logic
- Tiered escalation system

### 3. Provider Marketplace/Swapping Systems

**Shift Lifecycle States:**
- POSTED → AI_EVALUATING → BROADCASTING → CLAIMED → APPROVED → CANCELLED

**MarketplaceShift Type:**
```typescript
{
  id: string;
  slotId: string;
  postedByProviderId: string;
  date: string;
  shiftType: string;
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

**Escalation Config:**
- `autoEscalationDelayMinutes`: 60 (default)
- `maxEscalationTiers`: 3 (default)

**Backend Routes (tested):**
- Marketplace API endpoints exist in server

### 4. Fatigue Tracking and Constraint Optimization

**FatigueMetrics Type:**
```typescript
{
  consecutiveShiftsWorked: number;
  shiftsThisMonth: number;
}
```

**Existing Constraint Solver:** `src/lib/ai/constraintSolver.ts`

**Backend AI Endpoints:**
- `POST /api/ai/optimize` - constraint solving
- `POST /api/ai/recommendations` - ranked suggestions
- `GET /api/solver/profiles` - optimization profiles
- Supports `?useSolver=true` for CP-SAT routing

**Greedy Assignment Rules:**
- Skill match
- Time-off avoidance
- Duplicate-day protection
- MAX_SHIFTS_PER_WEEK constraint

**Enhancement Opportunities:**
- More sophisticated fatigue scoring
- Historical pattern analysis
- Predictive fatigue modeling
- Provider preference learning

### 5. Progressive Web App Mobile Experience

**Existing Implementation:** `src/lib/pwa/`
- `pushNotifications.ts` - Push notification handling
- `serviceWorker.ts` - Service worker registration

**PWA Features:**
- Service worker for offline support
- Push notification infrastructure
- Offline-safe persistence (localStorage + server sync)

**Enhancement Opportunities:**
- Deep linking for push notifications
- Mobile-optimized UI components
- Offline-first marketplace interactions
- Background sync for shift claims

## Architecture Integration Points

### Data Flow (from design spec):
1. Provider posts shift needing coverage
2. AI Copilot evaluates constraints (fatigue, overtime) → top 3 eligible
3. Broadcast system sends targeted notifications
4. Provider accepts via Marketplace
5. AI Copilot updates schedule → broadcasts confirmations

### Component Architecture:
- **Neurointensivist (Marketplace)**: My Shifts, Personal Shift Board, Push Notifications
- **Admin (Command Center)**: Copilot Chat Drawer, 1-Click Broadcast, Live Escalation Tracker

### State Management:
- Zustand store with enhanced slices
- JSON persistence (schedule-state.json)
- Broadcast-history slice for tracking

## Key Implementation Considerations

### NLP Processing
- Use existing pattern-based approach as baseline
- Consider LLM integration for complex queries
- Maintain confidence scoring for fallback

### Notifications
- Leverage existing webhook infrastructure
- Build tiered escalation on top of history tracking
- Service Worker integration for PWA push

### Marketplace
- Shift lifecycle state machine is defined
- Build API endpoints and UI components
- Implement auto-escalation logic

### Constraints
- Extend existing constraint solver
- Add fatigue scoring algorithm
- Provider preference learning

### PWA
- Build mobile-optimized views
- Implement deep linking
- Add background sync

## Dependencies to Leverage
- Existing AI scaffold (naturalLanguageQuery, constraintSolver, predictiveAnalytics)
- Existing notification API
- Zustand for state management
- Express backend for API
- Service Worker for PWA
