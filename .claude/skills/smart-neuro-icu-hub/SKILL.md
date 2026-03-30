# Smart Neuro ICU Hub - AI-Powered Scheduling Skill

## Overview

Build an AI-powered medical scheduling ecosystem for Neurointensivists featuring:
1. Natural language query processing (NLP)
2. Real-time notification services (SMS/Email/Push)
3. Provider marketplace/swapping system
4. Fatigue tracking and constraint optimization
5. Progressive Web App (PWA) mobile experience

This skill guides implementation of the "Smart Neuro ICU Hub" - an autonomous scheduling system that identifies gaps, evaluates constraints, broadcasts targeted coverage requests, and enables providers to claim shifts via self-service marketplace.

## Prerequisites

- React 18 + TypeScript + Vite
- Express backend
- Zustand state management
- JSON file persistence
- Existing AI scaffold (naturalLanguageQuery, constraintSolver, predictiveAnalytics)

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Smart Neuro ICU Hub                          │
├─────────────────┬─────────────────────┬─────────────────────────┤
│ The Brain       │ The Voice            │ The Hands              │
│ (AI Copilot)   │ (Broadcast)          │ (Marketplace)          │
├─────────────────┼─────────────────────┼─────────────────────────┤
│ • NLP Query     │ • SMS/Email/Push    │ • Shift Board          │
│ • Constraint    │ • Tiered Escalation │ • Claim/Post Shifts    │
│   Solver        │ • History Tracking  │ • Swap Requests        │
│ • Fatigue       │ • Auto-escalation   │ • Approval Workflow   │
│   Analytics     │                     │                         │
└─────────────────┴─────────────────────┴─────────────────────────┘
```

### Unified Data Flow

1. Provider posts shift needing coverage
2. AI Copilot evaluates constraints → identifies top 3 eligible providers
3. Broadcast system sends targeted notifications
4. Provider accepts via Marketplace
5. AI Copilot updates schedule → broadcasts confirmations

## Type Definitions

### Required Types (add to `src/types.ts`)

```typescript
// Communication Channels
export type BroadcastChannel = 'sms' | 'email' | 'push';

// Shift Lifecycle State Machine
export type ShiftLifecycleStatus = 
  | 'POSTED'        // Swap requested or shift dropped
  | 'AI_EVALUATING' // Copilot calculating safest/fairest replacements
  | 'BROADCASTING'  // System pinging specific providers
  | 'CLAIMED'       // Accepted by a provider
  | 'APPROVED'      // Automatically or manually confirmed
  | 'CANCELLED';    // Cancelled/expired

// Communication Preferences
export interface CommunicationPreferences {
  sms: boolean;
  email: boolean;
  push: boolean;
}

// Provider Profile Enhancement
export interface ProviderProfile {
  id: string;
  name: string;
  communicationPreferences: CommunicationPreferences;
  fatigueMetrics: FatigueMetrics;
}

// Fatigue Tracking
export interface FatigueMetrics {
  consecutiveShiftsWorked: number;
  shiftsThisMonth: number;
}

// Broadcast Recipient Tracking
export interface BroadcastRecipient {
  id: string;
  providerId: string;
  channel: BroadcastChannel;
  sentAt: string;
  viewedAt: string | null;
  respondedAt: string | null;
}

