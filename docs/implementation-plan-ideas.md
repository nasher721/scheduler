# NICU Scheduler - Competitive Differentiation Plan

## Executive Summary

This plan executes three high-probability ideas (probability > 0.80) to make the NICU Scheduler competitive through simplicity and functionality:

1. **One-Click Smart Schedule Generation** - AI-powered auto-scheduling
2. **Real-Time Staff Availability Dashboard** - Live coverage visualization  
3. **Mobile-First Shift Trading** - Streamlined shift marketplace

---

## Idea 1: One-Click Smart Schedule Generation

### Problem Solved
Manual scheduling takes hours of drag-and-drop. Existing AI endpoints exist but require multi-step interactions.

### Solution
Single button triggers the existing constraint solver, AI optimizer, and applies results automatically.

### Implementation Tasks

#### 1.1 Frontend Auto-Schedule Button Component
- [ ] **Task A**: Create `AutoScheduleButton.tsx` component
  - Location: `src/components/AutoScheduleButton.tsx`
  - Features: Single click trigger, loading state, progress indicator
  - Design: Prominent button in toolbar, disabled when no providers
  
- [ ] **Task B**: Add to main schedule view
  - Location: `src/components/Calendar.tsx` or new toolbar
  - Integrate button near "Auto Assign" existing action

#### 1.2 API Integration
- [ ] **Task C**: Wire to existing `/api/ai/optimize` endpoint
  - Location: `src/lib/api/scheduleApi.ts`
  - Use existing `optimizeSchedule()` function if present
  
- [ ] **Task D**: Create optimization result handler
  - Handle `POST /api/ai/apply` for auto-apply
  - Support rollback on failure

#### 1.3 Constraint Configuration
- [ ] **Task E**: Build constraint priority UI
  - Location: New settings panel component
  - Options: Coverage priority, fairness, preferences
  - Persist to localStorage/API

### Dependencies
- Existing: `/api/ai/optimize` endpoint (Phase 9 complete)
- Existing: Constraint solver in backend
- New: Frontend button + progress UI

### Verification
- Button generates valid schedule in < 10 seconds
- All hard constraints satisfied (skill match, coverage)
- No duplicate assignments

---

## Idea 2: Real-Time Staff Availability Dashboard

### Problem Solved
Managers cannot see at a glance who is available, on leave, or working right now.

### Solution
Visual dashboard with color-coded status indicators per provider.

### Implementation Tasks

#### 2.1 Status Types & Data Model
- [ ] **Task A**: Define provider status enum
  - Location: `src/types/index.ts`
  - Types: `AVAILABLE`, `ON_SHIFT`, `ON_LEAVE`, `ON_CALL`, `UNAVAILABLE`
  
- [ ] **Task B**: Add status to Provider type
  - Location: `src/types/index.ts`
  - Field: `currentStatus: ProviderStatus`
  - Auto-computed from today's assignments

#### 2.2 Availability Panel Component
- [ ] **Task C**: Create `StaffAvailabilityPanel.tsx`
  - Location: `src/components/ProviderAvailabilityPanel.tsx` (exists - enhance)
  - Features: Grid/list view toggle, filter by status, search
  - Visual: Color dots (green=available, red=unavailable, blue=on shift)
  
- [ ] **Task D**: Add to main layout
  - Location: `src/App.tsx` or sidebar
  - Collapsible panel, persisted state

#### 2.3 Live Coverage Metrics
- [ ] **Task E**: Create coverage summary widget
  - Location: `src/components/CoverageSummary.tsx` (new)
  - Metrics: Positions filled vs required, critical gaps highlighted
  - Update on schedule changes

#### 2.4 Real-Time Updates (Phase 2)
- [ ] **Task F**: WebSocket connection for live updates
  - Location: `src/lib/pwa/` or new WebSocket hook
  - Events: Shift changes, status updates
  - Fallback: Polling every 30 seconds

### Dependencies
- Existing: Provider data in store
- Existing: Shift assignments in store
- New: Status computation logic, UI components

### Verification
- Panel shows correct status for all providers
- Coverage metrics match actual schedule
- UI responsive on mobile

---

## Idea 3: Mobile-First Shift Trading

### Problem Solved
Existing shift marketplace works but isn't optimized for mobile one-tap interactions.

### Solution
Streamlined mobile UI with one-tap swap requests and push notifications.

### Implementation Tasks

