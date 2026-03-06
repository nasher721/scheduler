/**
 * Calendar Enhancement Types
 * 
 * Type definitions for Phase 1-5 calendar improvements
 */

import type { ShiftSlot, Provider, ServicePriority, ShiftType } from './index';

// ============================================================================
// Phase 1: UX & Accessibility
// ============================================================================

export interface CalendarFilters {
  providers: string[];
  locations: string[];
  priorities: ServicePriority[];
  shiftTypes: ShiftType[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  status: 'all' | 'filled' | 'unfilled' | 'critical';
  searchTerm: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  icon: string;
  description?: string;
  filters: CalendarFilters;
  isDefault?: boolean;
  isShared?: boolean;
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  scope?: string;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  screenReaderOptimized: boolean;
}

// ============================================================================
// Phase 2: Shift Management
// ============================================================================

export interface ShiftTemplate {
  id: string;
  name: string;
  description?: string;
  shiftType: ShiftType;
  servicePriority: ServicePriority;
  serviceLocation: string;
  requiredSkill: string;
  duration: number; // hours
  notes?: string;
  checkList?: string[];
  isShared: boolean;
  organizationId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringPattern {
  id: string;
  templateId: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  interval: number;
  daysOfWeek: number[]; // 0-6, Sunday = 0
  startDate: string;
  endDate?: string;
  count?: number;
  exceptions: string[]; // ISO dates to exclude
}

export interface ShiftHandoff {
  id: string;
  slotId: string;
  date: string;
  shiftType: ShiftType;
  
  // Outgoing provider
  outgoingProviderId: string;
  signOutTime: string;
  signOutNotes?: string;
  
  // Handoff content
  patientSummary?: string;
  pendingTasks: HandoffTask[];
  criticalAlerts: string[];
  equipmentStatus?: string;
  