// Marketplace Shift
export interface MarketplaceShift {
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

// Broadcast History Entry
export interface BroadcastHistoryEntry {
  id: string;
  marketplaceShiftId: string;
  tier: number;
  recipients: string[];
  sentAt: string;
  channel: BroadcastChannel;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
}

// Escalation Configuration
export interface EscalationConfig {
  autoEscalationDelayMinutes: number;
  maxEscalationTiers: number;
}
```

## Feature 1: Natural Language Query Processing

### Implementation Path

#### Step 1: Extend Existing NLP Processor

Location: `src/lib/ai/naturalLanguageQuery.ts`

The existing implementation uses pattern-based intent detection. Extend it with:

```typescript
// Enhanced query intents for marketplace
export type MarketplaceIntent =
  | 'FIND_COVERAGE_OPTIONS'
  | 'POST_SHIFT_REQUEST'
  | 'CHECK_FATIGUE'
  | 'REQUEST_SWAP'
  | 'FIND_ELIGIBLE_PROVIDERS';

// Add to ParsedQuery interface
interface MarketplaceEntities {
  targetProvider?: string;
  fatigueThreshold?: number;
  eligibleProviders?: string[];
  shiftId?: string;
}
```

#### Step 2: Add Medical Domain Patterns

```typescript
const MEDICAL_PATTERNS = {
  coverage: /cover(age|s)|needs? (replacement|someone|help)/,
  fatigue: /fatigue|tired|exhausted|too many (shifts|hours)/,
  swap: /swap|trade|exchange|switch/,
  eligible: /who can|eligible|qualified|available/,
};
```

#### Step 3: Integrate with Copilot Panel

Location: `src/components/CopilotPanel.tsx`

- Add marketplace-specific commands
- Implement context-aware follow-ups
- Add fatigue warnings in responses

#### Step 4: Backend NLP Endpoint

Location: `server.js` - Add route:

```javascript
// POST /api/ai/nlp-query
app.post('/api/ai/nlp-query', async (req, res) => {
  const { query, context } = req.body;
  // Use existing naturalLanguageQuery with enhanced intents
  // Return structured response with action items
});
```

### Key Hook

```typescript
// src/hooks/useMarketplaceQuery.ts
import { useCallback } from 'react';
import { parseQuery, executeQuery } from '@/lib/ai/naturalLanguageQuery';
import type { Provider, ShiftSlot, MarketplaceShift } from '@/types';

export function useMarketplaceQuery(
  providers: Provider[],
  slots: ShiftSlot[],
  marketplaceShifts: MarketplaceShift[]
) {
  const ask = useCallback((query: string) => {
    const parsed = parseQuery(query, providers);
    // Add marketplace-specific intent detection
    const result = executeQuery(parsed, providers, slots);
    return result;
  }, [providers, slots]);

  return { ask };
}
```

## Feature 2: Real-Time Notification Services

### Implementation Path

#### Step 1: Notification Service Architecture

Location: `src/lib/notifications/notificationService.ts`

```typescript
import type { BroadcastChannel, BroadcastRecipient } from '@/types';

export interface NotificationPayload {
  title: string;
  body: string;
  channels: BroadcastChannel[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  channel: BroadcastChannel;
  recipientId: string;
  messageId?: string;
  error?: string;
}

class NotificationService {
  async send(payload: NotificationPayload, recipients: string[]): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    
    for (const channel of payload.channels) {
      for (const recipientId of recipients) {
        const result = await this.sendToChannel(channel, recipientId, payload);
        results.push(result);
      }
    }
    
    return results;
  }

  private async sendToChannel(
    channel: BroadcastChannel,
    recipientId: string,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    switch (channel) {
      case 'push':
        return this.sendPush(recipientId, payload);
      case 'email':
        return this.sendEmail(recipientId, payload);
      case 'sms':
        return this.sendSMS(recipientId, payload);
    }
  }

  private async sendPush(recipientId: string, payload: NotificationPayload) {
    // Use Service Worker push API
    // See: src/lib/pwa/pushNotifications.ts
  }

  private async sendEmail(recipientId: string, payload: NotificationPayload) {
    // Use webhook: NOTIFY_EMAIL_WEBHOOK_URL
  }

  private async sendSMS(recipientId: string, payload: NotificationPayload) {
    // Use webhook: NOTIFY_SMS_WEBHOOK_URL
  }
}

export const notificationService = new NotificationService();
```

#### Step 2: Tiered Escalation System

Location: `src/lib/notifications/escalationManager.ts`

```typescript
import type { 
  MarketplaceShift, 
  BroadcastRecipient, 
  EscalationConfig,
  BroadcastHistoryEntry 
} from '@/types';

export class EscalationManager {
  private config: EscalationConfig;

  constructor(config: EscalationConfig = { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 }) {
    this.config = config;
  }