#### 3.1 Mobile Optimization
- [ ] **Task A**: Create responsive marketplace layout
  - Location: `src/components/marketplace/MarketplaceFilters.tsx` (enhance)
  - Mobile: Full-width cards, touch-friendly buttons (min 44px)
  - Desktop: Existing grid layout preserved

#### 3.2 One-Tap Swap Flow
- [ ] **Task B**: Create quick-swap modal
  - Location: `src/components/marketplace/QuickSwapModal.tsx` (new)
  - Flow: Select my shift → One tap to post → Auto-suggest matches
  - Confirmation: Single button "Post for Coverage"

#### 3.3 Push Notifications
- [ ] **Task C**: Integrate push notification hook
  - Location: `src/hooks/usePushNotifications.ts` (new)
  - Triggers: Swap request received, swap approved, shift reminder
  - Use existing: `src/lib/pwa/pushNotifications.ts`
  
- [ ] **Task D**: Add notification preferences UI
  - Location: Settings panel
  - Options: Enable/disable per type, quiet hours

#### 3.4 Manager Quick Actions
- [ ] **Task E**: Add swipe-to-approve for managers
  - Location: `src/components/ShiftSwapBoard.tsx`
  - Mobile: Swipe left approve, swipe right reject
  - Desktop: Click buttons (preserve)

#### 3.5 Offline Support
- [ ] **Task F**: Queue actions when offline
  - Location: `src/lib/pwa/offlineMode.ts` (enhance)
  - Store pending swaps locally, sync on reconnect

### Dependencies
- Existing: MarketplaceShift type, swap request logic
- Existing: Push notification scaffold
- New: Quick-swap modal, mobile optimizations

### Verification
- Mobile: Complete swap flow in < 3 taps
- Notifications: Received within 5 seconds
- Offline: Actions queue properly

---

## Implementation Timeline

### Phase 1: Core Features (Week 1)
| Task | Description | Effort |
|------|-------------|--------|
| 1.1A | AutoScheduleButton component | 2 hours |
| 1.1B | Integrate into Calendar view | 1 hour |
| 1.2A | Wire to /api/ai/optimize | 2 hours |
| 2.1A | Provider status enum | 30 min |
| 2.2A | AvailabilityPanel component | 3 hours |
| 3.1A | Responsive marketplace | 2 hours |
| 3.2A | Quick-swap modal | 3 hours |

### Phase 2: Integration (Week 2)
| Task | Description | Effort |
|------|-------------|--------|
| 1.2B | Constraint configuration UI | 2 hours |
| 2.2B | Add to main layout | 1 hour |
| 2.3A | Coverage summary widget | 2 hours |
| 3.3A | Push notification integration | 3 hours |
| 3.4A | Swipe-to-approve | 2 hours |

### Phase 3: Polish (Week 3)
| Task | Description | Effort |
|------|-------------|--------|
| 1.3 | Testing & edge cases | 3 hours |
| 2.4 | WebSocket live updates | 4 hours |
| 3.5 | Offline support | 3 hours |
| All | Mobile responsive testing | 2 hours |

---

## Technical Considerations

### State Management
- Use existing Zustand store for all new state
- Persist panel visibility to localStorage
- Provider status computed dynamically from assignments

### API Calls
- Reuse existing `/api/ai/optimize` endpoint
- Cache availability data, refresh on schedule changes
- Batch swap notifications

### Performance
- Lazy-load availability panel
- Virtualize provider list for 100+ providers
- Debounce search filters

---

## Success Metrics

| Feature | Metric | Target |
|---------|--------|--------|
| Auto-Schedule | Time to generate schedule | < 10 seconds |
| Auto-Schedule | Constraint violations | 0 |
| Availability Panel | Time to assess coverage | < 5 seconds |
| Mobile Trading | Swaps completed per day | +50% |
| Mobile Trading | Mobile vs desktop usage | 60% mobile |

---

## File Structure Changes

```
src/
├── components/
│   ├── AutoScheduleButton.tsx     # NEW
│   ├── CoverageSummary.tsx         # NEW
│   └── marketplace/
│       └── QuickSwapModal.tsx      # NEW
├── hooks/
│   └── usePushNotifications.ts    # NEW
└── lib/
    └── api/
        └── scheduleApi.ts          # ENHANCE
```

---

## Next Steps

1. **Start with Task 1.1A** - Create the AutoScheduleButton component
2. **Parallel**: Begin Task 2.1A - Define provider status enum
3. **Iterate**: Test each feature with Playwright before proceeding