  // Incoming provider
  incomingProviderId: string;
  signInTime?: string;
  acknowledgedAt?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface HandoffTask {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface AssignmentAnalysis {
  warnings: string[];
  conflicts: string[];
  workload: {
    hoursThisWeek: number;
    hoursAfter: number;
    percentage: number;
    target: number;
  };
  skillMatch: {
    required: string[];
    matched: string[];
    missing: string[];
    score: number;
  };
  availability: {
    hasTimeOff: boolean;
    consecutiveShifts: number;
    restHours: number;
  };
}

export interface SwapRequest {
  id: string;
  fromSlotId: string;
  fromProviderId: string;
  toSlotId?: string;
  toProviderId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  respondedAt?: string;
  notes?: string;
}

// ============================================================================
// Phase 3: Visualization
// ============================================================================

export interface CalendarAnnotation {
  id: string;
  type: 'note' | 'highlight' | 'marker';
  date: string;
  content: string;
  color?: string;
  icon?: string;
  createdBy: string;
  isShared: boolean;
  createdAt: string;
}

export interface CoverageStats {
  date: string;
  byPriority: Record<ServicePriority, {
    required: number;
    filled: number;
    score: number;
  }>;
  overall: {
    filled: number;
    total: number;
    percentage: number;
  };
  alerts: string[];
}

export interface ScheduleComparison {
  mode: 'scenario' | 'history' | 'ai-optimization';
  baseline: ScheduleSnapshot;
  comparison: ScheduleSnapshot;
  changes: ChangeDiff[];
}

export interface ChangeDiff {
  type: 'added' | 'removed' | 'modified';
  slotId: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

interface ScheduleSnapshot {
  id: string;
  name: string;
  slots: ShiftSlot[];
  timestamp: string;
}

// ============================================================================
// Phase 4: Collaboration
// ============================================================================

export interface PresenceState {
  userId: string;
  userName: string;
  userRole: string;
  currentView: string;
  currentSlotId?: string;
  isEditing: boolean;
  lastActivity: string;
  onlineAt: string;
}

export interface ActivityEvent {
  id: string;
  type: 'assignment' | 'unassignment' | 'edit' | 'comment' | 'swap' | 'template_applied';
  userId: string;
  userName: string;
  description: string;
  slotId?: string;
  providerId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ShiftComment {
  id: string;
  slotId: string;
  authorId: string;
  authorName: string;
  content: string;
  mentions: string[]; // Provider IDs
  parentId?: string; // For threaded replies
  createdAt: string;
  editedAt?: string;
}

export type UserState = 'active' | 'idle' | 'away';

export interface CursorPosition {
  userId: string;
  userName: string;
  x: number;
  y: number;
  state?: UserState;
  timestamp: string;
}

export interface PresenceAwareness {
  [userId: string]: PresenceState & {
    state?: UserState;
    isVisible?: boolean;
    focusedSlotId?: string;
  };
}

// ============================================================================
// Phase 5: AI Features
// ============================================================================

export interface AISchedulingSuggestion {
  id: string;
  slotId: string;
  providerId: string;
  confidence: number;
  reasoning: string;
  factors: {
    fairness: number;
    preference: number;
    skill: number;
    workload: number;
  };
}

export interface AIScheduleResult {
  suggestions: AISchedulingSuggestion[];
  expectedMetrics: {
    coverageScore: number;
    fairnessScore: number;
    preferenceMatch: number;
    conflictCount: number;
  };
  alternatives?: AISchedulingSuggestion[][];
}

export interface NaturalLanguageCommand {
  text: string;
  intent: 'assign' | 'unassign' | 'swap' | 'query' | 'optimize';
  entities: {
    provider?: string;
    slot?: string;
    date?: string;
    shiftType?: ShiftType;
  };
}

// ============================================================================
// Feature Flags
// ============================================================================

export interface CalendarFeatureFlags {
  // Phase 1
  keyboardNavigation: boolean;
  advancedFilters: boolean;
  responsiveLayout: boolean;
  accessibilityEnhancements: boolean;
  
  // Phase 2
  shiftTemplates: boolean;
  recurringShifts: boolean;
  handoffNotes: boolean;
  enhancedSwaps: boolean;
  assignmentPreview: boolean;
  
  // Phase 3
  comparisonView: boolean;
  richTooltips: boolean;
  enhancedTimeline: boolean;
  annotations: boolean;
  
  // Phase 4
  realTimePresence: boolean;
  activityFeed: boolean;
  shiftComments: boolean;
  
  // Phase 5
  aiScheduling: boolean;
  naturalLanguage: boolean;
  predictiveAnalytics: boolean;
}

export const DEFAULT_CALENDAR_FLAGS: CalendarFeatureFlags = {
  keyboardNavigation: true,
  advancedFilters: true,
  responsiveLayout: true,
  accessibilityEnhancements: true,
  shiftTemplates: false,
  recurringShifts: false,
  handoffNotes: false,
  enhancedSwaps: false,
  assignmentPreview: false,
  comparisonView: false,
  richTooltips: false,
  enhancedTimeline: false,
  annotations: false,
  realTimePresence: false,
  activityFeed: false,
  shiftComments: false,
  aiScheduling: false,
  naturalLanguage: false,
  predictiveAnalytics: false,
};

// ============================================================================
// Utility Types
// ============================================================================

export type CalendarViewMode = 'grid' | 'list' | 'bar' | 'week' | 'month' | 'timeline';

export interface DragState {
  isDragging: boolean;
  draggedItem: {
    type: 'provider' | 'shift';
    id: string;
  } | null;
  dropTarget: {
    slotId: string;
    isValid: boolean;
    warnings?: string[];
  } | null;
}

export interface CalendarState {
  // View state
  viewMode: CalendarViewMode;
  filters: CalendarFilters;
  selectedDate: string | null;
  selectedSlotIds: string[];
  
  // UI state
  isFilterPanelOpen: boolean;
  isBulkMode: boolean;
  dragState: DragState;
  
  // Phase 2 state
  templates: ShiftTemplate[];
  selectedTemplateId: string | null;
  
  // Phase 4 state
  presence: PresenceState[];
  activityFeed: ActivityEvent[];
  
  // Pending operations
  pendingOperations: PendingOperation[];
}

export interface PendingOperation {
  id: string;
  type: 'assignment' | 'unassignment' | 'edit';
  slotId: string;
  previousState: unknown;
  newState: unknown;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}