  async checkAndEscalate(
    shift: MarketplaceShift,
    recipients: BroadcastRecipient[]
  ): Promise<BroadcastHistoryEntry | null> {
    const timeSincePosted = Date.now() - new Date(shift.postedAt).getTime();
    const delayMs = this.config.autoEscalationDelayMinutes * 60 * 1000;
    
    if (timeSincePosted < delayMs) return null;
    
    const currentTier = this.calculateCurrentTier(recipients);
    if (currentTier >= this.config.maxEscalationTiers) return null;
    
    // Trigger next tier
    return this.escalateToNextTier(shift, currentTier + 1);
  }

  private calculateCurrentTier(recipients: BroadcastRecipient[]): number {
    // Calculate based on response rates
    return 1;
  }

  private async escalateToNextTier(
    shift: MarketplaceShift,
    tier: number
  ): Promise<BroadcastHistoryEntry> {
    // Get next tier of eligible providers
    // Send notifications
    // Return broadcast history entry
  }
}
```

#### Step 3: Broadcast History Slice

Location: `src/store/broadcastSlice.ts` (add to Zustand store)

```typescript
import { create } from 'zustand';
import type { BroadcastHistoryEntry, MarketplaceShift } from '@/types';

interface BroadcastState {
  history: BroadcastHistoryEntry[];
  activeBroadcasts: Map<string, BroadcastHistoryEntry>;
  
  addBroadcast: (entry: BroadcastHistoryEntry) => void;
  updateBroadcast: (id: string, updates: Partial<BroadcastHistoryEntry>) => void;
  getBroadcastsForShift: (shiftId: string) => BroadcastHistoryEntry[];
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  history: [],
  activeBroadcasts: new Map(),
  
  addBroadcast: (entry) => set((state) => ({
    history: [...state.history, entry],
    activeBroadcasts: new Map(state.activeBroadcasts).set(entry.marketplaceShiftId, entry)
  })),
  
  updateBroadcast: (id, updates) => set((state) => ({
    history: state.history.map(e => e.id === id ? { ...e, ...updates } : e)
  })),
  
  getBroadcastsForShift: (shiftId) => 
    get().history.filter(e => e.marketplaceShiftId === shiftId)
}));
```

#### Step 4: Push Notification Integration

Location: `src/lib/pwa/pushNotifications.ts` - Extend existing

```typescript
// Request push notification permission
export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Subscribe to push notifications
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });
}

// Handle incoming push notification
export function setupPushNotificationHandler(
  onNotification: (payload: unknown) => void
) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PUSH_NOTIFICATION') {
      onNotification(event.data.payload);
    }
  });
}
```

### Backend Notification Endpoints

Add to `server.js`:

```javascript
// GET /api/notifications/channels
app.get('/api/notifications/channels', (req, res) => {
  res.json({
    channels: [
      { id: 'sms', configured: !!process.env.NOTIFY_SMS_WEBHOOK_URL },
      { id: 'email', configured: !!process.env.NOTIFY_EMAIL_WEBHOOK_URL },
      { id: 'push', configured: true },
      { id: 'slack', configured: !!process.env.NOTIFY_SLACK_WEBHOOK_URL },
      { id: 'teams', configured: !!process.env.NOTIFY_TEAMS_WEBHOOK_URL },
    ]
  });
});

// POST /api/notifications/send
app.post('/api/notifications/send', async (req, res) => {
  const { title, body, channels, recipientIds, metadata } = req.body;
  // Implement notification dispatch
});

// GET /api/notifications/history
app.get('/api/notifications/history', (req, res) => {
  const { shiftId, limit = 50 } = req.query;
  // Return broadcast history
});
```

## Feature 3: Provider Marketplace

### Implementation Path

#### Step 1: Marketplace Store Slice

Location: `src/store/marketplaceSlice.ts`

```typescript
import { create } from 'zustand';
import type { MarketplaceShift, ShiftLifecycleStatus } from '@/types';

interface MarketplaceState {
  shifts: MarketplaceShift[];
  loading: boolean;
  
  // Actions
  postShift: (slotId: string, notes: string) => Promise<void>;
  claimShift: (shiftId: string, providerId: string) => Promise<void>;
  approveClaim: (shiftId: string, approvedBy: string) => Promise<void>;
  cancelShift: (shiftId: string) => Promise<void>;
  loadShifts: () => Promise<void>;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  shifts: [],
  loading: false,
  
  postShift: async (slotId, notes) => {
    const response = await fetch('/api/marketplace/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, notes })
    });
    const newShift = await response.json();
    set(state => ({ shifts: [...state.shifts, newShift] }));
  },
  
  claimShift: async (shiftId, providerId) => {
    await fetch(`/api/marketplace/shifts/${shiftId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId })
    });
    set(state => ({
      shifts: state.shifts.map(s => 
        s.id === shiftId 
          ? { ...s, lifecycleState: 'CLAIMED' as ShiftLifecycleStatus, claimedByProviderId: providerId }
          : s
      )
    }));
  },
  
  approveClaim: async (shiftId, approvedBy) => {
    await fetch(`/api/marketplace/shifts/${shiftId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy })
    });
    set(state => ({
      shifts: state.shifts.map(s =>
        s.id === shiftId
          ? { ...s, lifecycleState: 'APPROVED' as ShiftLifecycleStatus, approvedBy, approvedAt: new Date().toISOString() }
          : s
      )
    }));
  },
  
  cancelShift: async (shiftId) => {
    await fetch(`/api/marketplace/shifts/${shiftId}/cancel`, { method: 'POST' });
    set(state => ({
      shifts: state.shifts.map(s =>
        s.id === shiftId
          ? { ...s, lifecycleState: 'CANCELLED' as ShiftLifecycleStatus }
          : s
      )
    }));
  },
  
  loadShifts: async () => {
    set({ loading: true });
    const response = await fetch('/api/marketplace/shifts');
    const shifts = await response.json();
    set({ shifts, loading: false });
  }
}));
```

#### Step 2: Marketplace UI Components

Location: `src/components/marketplace/`

```
marketplace/
├── ShiftBoard.tsx        // Main marketplace view
├── ShiftCard.tsx         // Individual shift display
├── PostShiftModal.tsx    // Post new shift for coverage
├── ClaimShiftButton.tsx // Claim action
├── MyShiftsList.tsx     // Provider's own shifts
└── EscalationTracker.tsx // Live broadcast status
```

Example ShiftBoard component:

```tsx
import { useMarketplaceStore } from '@/store/marketplaceSlice';
import { useFatigueCheck } from '@/hooks/useFatigueCheck';

export function ShiftBoard() {
  const { shifts, loading, claimShift } = useMarketplaceStore();
  const { canClaim, fatigueWarning } = useFatigueCheck();
  
  const openShifts = shifts.filter(s => s.lifecycleState === 'POSTED');
  
  return (
    <div className="shift-board">
      <h2>Open Shifts</h2>
      {fatigueWarning && (
        <Alert severity="warning">{fatigueWarning}</Alert>
      )}
      {openShifts.map(shift => (
        <ShiftCard
          key={shift.id}
          shift={shift}
          onClaim={() => claimShift(shift.id, currentProviderId)}
          disabled={!canClaim}
        />
      ))}
    </div>
  );
}
```

#### Step 3: Backend Marketplace Routes

Location: `server.js` - Add routes:

```javascript
// GET /api/marketplace/shifts
app.get('/api/marketplace/shifts', (req, res) => {
  const { status, providerId, date } = req.query;
  // Filter and return marketplace shifts
});

// POST /api/marketplace/shifts
app.post('/api/marketplace/shifts', (req, res) => {
  const { slotId, notes, postedByProviderId } = req.body;
  // Create new marketplace shift in POSTED state
});

// POST /api/marketplace/shifts/:id/claim
app.post('/api/marketplace/shifts/:id/claim', (req, res) => {
  const { providerId } = req.body;
  // Transition to CLAIMED state
  // Trigger AI evaluation
  // Start broadcast sequence
});

// POST /api/marketplace/shifts/:id/approve
app.post('/api/marketplace/shifts/:id/approve', (req, res) => {
  const { approvedBy, autoApproved } = req.body;
  // Update schedule slot
  // Send confirmation notifications
});

// POST /api/marketplace/shifts/:id/cancel
app.post('/api/marketplace/shifts/:id/cancel', (req, res) => {
  // Transition to CANCELLED state
  // Notify affected parties
});
```

## Feature 4: Fatigue Tracking & Constraint Optimization

### Implementation Path

#### Step 1: Fatigue Calculation Hook

Location: `src/hooks/useFatigueCheck.ts`

```typescript
import { useMemo } from 'react';
import type { Provider, ShiftSlot, FatigueMetrics } from '@/types';

interface FatigueCheckResult {
  canClaim: boolean;
  fatigueScore: number;
  fatigueLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  fatigueMetrics: FatigueMetrics;
}

const FATIGUE_THRESHOLDS = {
  maxConsecutiveShifts: 5,
  maxShiftsPerMonth: 15,
  criticalConsecutiveShifts: 7,
  criticalShiftsPerMonth: 18,
};

export function useFatigueCheck(
  providerId: string,
  slots: ShiftSlot[]
): FatigueCheckResult {
  return useMemo(() => {
    const providerSlots = slots.filter(s => s.providerId === providerId);
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate consecutive shifts
    const sortedDates = providerSlots
      .map(s => s.date)
      .sort()
      .reverse();
    
    let consecutiveWorked = 0;
    let currentDate = new Date(today);
    
    for (const slotDate of sortedDates) {
      const slotDateObj = new Date(slotDate);
      const diffDays = Math.floor(
        (currentDate.getTime() - slotDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (diffDays <= 1) {
        consecutiveWorked++;
        currentDate = slotDateObj;
      } else {
        break;
      }
    }
    
    // Calculate this month's shifts
    const currentMonth = today.substring(0, 7);
    const shiftsThisMonth = providerSlots.filter(s => 
      s.date.startsWith(currentMonth)
    ).length;
    
    const fatigueMetrics: FatigueMetrics = {
      consecutiveShiftsWorked: consecutiveWorked,
      shiftsThisMonth,
    };
    
    // Calculate fatigue score (0-100)
    const consecutiveScore = Math.min(consecutiveWorked / FATIGUE_THRESHOLDS.maxConsecutiveShifts, 1) * 50;
    const monthlyScore = Math.min(shiftsThisMonth / FATIGUE_THRESHOLDS.maxShiftsPerMonth, 1) * 50;
    const fatigueScore = consecutiveScore + monthlyScore;
    
    // Determine fatigue level
    let fatigueLevel: 'low' | 'medium' | 'high' | 'critical';
    const warnings: string[] = [];
    
    if (consecutiveWorked >= FATIGUE_THRESHOLDS.criticalConsecutiveShifts || 
        shiftsThisMonth >= FATIGUE_THRESHOLDS.criticalShiftsPerMonth) {
      fatigueLevel = 'critical';
      warnings.push('Critical fatigue levels - shift assignment blocked');
    } else if (fatigueScore >= 75) {
      fatigueLevel = 'high';
      warnings.push('High fatigue - consider alternative coverage');
    } else if (fatigueScore >= 50) {
      fatigueLevel = 'medium';
      warnings.push('Moderate fatigue - monitor closely');
    } else {
      fatigueLevel = 'low';
    }
    
    const canClaim = fatigueLevel !== 'critical';
    
    return { canClaim, fatigueScore, fatigueLevel, warnings, fatigueMetrics };
  }, [providerId, slots]);
}
```

#### Step 2: AI Constraint Solver Integration

Location: `src/lib/ai/constraintSolver.ts` - Extend existing

```typescript
import type { MarketplaceShift, Provider, ShiftSlot } from '@/types';

export interface EligibilityScore {
  providerId: string;
  score: number;
  reasons: string[];
  fatigueLevel: 'low' | 'medium' | 'high' | 'critical';
}

export function calculateEligibleProviders(
  shift: MarketplaceShift,
  providers: Provider[],
  slots: ShiftSlot[]
): EligibilityScore[] {
  const scores: EligibilityScore[] = [];
  
  for (const provider of providers) {
    const reasons: string[] = [];
    let score = 100;
    
    // Check fatigue
    const fatigueCheck = quickFatigueCheck(provider.id, slots);
    if (fatigueCheck.fatigueLevel === 'critical') {
      continue; // Skip critical fatigue providers
    }
    if (fatigueCheck.fatigueLevel === 'high') {
      score -= 40;
      reasons.push('High fatigue');
    }
    
    // Check shift type compatibility
    if (!hasRequiredSkills(provider, shift.shiftType)) {
      score -= 50;
      reasons.push('Missing required skills');
    }
    
    // Check availability on date
    if (!isAvailableOnDate(provider.id, shift.date, slots)) {
      score -= 100;
      reasons.push('Not available');
    }
    
    // Check consecutive shifts
    if (fatigueCheck.consecutiveShiftsWorked >= 3) {
      score -= 20;
      reasons.push('Consecutive shifts');
    }
    
    scores.push({
      providerId: provider.id,
      score,
      reasons,
      fatigueLevel: fatigueCheck.fatigueLevel
    });
  }
  
  return scores.sort((a, b) => b.score - a.score);
}

function quickFatigueCheck(providerId: string, slots: ShiftSlot[]) {
  // Simplified fatigue check for eligibility
  return { consecutiveShiftsWorked: 0, fatigueLevel: 'low' as const };
}

function hasRequiredSkills(provider: Provider, shiftType: string): boolean {
  // Check provider skills against shift type
  return true;
}

function isAvailableOnDate(providerId: string, date: string, slots: ShiftSlot[]): boolean {
  return !slots.some(s => s.providerId === providerId && s.date === date);
}
```

#### Step 3: Backend AI Recommendations Endpoint

Add to `server.js`:

```javascript
// POST /api/ai/eligible-providers
app.post('/api/ai/eligible-providers', (req, res) => {
  const { shiftId, slotId } = req.body;
  
  // Get shift details
  // Calculate eligible providers with scores
  // Return top 3-5 recommendations
  res.json({
    shiftId,
    eligibleProviders: [
      { providerId: 'p1', score: 95, reasons: ['Low fatigue', 'Available'] },
      { providerId: 'p2', score: 82, reasons: ['Medium fatigue'] },
    ]
  });
});
```

## Feature 5: Progressive Web App Mobile Experience

### Implementation Path

#### Step 1: Mobile-Optimized Layout

Location: `src/App.tsx` - Add responsive breakpoints

```tsx
import { useBreakpoint } from '@/hooks/useBreakpoint';

function App() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  
  return (
    <div className={`app ${isMobile ? 'mobile' : 'desktop'}`}>
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
    </div>
  );
}
```

#### Step 2: Mobile Marketplace Views

Create mobile-specific components:

```tsx
// src/components/mobile/MobileMarketplace.tsx
export function MobileMarketplace() {
  return (
    <div className="mobile-marketplace">
      <BottomNavigation />
      <ShiftBoard /> {/* Full-screen scrollable list */}
      <FloatingActionButton 
        icon="plus"
        onClick={() => openPostShiftModal()}
      />
    </div>
  );
}

// src/components/mobile/BottomNavigation.tsx
export function BottomNavigation() {
  const [activeTab, setActiveTab] = useState('shifts');
  
  return (
    <nav className="bottom-nav">
      <button 
        className={activeTab === 'shifts' ? 'active' : ''}
        onClick={() => setActiveTab('shifts')}
      >
        <Icon name="calendar" />
        <span>Shifts</span>
      </button>
      <button 
        className={activeTab === 'marketplace' ? 'active' : ''}
        onClick={() => setActiveTab('marketplace')}
      >
        <Icon name="store" />
        <span>Market</span>
      </button>
      <button 
        className={activeTab === 'notifications' ? 'active' : ''}
        onClick={() => setActiveTab('notifications')}
      >
        <Icon name="bell" />
        <span>Alerts</span>
      </button>
    </nav>
  );
}
```

#### Step 3: Deep Linking for Push Notifications

Location: `src/lib/pwa/deepLinking.ts`

```typescript
// Handle deep links from push notifications
export function handleDeepLink(url: string): void {
  const parsed = new URL(url);
  const path = parsed.pathname;
  
  // Parse shift ID from URL: /shift/:shiftId/claim
  const match = path.match(/\/shift\/([^/]+)\/claim/);
  if (match) {
    const shiftId = match[1];
    navigateToClaim(shiftId);
    return;
  }
  
  // Default navigation
  router.push(path);
}

// Register deep link handler
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'DEEP_LINK') {
      handleDeepLink(event.data.url);
    }
  });
}
```

#### Step 4: Service Worker Enhancement

Location: `src/service-worker.ts`

```typescript
// Handle push notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const shiftId = event.notification.data?.shiftId;
  if (shiftId) {
    event.waitUntil(
      clients.openWindow(`/shift/${shiftId}/claim`)
    );
  }
});

// Background sync for offline marketplace actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'claim-shift') {
    event.waitUntil(syncClaimedShifts());
  }
});

async function syncClaimedShifts() {
  // Get pending claims from IndexedDB
  // Retry failed requests
}
```

## Testing Strategy

### Unit Tests

```typescript
// src/__tests__/hooks/useFatigueCheck.test.ts
describe('useFatigueCheck', () => {
  it('blocks claim when fatigue is critical', () => {
    const slots = createMockSlots({ 
      providerId: 'p1', 
      count: 20,
      dates: generateConsecutiveDates(20)
    });
    const result = useFatigueCheck('p1', slots);
    expect(result.canClaim).toBe(false);
  });
});

// src/__tests__/lib/constraintSolver.test.ts
describe('calculateEligibleProviders', () => {
  it('ranks available providers higher', () => {
    const shift = createMarketplaceShift({ date: '2026-04-15' });
    const providers = [availableProvider, busyProvider];
    const scores = calculateEligibleProviders(shift, providers, slots);
    expect(scores[0].providerId).toBe(availableProvider.id);
  });
});
```

### E2E Tests

```typescript
// e2e/marketplace.spec.ts
test('provider can claim shift via mobile', async ({ page }) => {
  await page.goto('/mobile/marketplace');
  await page.click('[data-testid="shift-card"]');
  await page.click('[data-testid="claim-button"]');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

## API Contracts

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/marketplace/shifts | List marketplace shifts |
| POST | /api/marketplace/shifts | Post new shift |
| POST | /api/marketplace/shifts/:id/claim | Claim a shift |
| POST | /api/marketplace/shifts/:id/approve | Approve claim |
| POST | /api/notifications/send | Send notification |
| GET | /api/notifications/history | Get notification history |
| POST | /api/ai/eligible-providers | Get AI recommendations |
| POST | /api/ai/nlp-query | Natural language query |

### Data Models

See TypeScript interfaces in Feature 1 for complete type definitions.

## Environment Variables

```bash
# AI Providers (optional - deterministic fallback available)
AI_DEFAULT_PROVIDER=openai
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Notification Webhooks
NOTIFY_WEBHOOK_URL=
NOTIFY_SLACK_WEBHOOK_URL=
NOTIFY_TEAMS_WEBHOOK_URL=
NOTIFY_EMAIL_WEBHOOK_URL=
NOTIFY_SMS_WEBHOOK_URL=

# PWA
VITE_VAPID_PUBLIC_KEY=
```

## Rollout Strategy

1. **Phase 1**: Marketplace UI + basic swap flow
2. **Phase 2**: AI Copilot integration + notifications
3. **Phase 3**: Auto-escalation + fatigue blocking
4. **Phase 4**: PWA mobile experience + deep linking

## Anti-Patterns to Avoid

- **Don't** auto-approve without human review for critical shifts
- **Don't** expose provider fatigue data to other providers
- **Don't** send notifications outside escalation tiers
- **Don't** skip validation on marketplace API endpoints
- **Don't** rely solely on client-side fatigue calculations
