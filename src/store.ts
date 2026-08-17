import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Default Admin Credentials ────────────────────────────────────────────────
// These credentials are for the administrative portal default login
// In production, use environment variables or a secure backend auth system
export const DEFAULT_ADMIN_CREDENTIALS = {
  email: 'admin@neuroicu.com',
  password: 'NeuroAdmin2024!', // Default password - should be changed on first login
  name: 'Administrator',
  role: 'ADMIN' as const,
};

// Check if provided credentials match default admin
export function validateDefaultAdmin(email: string, password: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  const emailMatch = normalizedEmail === DEFAULT_ADMIN_CREDENTIALS.email.toLowerCase();
  const passwordMatch = password === DEFAULT_ADMIN_CREDENTIALS.password;
  
  if (!emailMatch || !passwordMatch) {
    console.log('[Admin Auth] Credentials mismatch. Email match:', emailMatch, 'Password match:', passwordMatch);
  }
  
  return emailMatch && passwordMatch;
}

// ─── Safe localStorage wrapper with In-Memory Fallback ────────────────────────
// Wraps every get/set/removeItem in a robust try/catch with an in-memory Map fallback.
// If localStorage is unavailable, disabled, running in a sandboxed iframe, or exceeds quota,
// operations fallback gracefully without throwing uncaught SecurityError or QuotaExceededError.
const _memoryStorage = new Map<string, string>();

const _safeStorage = {
  getItem: (name: string): string | null => {
    try {
      const val = localStorage.getItem(name);
      return val !== null ? val : (_memoryStorage.get(name) ?? null);
    } catch {
      return _memoryStorage.get(name) ?? null;
    }
  },
  setItem: (name: string, value: string): void => {
    _memoryStorage.set(name, value);
    const tryWrite = (payload: string) => {
      try {
        localStorage.setItem(name, payload);
        return true;
      } catch (err) {
        const isQuota =
          err instanceof DOMException &&
          (err.name === "QuotaExceededError" ||
            err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            err.code === 22);
        if (!isQuota) {
          // In sandboxed/restricted storage context, memory storage is already updated.
          return true;
        }
        return false;
      }
    };

    if (tryWrite(value)) return;

    // First attempt failed due to quota — prune large slices and retry.
    try {
      const parsed: { state?: Record<string, unknown> } = JSON.parse(value);
      const s = parsed?.state;
      if (s) {
        // Trim undo history to the most recent 15 snapshots.
        if (Array.isArray(s.history) && (s.history as unknown[]).length > 15) {
          const trimmed = (s.history as unknown[]).slice(-15);
          s.history = trimmed;
          s.historyIndex = Math.min(
            typeof s.historyIndex === "number" ? s.historyIndex : 14,
            14,
          );
        }
        // Keep only the 3 most recent copilot conversations.
        if (Array.isArray(s.copilotConversations)) {
          s.copilotConversations = (s.copilotConversations as unknown[]).slice(-3);
        }
        // Drop stale ML suggestions.
        if (Array.isArray(s.mlSuggestions)) {
          s.mlSuggestions = [];
        }
        // Trim notifications to the 20 most recent.
        if (Array.isArray(s.notifications)) {
          s.notifications = (s.notifications as unknown[]).slice(-20);
        }
        if (tryWrite(JSON.stringify(parsed))) return;
      }
    } catch {
      // Parsing failed — fall through to evict.
    }

    // Still over quota: evict the stale key so the next write can succeed.
    try { localStorage.removeItem(name); } catch { /* nothing */ }
    console.warn(
      "[NICU Scheduler] localStorage quota exceeded. Undo history and AI conversation logs were trimmed to free space. Core schedule data is preserved in memory.",
    );
  },
  removeItem: (name: string): void => {
    _memoryStorage.delete(name);
    try { localStorage.removeItem(name); } catch { /* nothing */ }
  },
};
// ─────────────────────────────────────────────────────────────────────────────
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek, isValid } from "date-fns";
import { registerProvider, loadScheduleState, applyOptimizationResult, multiAgentOptimize, buildOptimizationPreview } from "./lib/api";
import { supabase, supabaseStatus } from "./lib/supabase";
export * from "./types";
import {
  ShiftType, ProviderCredential, CredentialStatus,
  Provider, CustomRule, ShiftSlot, ScenarioSnapshot, AuditLogEntry,
  LocationGroup, ServicePriority, ServiceLocation,
  type CopilotMessage, type CopilotConversation, type CopilotFeedbackEntry,
  MarketplaceShift,
  BroadcastHistoryEntry,
  EscalationConfig,
  BroadcastRecipient, ShiftLifecycleStatus, BroadcastChannel
} from "./types";

export interface ProviderCounts {
  weekDays: number;
  weekendDays: number;
  weekNights: number;
  weekendNights: number;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

export type SwapRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface SwapRequest {
  id: string;
  /** Provider requesting the swap */
  requestorId: string;
  /** Provider being asked to swap with (null if open request) */
  targetProviderId?: string;
  /** Date of the shift being offered */
  fromDate: string;
  /** Type of shift being offered */
  fromShiftType: ShiftType;
  /** Date of the shift being requested */
  toDate: string;
  /** Type of shift being requested */
  toShiftType: ShiftType;
  /** Current status of the request */
  status: SwapRequestStatus;
  /** When the request was created */
  requestedAt: string;
  /** When the request was approved/rejected */
  resolvedAt?: string;
  /** Who approved/rejected the request (scheduler) */
  resolvedBy?: string;
  /** Notes about the swap */
  notes?: string;
  /** Validation errors if any */
  validationErrors?: string[];
}

export interface HolidayAssignment {
  /** Holiday name (e.g., "Thanksgiving 2026") */
  holidayName: string;
  /** Date of the holiday */
  date: string;
  /** Provider assigned */
  providerId: string;
  /** Type of shift assigned */
  shiftType: ShiftType;
  /** Previous year's provider for fairness tracking */
  previousYearProviderId?: string;
}

export type ConflictType =
  | 'OVERLOAD_FTE'
  | 'CONSECUTIVE_NIGHTS'
  | 'SKILL_MISMATCH'
  | 'CREDENTIAL_EXPIRING'
  | 'CREDENTIAL_EXPIRED'
  | 'FATIGUE_EXPOSURE'
  | 'UNFILLED_CRITICAL'
  | 'TIME_OFF_CONFLICT';

export type ConflictSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  providerId?: string;
  slotId?: string;
  title: string;
  description: string;
  detectedAt: string;
  /** Whether this conflict can be auto-resolved */
  autoResolvable: boolean;
  /** Suggested actions to resolve */
  suggestedActions: ConflictAction[];
  /** Whether this conflict has been acknowledged */
  acknowledged?: boolean;
  /** Resolution timestamp if resolved */
  resolvedAt?: string;
}

export interface ConflictAction {
  id: string;
  label: string;
  type: 'AUTO_FIX' | 'MANUAL' | 'SUGGEST_SWAP' | 'REASSIGN' | 'IGNORE';
  /** Description of what this action will do */
  description: string;
  /** Whether this action requires scheduler approval */
  requiresApproval?: boolean;
}

/** Notification preferences and delivery settings */
export interface NotificationPreferences {
  providerId: string;
  /** Enable email notifications */
  emailEnabled: boolean;
  /** Enable in-app notifications */
  inAppEnabled: boolean;
  /** Enable Slack notifications */
  slackEnabled?: boolean;
  /** Notification types subscribed to */
  subscribedTypes: NotificationType[];
  /** Quiet hours (don't send notifications during these times) */
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
}

export type NotificationType =
  | 'SHIFT_REMINDER'
  | 'SWAP_REQUEST'
  | 'SWAP_APPROVED'
  | 'SCHEDULE_CHANGE'
  | 'CONFLICT_DETECTED'
  | 'CREDENTIAL_EXPIRING'
  | 'TIME_OFF_APPROVED';

export interface Notification {
  id: string;
  providerId: string;
  type: NotificationType;
  title: string;
  message: string;
  /** When the notification was created */
  createdAt: string;
  /** When the notification was read */
  readAt?: string;
  /** Related entity IDs for quick navigation */
  relatedSwapId?: string;
  relatedSlotId?: string;
  /** Action buttons for this notification */
  actions?: { label: string; action: string }[];
}

/** ML-based provider preference profile learned from historical data */
export interface ProviderPreferenceProfile {
  providerId: string;
  /** Preferred days of week (0=Sunday, 6=Saturday) */
  preferredWeekdays: number[];
  /** Days provider tends to avoid */
  avoidedWeekdays: number[];
  /** Shift types historically preferred */
  preferredShiftTypes: ShiftType[];
  /** Historical load by shift type */
  historicalShiftDistribution: Record<ShiftType, number>;
  /** Swap willingness score (0-1) */
  swapWillingness: number;
  /** Average response time to swap requests (hours) */
  avgSwapResponseTime?: number;
  /** Holidays worked in past years */
  holidayHistory: Record<string, number>; // year -> count
  /** Patterns detected by ML */
  detectedPatterns: DetectedPattern[];
  /** When this profile was last updated */
  lastUpdated: string;
}

export interface DetectedPattern {
  type: 'PREFERS_WEEKDAYS' | 'PREFERS_WEEKENDS' | 'AVOIDS_NIGHTS' | 'PREFERS_NIGHTS' | 'ROTATION_PATTERN';
  description: string;
  confidence: number; // 0-1
  evidence: string[];
}

/** ML-suggested assignment with confidence score */
export interface MLSuggestion {
  id: string;
  slotId: string;
  providerId: string;
  confidence: number;
  reason: string;
  factors: {
    historicalFit: number;
    preferenceMatch: number;
    fairnessBalance: number;
    skillMatch: number;
  };
  /** Whether this suggestion has been applied */
  applied?: boolean;
  createdAt: string;
}

/** Schedule template for quick rotation patterns */
export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  /** Duration in weeks */
  durationWeeks: number;
  /** Creator of this template */
  createdBy: string;
  createdAt: string;
  /** The pattern definition */
  pattern: TemplatePatternSlot[];
  /** Provider groups for rotation (e.g., "A Team", "B Team") */
  providerGroups?: Record<string, string[]>;
  /** Is this a system template or user-created */
  isSystem?: boolean;
}

export interface TemplatePatternSlot {
  /** Day offset from start (0 = first day) */
  dayOffset: number;
  shiftType: ShiftType;
  location: string;
  /** Provider assignment: specific ID, group name, or "ROTATE" */
  assignment: string;
  /** Required skills for this slot */
  requiredSkills?: string[];
}

interface HistoryState {
  providers: Provider[];
  slots: ShiftSlot[];
  startDate: string;
  numWeeks: number;
  assignmentLogs?: string[];
  customRules: CustomRule[];
  auditLog: AuditLogEntry[];
  dayHandoffs?: import("./types").DayHandoff[];
}

// Copilot types are now imported from ./types

export type ScheduleSurfaceView = "calendar" | "excel";
export type CalendarPresentationMode = "grid" | "list" | "timeline" | "month" | "bar" | "week";
export type ShiftTypeFilter = ShiftType | "all";

export interface ScheduleViewportState {
  surfaceView: ScheduleSurfaceView;
  calendarPresentationMode: CalendarPresentationMode;
  currentWeekOffset: number;
  shiftTypeFilter: ShiftTypeFilter;
  showConflictsOnly: boolean;
  showUnfilledOnly: boolean;
  providerSearchTerm: string;
}

interface ScheduleState {
  providers: Provider[];
  startDate: string;
  numWeeks: number;
  slots: ShiftSlot[];
  scenarios: ScenarioSnapshot[];
  assignmentLogs?: string[];
  customRules: CustomRule[];
  auditLog: AuditLogEntry[];
  lastActionMessage: string | null;
  toasts: Toast[];
  history: HistoryState[];
  historyIndex: number;
  /** Swap requests for shift exchanges */
  swapRequests: SwapRequest[];
  /** Holiday assignments for fairness tracking */
  holidayAssignments: HolidayAssignment[];
  /** ML-generated provider preference profiles */
  preferenceProfiles: Record<string, ProviderPreferenceProfile>;
  /** ML suggestions for assignments */
  mlSuggestions: MLSuggestion[];
  /** Saved schedule templates */
  scheduleTemplates: ScheduleTemplate[];
  dayHandoffs: import("./types").DayHandoff[];
  marketplaceShifts: MarketplaceShift[];
  broadcastHistory: BroadcastHistoryEntry[];
  escalationConfig: EscalationConfig;
  addProvider: (provider: Omit<Provider, "id">) => void;
  updateProvider: (id: string, provider: Partial<Provider>) => void;
  removeProvider: (id: string) => void;
  addCustomRule: (rule: Omit<CustomRule, "id">) => void;
  updateCustomRule: (id: string, updates: Partial<Omit<CustomRule, "id">>) => void;
  removeCustomRule: (id: string) => void;
  setScheduleRange: (startDate: string, numWeeks: number) => void;
  assignShift: (slotId: string, providerId: string | null, secondaryProviderIds?: string[]) => void;
  autoAssign: () => void;
  clearAssignments: () => void;
  clearStaff: () => void;
  clearSchedule: () => void;
  applyImportedSnapshot: (providers: Provider[], slots: ShiftSlot[], appliedAssignments: number, skippedRows: number) => void;
  createScenario: (name: string) => void;
  loadScenario: (id: string) => void;
  updateScenario: (id: string, updates: Partial<Pick<ScenarioSnapshot, "name">>) => void;
  deleteScenario: (id: string) => void;
  clearMessage: () => void;
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  restoreLastKnownGoodSchedule: () => void;
  deduplicateProviders: (mergeMap: Array<{ canonicalId: string; duplicateIds: string[] }>) => void;
  currentUser: Provider | null;
  login: (email: string) => void;
  register: (provider: Omit<Provider, "id">) => void;
  logout: () => void;
  // Swap management
  createSwapRequest: (request: Omit<SwapRequest, 'id' | 'requestedAt' | 'status'>) => void;
  approveSwapRequest: (id: string, approverId: string) => void;
  rejectSwapRequest: (id: string, approverId: string, reason?: string) => void;
  cancelSwapRequest: (id: string) => void;
  // Holiday management
  addHolidayAssignment: (assignment: Omit<HolidayAssignment, 'id'>) => void;
  updateHolidayAssignment: (holidayName: string, date: string, updates: Partial<Pick<HolidayAssignment, 'providerId' | 'shiftType'>>) => void;
  removeHolidayAssignment: (holidayName: string, date: string) => void;
  getProviderHolidayCount: (providerId: string, year: number) => number;
  // Conflict resolution
  conflicts: Conflict[];
  detectConflicts: () => void;
  acknowledgeConflict: (id: string) => void;
  resolveConflict: (id: string, actionId: string) => void;
  ignoreConflict: (id: string) => void;
  // Notifications
  notifications: Notification[];
  notificationPreferences: Record<string, NotificationPreferences>;
  sendNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markNotificationRead: (id: string) => void;
  updateNotificationPreferences: (providerId: string, prefs: Partial<NotificationPreferences>) => void;
  // ML & Predictive Scheduling
  analyzeProviderPatterns: () => void;
  getProviderPreferenceProfile: (providerId: string) => ProviderPreferenceProfile | undefined;
  generateMLSuggestions: () => void;
  applyMLSuggestion: (suggestionId: string) => void;
  dismissMLSuggestion: (suggestionId: string) => void;
  // Schedule Templates
  createTemplate: (template: Omit<ScheduleTemplate, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: string, updates: Partial<Omit<ScheduleTemplate, 'id' | 'createdAt'>>) => void;
  deleteTemplate: (id: string) => void;
  applyTemplate: (id: string, startDate: string) => void;
  createProviderGroup: (name: string, providerIds: string[]) => void;
  initialize: () => Promise<void>;
  // Copilot AI Assistant
  isCopilotOpen: boolean;
  toggleCopilot: () => void;
  selectedDate: string | null;
  selectedProviderId: string | null;
  setSelectedDate: (date: string | null) => void;
  setSelectedProviderId: (id: string | null) => void;
  scheduleViewport: ScheduleViewportState;
  setScheduleSurfaceView: (view: ScheduleSurfaceView) => void;
  setCalendarPresentationMode: (mode: CalendarPresentationMode) => void;
  setCurrentWeekOffset: (offset: number) => void;
  shiftWeekOffset: (delta: number) => void;
  setShiftTypeFilter: (filter: ShiftTypeFilter) => void;
  setShowConflictsOnly: (show: boolean) => void;
  setShowUnfilledOnly: (show: boolean) => void;
  setProviderSearchTerm: (term: string) => void;
  resetScheduleViewportFilters: () => void;
  // AI Suggestions & Preview
  pendingAISuggestions: Array<{
    id: string;
    type: 'assign' | 'remove' | 'swap';
    slotId: string;
    fromProviderId?: string | null;
    toProviderId?: string | null;
    reason: string;
  }>;
  applyAISuggestion: (suggestionId: string) => void;
  applyAllAISuggestions: () => void;
  rejectAISuggestions: () => void;
  queueAISuggestions: (
    preview: unknown,
    suggestions: Array<{
      id: string;
      type: 'assign' | 'remove' | 'swap';
      slotId: string;
      fromProviderId?: string | null;
      toProviderId?: string | null;
      reason: string;
    }>
  ) => void;
  showChangePreview: boolean;
  changePreviewData: unknown;
  pendingMultiAgentResult: unknown;
  openChangePreview: (preview: unknown) => void;
  openChangePreviewWithMultiAgentResult: (preview: unknown, rawResult: unknown) => void;
  closeChangePreview: () => void;
  runMultiAgentOptimize: () => Promise<void>;
  // Copilot Conversation History
  copilotConversations: CopilotConversation[];
  currentConversationId: string | null;
  createConversation: () => string;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  addMessageToConversation: (conversationId: string, message: CopilotMessage) => void;
  // Copilot Personalization
  copilotFeedback: CopilotFeedbackEntry[];
  recordCopilotFeedback: (feedback: Omit<CopilotFeedbackEntry, 'id' | 'timestamp'>) => void;
  getCopilotPreferenceScore: (intent: string) => number;
  // Day Handoff Notes
  setDayHandoff: (date: string, notes: string) => void;
  getDayHandoff: (date: string) => import("./types").DayHandoff | undefined;
  clearDayHandoff: (date: string) => void;

  postShiftForCoverage: (slotId: string, postedByProviderId: string, notes?: string) => string;
  transitionShiftLifecycle: (shiftId: string, newState: ShiftLifecycleStatus) => void;
  cancelMarketplaceShift: (shiftId: string) => void;
  claimShift: (shiftId: string, providerId: string) => void;
  approveShift: (shiftId: string, approvedBy: string) => void;
  escalateBroadcast: (shiftId: string) => void;
  updateEscalationConfig: (config: Partial<EscalationConfig>) => void;
  addBroadcastEntry: (shiftId: string, recipients: BroadcastRecipient[], channel: BroadcastChannel) => void;
  updateBroadcastRecipientStatus: (entryId: string, providerId: string, status: "sent" | "delivered" | "failed") => void;
  // Cloud sync actions
  setSyncStatus: (status: "idle" | "loading" | "saving" | "synced" | "error", error?: string) => void;
}

const getWeekStart = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

function isNetworkRegistrationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch")
    || normalized.includes("fetch failed")
    || normalized.includes("network")
    || normalized.includes("connection failed")
  );
}

function isDuplicateRegistrationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("already in use")
    || normalized.includes("already registered")
    || normalized.includes("already exists")
    || normalized.includes("duplicate");
}

function shouldUseLocalAuthBypass() {
  const isDevMode = import.meta.env.DEV || window.location.hostname === "localhost";
  const bypassByEnv = isDevMode && !import.meta.env.VITE_REQUIRE_SUPABASE_AUTH;
  // Allow bypass in dev mode OR when Supabase credentials are not configured (placeholder)
  return bypassByEnv || supabaseStatus.isPlaceholder;
}


const CREDENTIAL_WARNING_DAYS = 30;

const evaluateCredentialStatus = (credential: ProviderCredential, slotDate?: string): CredentialStatus => {
  if (credential.status === "pending_verification") return "pending_verification";
  if (!credential.expiresAt) return credential.status;

  const targetDate = slotDate ? parseISO(slotDate) : new Date();
  const daysUntilExpiry = differenceInCalendarDays(parseISO(credential.expiresAt), targetDate);
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= CREDENTIAL_WARNING_DAYS) return "expiring_soon";
  return "active";
};

export const getProviderCredentialSummary = (provider: Provider, slotDate?: string) => {
  const credentials = provider.credentials || [];
  const evaluated = credentials.map((entry) => ({ ...entry, computedStatus: evaluateCredentialStatus(entry, slotDate) }));

  return {
    credentials: evaluated,
    hasExpiredCredentials: evaluated.some((entry) => entry.computedStatus === "expired"),
    hasExpiringSoonCredentials: evaluated.some((entry) => entry.computedStatus === "expiring_soon"),
  };
};

interface ShiftRequirement {
  skill: string;
  priority: "CRITICAL" | "STANDARD";
  locationGroup: LocationGroup;
  servicePriority: ServicePriority;
}

const shiftRequirements: Record<ShiftType, ShiftRequirement> = {
  DAY: { skill: "NEURO_CRITICAL", priority: "CRITICAL", locationGroup: "MAIN_CAMPUS_UNIT", servicePriority: "CRITICAL" },
  NIGHT: { skill: "NIGHT_FLOAT", priority: "CRITICAL", locationGroup: "MAIN_CAMPUS_SERVICE", servicePriority: "STANDARD" },
  NMET: { skill: "AIRWAY", priority: "STANDARD", locationGroup: "MAIN_CAMPUS_SERVICE", servicePriority: "FLEXIBLE" },
  JEOPARDY: { skill: "STROKE", priority: "STANDARD", locationGroup: "SUPPORT_SERVICE", servicePriority: "FLEXIBLE" },
  RECOVERY: { skill: "NEURO_CRITICAL", priority: "STANDARD", locationGroup: "SUPPORT_SERVICE", servicePriority: "FLEXIBLE" },
  CONSULTS: { skill: "NEURO_CRITICAL", priority: "STANDARD", locationGroup: "MAIN_CAMPUS_SERVICE", servicePriority: "STANDARD" },
  VACATION: { skill: "NEURO_CRITICAL", priority: "STANDARD", locationGroup: "SUPPORT_SERVICE", servicePriority: "FLEXIBLE" },
};

/** Service location configuration for slot generation */
const serviceLocationConfig: Record<string, {
  type: ShiftType;
  location: string;
  locationGroup: LocationGroup;
  servicePriority: ServicePriority;
  serviceLocation: ServiceLocation;
  requiredSkill: string;
  priority: "CRITICAL" | "STANDARD";
}> = {
  G20: {
    type: "DAY",
    location: "G20 Unit",
    locationGroup: "MAIN_CAMPUS_UNIT",
    servicePriority: "CRITICAL",
    serviceLocation: "G20",
    requiredSkill: "NEURO_CRITICAL",
    priority: "CRITICAL",
  },
  H22: {
    type: "DAY",
    location: "H22 Unit",
    locationGroup: "MAIN_CAMPUS_UNIT",
    servicePriority: "CRITICAL",
    serviceLocation: "H22",
    requiredSkill: "NEURO_CRITICAL",
    priority: "CRITICAL",
  },
  Akron: {
    type: "DAY",
    location: "Akron",
    locationGroup: "AKRON_UNIT",
    servicePriority: "CRITICAL",
    serviceLocation: "Akron",
    requiredSkill: "NEURO_CRITICAL",
    priority: "CRITICAL",
  },
  Nights: {
    type: "NIGHT",
    location: "Main Campus (Nights)",
    locationGroup: "MAIN_CAMPUS_SERVICE",
    servicePriority: "STANDARD",
    serviceLocation: "Nights",
    requiredSkill: "NIGHT_FLOAT",
    priority: "CRITICAL",
  },
  Consults: {
    type: "CONSULTS",
    location: "Main Campus (Consults)",
    locationGroup: "MAIN_CAMPUS_SERVICE",
    servicePriority: "STANDARD",
    serviceLocation: "Consults",
    requiredSkill: "NEURO_CRITICAL",
    priority: "STANDARD",
  },
  AMET: {
    type: "NMET",
    location: "Main Campus (AMET)",
    locationGroup: "MAIN_CAMPUS_SERVICE",
    servicePriority: "FLEXIBLE",
    serviceLocation: "AMET",
    requiredSkill: "AIRWAY",
    priority: "STANDARD",
  },
  NMET: {
    type: "NMET",
    location: "Main Campus (NMET)",
    locationGroup: "MAIN_CAMPUS_SERVICE",
    servicePriority: "FLEXIBLE",
    serviceLocation: "NMET",
    requiredSkill: "AIRWAY",
    priority: "STANDARD",
  },
  Jeopardy: {
    type: "JEOPARDY",
    location: "Jeopardy",
    locationGroup: "SUPPORT_SERVICE",
    servicePriority: "FLEXIBLE",
    serviceLocation: "Jeopardy",
    requiredSkill: "STROKE",
    priority: "STANDARD",
  },
  Recovery: {
    type: "RECOVERY",
    location: "Recovery",
    locationGroup: "SUPPORT_SERVICE",
    servicePriority: "FLEXIBLE",
    serviceLocation: "Recovery",
    requiredSkill: "NEURO_CRITICAL",
    priority: "STANDARD",
  },
};

export const generateInitialSlots = (startDateStr: string, numWeeks: number): ShiftSlot[] => {
  const slots: ShiftSlot[] = [];
  const start = startOfWeek(parseISO(startDateStr), { weekStartsOn: 1 });

  for (let dayOffset = 0; dayOffset < numWeeks * 7; dayOffset += 1) {
    const currentDate = addDays(start, dayOffset);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayOfWeek = currentDate.getDay();

    const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
    const isWeekendNight = dayOfWeek === 0 || dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;

    // Priority 1: G20, H22, Akron - Critical units that must be staffed
    const priority1Services = ["G20", "H22", "Akron"] as const;
    priority1Services.forEach((serviceKey) => {
      const config = serviceLocationConfig[serviceKey];
      slots.push({
        id: `${dateStr}-${config.type}-${serviceKey}`,
        date: dateStr,
        type: config.type,
        providerId: null,
        isWeekendLayout: isWeekendDay,
        requiredSkill: config.requiredSkill,
        priority: config.priority,
        isBackup: false,
        location: config.location,
        locationGroup: config.locationGroup,
        servicePriority: config.servicePriority,
        serviceLocation: config.serviceLocation,
      });
    });

    // Priority 2: Nights
    const priority2Services = ["Nights"] as const;
    priority2Services.forEach((serviceKey) => {
      const config = serviceLocationConfig[serviceKey];
      slots.push({
        id: `${dateStr}-${config.type}-${serviceKey}`,
        date: dateStr,
        type: config.type,
        providerId: null,
        isWeekendLayout: isWeekendNight,
        requiredSkill: config.requiredSkill,
        priority: config.priority,
        isBackup: false,
        location: config.location,
        locationGroup: config.locationGroup,
        servicePriority: config.servicePriority,
        serviceLocation: config.serviceLocation,
      });
    });

    // Priority 3: Consults/NMET (same service family) then support services.
    // Consults/NMET are never generated on weekends.
    const priority3Services = ["Consults", "NMET", "AMET", "Jeopardy", "Recovery"] as const;
    priority3Services.forEach((serviceKey) => {
      if (isWeekendDay && (serviceKey === "Consults" || serviceKey === "NMET" || serviceKey === "AMET")) {
        return;
      }

      const config = serviceLocationConfig[serviceKey];
      slots.push({
        id: `${dateStr}-${config.type}-${serviceKey}`,
        date: dateStr,
        type: config.type,
        providerId: null,
        isWeekendLayout: isWeekendDay,
        requiredSkill: config.requiredSkill,
        priority: config.priority,
        isBackup: serviceKey === "Jeopardy",
        location: config.location,
        locationGroup: config.locationGroup,
        servicePriority: config.servicePriority,
        serviceLocation: config.serviceLocation,
      });
    });

    // Vacation slot for tracking (not a real shift)
    slots.push({
      id: `${dateStr}-VACATION-Vacation`,
      date: dateStr,
      type: "VACATION",
      providerId: null,
      isWeekendLayout: isWeekendDay,
      requiredSkill: shiftRequirements.VACATION.skill,
      priority: shiftRequirements.VACATION.priority,
      isBackup: false,
      location: "Any",
      locationGroup: "SUPPORT_SERVICE",
      servicePriority: "FLEXIBLE",
      serviceLocation: "Vacation",
    });
  }

  return slots;
};

export const getProviderCounts = (slots: ShiftSlot[], providers: Provider[]) => {
  const counts: Record<string, ProviderCounts> = {};
  providers.forEach((p) => {
    counts[p.id] = { weekDays: 0, weekendDays: 0, weekNights: 0, weekendNights: 0 };
  });

  slots.forEach((s) => {
    if (!s.providerId || !counts[s.providerId]) return;
    if (s.type === "DAY") {
      if (s.isWeekendLayout) counts[s.providerId].weekendDays += 1;
      else counts[s.providerId].weekDays += 1;
    } else if (s.type === "NIGHT") {
      if (s.isWeekendLayout) counts[s.providerId].weekendNights += 1;
      else counts[s.providerId].weekNights += 1;
    }
  });

  return counts;
};

const getConsecutiveNights = (slots: ShiftSlot[], providerId: string, targetDate: string) => {
  const nights = slots
    .filter((s) => s.providerId === providerId && s.type === "NIGHT")
    .map((s) => s.date)
    .sort();

  // Count the streak of nights ending the day BEFORE the target date: at
  // canAssign time the target slot is not yet assigned to this provider, so
  // starting the walk at targetDate would always return 0.
  let consecutive = 0;
  let cursorDate = addDays(parseISO(targetDate), -1);
  while (nights.includes(format(cursorDate, "yyyy-MM-dd"))) {
    consecutive += 1;
    cursorDate = addDays(cursorDate, -1);
  }
  return consecutive;
};

const getDynamicRecoveryDatesForNight = (nightDate: string): Set<string> => {
  const recoveryDates = new Set<string>();
  const nightDateObj = parseISO(nightDate);
  const dayOfWeek = nightDateObj.getDay();

  // Mon-Wed night coverage forces Thu/Fri recovery in the same week.
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    const monday = addDays(nightDateObj, -(dayOfWeek - 1));
    recoveryDates.add(format(addDays(monday, 3), "yyyy-MM-dd"));
    recoveryDates.add(format(addDays(monday, 4), "yyyy-MM-dd"));
    return recoveryDates;
  }

  // Thu-Sun night coverage forces entire next calendar week as recovery.
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = addDays(nightDateObj, daysUntilNextMonday);
  for (let i = 0; i < 7; i += 1) {
    recoveryDates.add(format(addDays(nextMonday, i), "yyyy-MM-dd"));
  }

  return recoveryDates;
};

const violatesPostNightRecovery = (slots: ShiftSlot[], providerId: string, slot: ShiftSlot, provider: Provider) => {
  if (slot.type === "RECOVERY" || slot.type === "VACATION") return false;

  const nightDates = slots
    .filter((s) => s.providerId === providerId && s.type === "NIGHT")
    .map((s) => s.date);

  for (const nightDate of nightDates) {
    // Keep existing configurable minimum rest behavior.
    const diff = differenceInCalendarDays(parseISO(slot.date), parseISO(nightDate));
    if (diff > 0 && diff <= provider.minDaysOffAfterNight) {
      return true;
    }

    const dynamicRecoveryDates = getDynamicRecoveryDatesForNight(nightDate);
    if (dynamicRecoveryDates.has(slot.date)) {
      return true;
    }
  }

  return false;
};

const canAssignProvider = (
  slots: ShiftSlot[],
  provider: Provider | undefined,
  slot: ShiftSlot,
  customRules: CustomRule[],
  currentSlotId?: string,
  holidayDates?: Set<string>,
) => {
  if (!provider) return { canAssign: false, reason: "No provider" };

  if (provider.timeOffRequests.some(r => r.date === slot.date)) return { canAssign: false, reason: "Time off" };
  const credentialSummary = getProviderCredentialSummary(provider, slot.date);
  if (credentialSummary.hasExpiredCredentials) return { canAssign: false, reason: "Expired credential" };
  if (!provider.skills.includes(slot.requiredSkill)) return { canAssign: false, reason: "Missing skill" };

  // Check scheduling restrictions
  const restrictions = provider.schedulingRestrictions;
  if (restrictions) {
    // Check noNights restriction
    if (restrictions.noNights && slot.type === "NIGHT") {
      return { canAssign: false, reason: "Provider restricted from nights" };
    }

    // Check noWeekends restriction
    if (restrictions.noWeekends && slot.isWeekendLayout) {
      return { canAssign: false, reason: "Provider restricted from weekends" };
    }

    // Check noHolidays restriction
    if (restrictions.noHolidays && holidayDates?.has(slot.date)) {
      return { canAssign: false, reason: "Provider restricted from holidays" };
    }

    // Check maxShiftsPerWeek restriction (0 is a valid cap, so don't use truthiness)
    if (restrictions.maxShiftsPerWeek != null) {
      for (let i = 0; i < 7; i++) {
        const windowStartObj = addDays(parseISO(slot.date), -i);
        const windowStart = format(windowStartObj, "yyyy-MM-dd");
        const windowEnd = format(addDays(windowStartObj, 6), "yyyy-MM-dd");

        const shiftsInWindow = slots.filter(s =>
          s.providerId === provider.id &&
          s.date >= windowStart &&
          s.date <= windowEnd &&
          s.id !== currentSlotId
        );

        if (shiftsInWindow.length + 1 > restrictions.maxShiftsPerWeek) {
          return { canAssign: false, reason: `Max ${restrictions.maxShiftsPerWeek} shifts per week` };
        }
      }
    }

    // Check restricted date ranges
    if (restrictions.restrictedDateRanges) {
      for (const range of restrictions.restrictedDateRanges) {
        if (slot.date >= range.start && slot.date <= range.end) {
          return { canAssign: false, reason: `Restricted: ${range.reason || 'Date range'}` };
        }
      }
    }
  }

  const sameDayShifts = slots.filter(
    (s) => s.id !== currentSlotId && s.date === slot.date && s.providerId === provider.id,
  );
  if (sameDayShifts.length > 0) {
    if (sameDayShifts.some(s => s.location !== slot.location)) return { canAssign: false, reason: "Cross-campus same day" };
    if (slot.type === "NIGHT" && sameDayShifts.some(s => s.type === "DAY")) return { canAssign: false, reason: "Day & Night same day" };
    if (slot.type === "DAY" && sameDayShifts.some(s => s.type === "NIGHT")) return { canAssign: false, reason: "Day & Night same day" };
    if (sameDayShifts.some(s => s.type === slot.type)) return { canAssign: false, reason: "Multiple same shift types" };
  }

  if (slot.type === "NIGHT") {
    const projectedNights = getConsecutiveNights(slots, provider.id, slot.date) + 1;
    if (projectedNights > provider.maxConsecutiveNights) return { canAssign: false, reason: "Max consecutive nights" };
  }

  if (violatesPostNightRecovery(slots, provider.id, slot, provider)) return { canAssign: false, reason: "Post-night recovery" };

  // Evaluate Custom Rules
  for (const rule of customRules) {
    if (rule.type === 'AVOID_PAIRING') {
      const isA = rule.providerA === provider.id;
      const isB = rule.providerB === provider.id;
      if (isA || isB) {
        const otherProviderId = isA ? rule.providerB : rule.providerA;
        const otherWorking = slots.some(s => s.date === slot.date && s.providerId === otherProviderId);
        if (otherWorking) return { canAssign: false, reason: "Custom Rule: Avoid Pairing" };
      }
    } else if (rule.type === 'MAX_SHIFTS_PER_WEEK' && rule.maxShifts) {
      if (rule.providerId === provider.id) {
        // Check all 7-day windows that contain this date
        for (let i = 0; i < 7; i++) {
          const windowStartObj = addDays(parseISO(slot.date), -i);
          const windowStart = format(windowStartObj, "yyyy-MM-dd");
          const windowEnd = format(addDays(windowStartObj, 6), "yyyy-MM-dd");

          const shiftsInWindow = slots.filter(s =>
            s.providerId === provider.id &&
            s.date >= windowStart &&
            s.date <= windowEnd &&
            s.id !== currentSlotId
          );

          if (shiftsInWindow.length + 1 > rule.maxShifts) {
            return { canAssign: false, reason: `Custom Rule: Rolling Max ${rule.maxShifts} shifts/week` };
          }
        }
      }
    }
  }

  return { canAssign: true };
};

const computeDeficitScore = (slot: ShiftSlot, provider: Provider, count: ProviderCounts) => {
  const preferenceBoost = provider.preferredDates.includes(slot.date) ? 2 : 0;
  const criticalBoost = slot.priority === "CRITICAL" ? 1.5 : 0;

  if (slot.type === "DAY") {
    const target = slot.isWeekendLayout ? provider.targetWeekendDays : provider.targetWeekDays;
    const current = slot.isWeekendLayout ? count.weekendDays : count.weekDays;
    return target - current + preferenceBoost + criticalBoost;
  }

  if (slot.type === "NIGHT") {
    const target = provider.targetWeekNights;
    const current = count.weekNights + count.weekendNights;
    return target - current + preferenceBoost + criticalBoost;
  }

  return (provider.targetWeekDays + provider.targetWeekendDays + provider.targetWeekNights)
    - (count.weekDays + count.weekendDays + count.weekNights + count.weekendNights)
    + preferenceBoost;
};

const initialStart = getWeekStart();
const MAX_HISTORY = 50;

// ---------------------------------------------------------------------------
// History helpers — eliminate boilerplate repeated across store actions
// ---------------------------------------------------------------------------

/** Captures current mutable schedule state as an immutable history snapshot. */
function captureHistory(state: ScheduleState | HistoryState | {
  providers: Provider[];
  slots: ShiftSlot[];
  startDate: string;
  numWeeks: number;
  customRules?: CustomRule[];
  dayHandoffs?: import("./types").DayHandoff[];
  auditLog?: AuditLogEntry[];
}): HistoryState {
  return {
    providers: structuredClone(state.providers ?? []),
    slots: structuredClone(state.slots ?? []),
    startDate: state.startDate,
    numWeeks: state.numWeeks,
    customRules: state.customRules ? structuredClone(state.customRules) : [],
    dayHandoffs: state.dayHandoffs ? structuredClone(state.dayHandoffs) : [],
    auditLog: state.auditLog ? structuredClone(state.auditLog) : [],
  };
}

/** Appends a new immutable snapshot to history array, enforcing MAX_HISTORY cap. */
function pushHistory(
  state: ScheduleState,
  newSnapshot: HistoryState,
): { history: HistoryState[]; historyIndex: number } {
  const baseHistory = state.historyIndex >= 0
    ? state.history.slice(0, state.historyIndex + 1)
    : (state.history.length > 0 ? state.history.slice(0, 1) : [captureHistory(state)]);

  const newHistory = [...baseHistory, structuredClone(newSnapshot)].slice(-MAX_HISTORY);
  return { history: newHistory, historyIndex: newHistory.length - 1 };
}

// ---------------------------------------------------------------------------
// Auto-assign priority helpers (hoisted from inside autoAssign closure)
// ---------------------------------------------------------------------------

const getServicePriority = (slot: ShiftSlot): number => {
  const location = slot.serviceLocation;

  // Priority 1 (must cover): G20, H22, Akron
  if (location === "G20" || location === "H22" || location === "Akron") return 0;

  // Priority 2: nights
  if (location === "Nights") return 1;

  // Priority 3: consults/NMET service family
  if (location === "Consults" || location === "NMET" || location === "AMET") return 2;

  // Remaining support services
  return 3;
};

const getLocationPriority = (slot: ShiftSlot): number => {
  const serviceOrder = getServicePriority(slot);
  if (serviceOrder !== 0) return serviceOrder;
  const loc = slot.location.toLowerCase();
  if (loc.includes("g20")) return 0;
  if (loc.includes("h22")) return 1;
  if (loc.includes("akron")) return 2;
  return 3;
};

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      providers: [],
      startDate: initialStart,
      numWeeks: 4,
      slots: generateInitialSlots(initialStart, 4),
      scenarios: [],
      customRules: [],
      lastActionMessage: null,
      toasts: [],
      history: [],
      historyIndex: -1,
      auditLog: [],
      currentUser: null,
      swapRequests: [],
      holidayAssignments: [],
      conflicts: [],
      notifications: [],
      notificationPreferences: {},
      preferenceProfiles: {},
      mlSuggestions: [],
      scheduleTemplates: [],
      dayHandoffs: [],
      marketplaceShifts: [],
      broadcastHistory: [],
      escalationConfig: { autoEscalationDelayMinutes: 60, maxEscalationTiers: 3 },
      isCopilotOpen: false,
      selectedDate: null,
      selectedProviderId: null,
      scheduleViewport: {
        surfaceView: "calendar",
        calendarPresentationMode: "grid",
        currentWeekOffset: 0,
        shiftTypeFilter: "all",
        showConflictsOnly: false,
        showUnfilledOnly: false,
        providerSearchTerm: "",
      },
      // Cloud sync status
      syncStatus: "idle" as "idle" | "loading" | "saving" | "synced" | "error",
      syncError: null as string | null,
      lastSyncedAt: null as string | null,

      initialize: async () => {
        get().setSyncStatus("loading");
        // Helper: given a Supabase session, find+set the matching provider as currentUser.
        // This is used both by the auth state listener and the post-load reconciliation step.
        const reconcileUser = (sessionEmail: string | null | undefined) => {
          if (!sessionEmail) return;
          const { providers } = get();
          const user = providers.find(
            (p) => p.email?.toLowerCase() === sessionEmail.toLowerCase()
          );
          if (user && get().currentUser?.id !== user.id) {
            set({ currentUser: user });
          }
        };

        // 1. Set up session listener
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === "SIGNED_IN" && session?.user) {
            // Try immediate lookup. If providers haven't loaded yet (race condition),
            // wait for loadScheduleState() below to finish — it will call reconcileUser().
            reconcileUser(session.user.email);
          } else if (event === "SIGNED_OUT") {
            set({ currentUser: null });
          }
        });

        // 2. Load initial state from Supabase
        try {
          const { state } = await loadScheduleState();
          if (state) {
            set({
              providers: state.providers,
              slots: state.slots,
              startDate: (state.startDate && isValid(parseISO(state.startDate))) ? state.startDate : getWeekStart(),
              numWeeks: state.numWeeks,
              customRules: state.customRules,
              auditLog: state.auditLog,
              dayHandoffs: state.dayHandoffs || [],
            });
            get().setSyncStatus("synced");
          } else {
            get().setSyncStatus("idle");
          }
        } catch (error) {
          console.error("Failed to load initial state:", error);
          get().setSyncStatus("error", error instanceof Error ? error.message : "Failed to load from cloud");
        }

        // 3. After providers are populated, reconcile currentUser against the active
        //    Supabase session. This fixes the race where SIGNED_IN fires before step 2
        //    finishes, leaving currentUser null and showing a blank page.
        if (!get().currentUser) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            reconcileUser(session?.user?.email);
          } catch {
            // Non-fatal: user will see the login screen and can sign in manually.
          }
        }

        // 4. Ensure initial baseline is recorded in history if history is empty
        const currentState = get();
        if (currentState.history.length === 0) {
          const baseline = captureHistory(currentState);
          set({ history: [baseline], historyIndex: 0 });
        }
      },

      login: async (email) => {
        const normalizedEmail = email.toLowerCase().trim();
        const isAdminEmail = normalizedEmail === DEFAULT_ADMIN_CREDENTIALS.email.toLowerCase();
        
        // Check for force local auth via URL parameter or hash
        const urlParams = new URLSearchParams(window.location.search);
        const forceLocalAuth = urlParams.has('local') || window.location.hash === '#admin';
        const bypassSupabase = shouldUseLocalAuthBypass() || forceLocalAuth || isAdminEmail;

        if (bypassSupabase) {
          console.log('[Auth] Using local authentication for:', normalizedEmail);

          // Find provider by email
          const provider = get().providers.find(p =>
            p.email?.toLowerCase() === normalizedEmail
          );

          if (provider) {
            set({ currentUser: provider });
            get().showToast({
              type: "success",
              title: "Welcome back",
              message: `Logged in as ${provider.name}`
            });
          } else {
            // Auto-create a provider for unknown emails in local auth mode
            const isAdminEmail = normalizedEmail === 'admin@neuroicu.com';
            const newProvider: Provider = {
              id: crypto.randomUUID(),
              name: isAdminEmail ? 'Admin User' : normalizedEmail.split('@')[0],
              email: normalizedEmail,
              role: isAdminEmail ? "ADMIN" : "CLINICIAN",
              targetWeekDays: 10,
              targetWeekendDays: 4,
              targetWeekNights: 3,
              targetWeekendNights: 2,
              timeOffRequests: [],
              preferredDates: [],
              skills: ["NEURO_CRITICAL"],
              maxConsecutiveNights: 2,
              minDaysOffAfterNight: 1,
            };

            set(state => ({
              providers: [...state.providers, newProvider],
              currentUser: newProvider
            }));

            get().showToast({
              type: "success",
              title: "Welcome",
              message: `Created account for ${normalizedEmail}`
            });
          }
          return;
        }

        // PRODUCTION: Use Supabase Magic Link
        try {
          const { error } = await supabase.auth.signInWithOtp({
            email: normalizedEmail,
            options: {
              emailRedirectTo: window.location.origin,
            }
          });

          if (error) {
            console.error("Supabase Login Error:", error);
            // Fall back to local auth on rate limit or connection errors
            if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('Failed to fetch')) {
              console.log('[Auth] Supabase failed, falling back to local auth');
              get().showToast({
                type: "info",
                title: "Using Offline Mode",
                message: "Authentication server unavailable. Using local mode."
              });
              // Retry with local auth
              get().login(normalizedEmail);
              return;
            }
            get().showToast({
              type: "error",
              title: "Login Failed",
              message: error.message.includes("Failed to fetch")
                ? "Connection failed: Check your internet or Supabase configuration."
                : error.message
            });
          } else {
            get().showToast({ type: "success", title: "Check your email", message: "A login link has been sent to your inbox." });
          }
        } catch (error) {
          console.error("Unexpected Login Error:", error);

          // Fall back to local auth on unexpected errors
          console.log('[Auth] Unexpected error, falling back to local auth');
          get().showToast({
            type: "info",
            title: "Using Offline Mode",
            message: "Authentication server error. Using local mode."
          });
          get().login(normalizedEmail);
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ currentUser: null });
        get().showToast({ type: "info", title: "Logged Out", message: "You have been logged out." });
      },

      register: async (provider) => {
        const normalizedEmail = provider.email?.toLowerCase().trim();
        const bypassSupabase = shouldUseLocalAuthBypass();

        const addProviderLocally = (providerToAdd: Provider) => {
          const state = get();
          const historyState: HistoryState = {
            providers: state.providers,
            slots: state.slots,
            startDate: state.startDate,
            numWeeks: state.numWeeks,
            customRules: state.customRules,
            dayHandoffs: state.dayHandoffs,
            auditLog: state.auditLog,
          };
          const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

          set({
            providers: [...state.providers, providerToAdd],
            currentUser: providerToAdd,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            lastActionMessage: `Self-registered: ${providerToAdd.name}`,
          });
        };

        if (bypassSupabase) {
          if (normalizedEmail && get().providers.some(p => p.email?.toLowerCase() === normalizedEmail)) {
            get().showToast({ type: "error", title: "Registration Failed", message: "Email already in use." });
            return;
          }

          const newProvider: Provider = {
            ...provider,
            email: normalizedEmail,
            id: crypto.randomUUID(),
          };

          addProviderLocally(newProvider);
          get().showToast({
            type: "success",
            title: "Registration Successful",
            message: `Welcome, ${newProvider.name}! (DEV mode)`,
          });
          return;
        }

        try {
          if (normalizedEmail && get().providers.some(p => p.email?.toLowerCase() === normalizedEmail)) {
            get().showToast({ type: "error", title: "Registration Failed", message: "Email already in use." });
            return;
          }
          const { provider: newProvider } = await registerProvider(provider);
          addProviderLocally(newProvider);
          get().showToast({ type: "success", title: "Registration Successful", message: `Welcome, ${newProvider.name}!` });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Email already in use.";
          if (isDuplicateRegistrationError(message)) {
            get().showToast({ type: "error", title: "Registration Failed", message: "Email already in use." });
            return;
          }
          if (isNetworkRegistrationError(message) || !bypassSupabase) {
            if (normalizedEmail && get().providers.some(p => p.email?.toLowerCase() === normalizedEmail)) {
              get().showToast({ type: "error", title: "Registration Failed", message: "Email already in use." });
              return;
            }

            const fallbackProvider: Provider = {
              ...provider,
              email: normalizedEmail,
              id: crypto.randomUUID(),
            };

            addProviderLocally(fallbackProvider);
            get().showToast({
              type: "warning",
              title: "Registered in Offline Mode",
              message: "Auth service is unavailable, so your profile was created locally for now.",
            });
            return;
          }

          get().showToast({ type: "error", title: "Registration Failed", message });
        }
      },

      addProvider: (provider) => {
        const state = get();
        const candidateId = "id" in provider && typeof (provider as Partial<Provider>).id === "string"
          ? (provider as Partial<Provider>).id!
          : crypto.randomUUID();
        const newProvider: Provider = { ...provider, id: candidateId };
        const nextProviders = [...state.providers, newProvider];
        const nextSnapshot = captureHistory({ ...state, providers: nextProviders });
        const hist = pushHistory(state, nextSnapshot);

        set({
          providers: nextProviders,
          ...hist,
          lastActionMessage: `Added ${provider.name} to roster.`,
        });

        get().showToast({ type: "success", title: "Provider Added", message: `${provider.name} has been added to the roster.` });
      },

      updateProvider: (id, updates) => {
        const state = get();
        const nextProviders = state.providers.map((p) => (p.id === id ? { ...p, ...updates } : p));
        const nextSnapshot = captureHistory({ ...state, providers: nextProviders });
        const hist = pushHistory(state, nextSnapshot);

        set({
          providers: nextProviders,
          ...hist,
          lastActionMessage: "Provider updated.",
        });
      },

      removeProvider: (id) => {
        const state = get();
        const provider = state.providers.find(p => p.id === id);
        const nextProviders = state.providers.filter((p) => p.id !== id);
        const nextSlots = state.slots.map((s) => (s.providerId === id ? { ...s, providerId: null } : s));
        const nextSnapshot = captureHistory({ ...state, providers: nextProviders, slots: nextSlots });
        const hist = pushHistory(state, nextSnapshot);

        set({
          providers: nextProviders,
          slots: nextSlots,
          ...hist,
          lastActionMessage: "Provider removed and related assignments cleared.",
        });

        get().showToast({ type: "info", title: "Provider Removed", message: provider ? `${provider.name} has been removed.` : undefined });
      },

      setScheduleRange: (startDate, numWeeks) => {
        const state = get();
        const nextSlots = generateInitialSlots(startDate, numWeeks);
        const nextSnapshot = captureHistory({ ...state, startDate, numWeeks, slots: nextSlots });
        const hist = pushHistory(state, nextSnapshot);

        set({
          startDate,
          numWeeks,
          slots: nextSlots,
          ...hist,
          lastActionMessage: "Schedule window updated.",
        });

        get().showToast({ type: "info", title: "Schedule Updated", message: `Now viewing ${numWeeks} week${numWeeks > 1 ? 's' : ''} starting ${startDate}.` });
      },

      addCustomRule: (rule) => {
        const state = get();
        const nextRules = [...state.customRules, { ...rule, id: crypto.randomUUID() }];
        const nextSnapshot = captureHistory({ ...state, customRules: nextRules });
        const hist = pushHistory(state, nextSnapshot);

        set({
          customRules: nextRules,
          ...hist,
          lastActionMessage: `Added custom rule: ${rule.type}`,
        });
        get().showToast({ type: "success", title: "Rule Added", message: `Custom rule created.` });
      },

      updateCustomRule: (id, updates) => {
        const state = get();
        const index = state.customRules.findIndex((r) => r.id === id);
        if (index < 0) return;
        const rule = state.customRules[index];
        const updated = { ...rule, ...updates };
        const next = state.customRules.slice();
        next[index] = updated;
        const nextSnapshot = captureHistory({ ...state, customRules: next });
        const hist = pushHistory(state, nextSnapshot);

        set({
          customRules: next,
          ...hist,
          lastActionMessage: "Custom rule updated.",
          auditLog: [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              action: "RULE_CHANGE" as const,
              details: `Updated custom rule: ${rule.type}`,
              user: state.currentUser?.name ?? "System",
            },
            ...state.auditLog,
          ],
        });
        get().showToast({ type: "info", title: "Rule Updated" });
      },

      removeCustomRule: (id) => {
        const state = get();
        const ruleToRemove = state.customRules.find(r => r.id === id);
        const nextRules = state.customRules.filter(r => r.id !== id);
        const nextSnapshot = captureHistory({ ...state, customRules: nextRules });
        const hist = pushHistory(state, nextSnapshot);

        set({
          customRules: nextRules,
          ...hist,
          lastActionMessage: `Removed custom rule.`,
          auditLog: [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              action: "RULE_CHANGE" as const,
              details: `Removed custom rule: ${ruleToRemove?.type || id}`,
              user: state.currentUser?.name ?? "System",
            },
            ...state.auditLog
          ]
        });
        get().showToast({ type: "info", title: "Rule Removed" });
      },

      assignShift: (slotId, providerId) =>
        set((state) => {
          const slot = state.slots.find((s) => s.id === slotId);
          const provider = state.providers.find((p) => p.id === providerId);
          const action = providerId ? "ASSIGN" : "UNASSIGN";
          const details = providerId
            ? `Assigned ${provider?.name} to ${slot?.type} shift on ${slot?.date}`
            : `Removed assignment from ${slot?.type} shift on ${slot?.date}`;

          // Check if assignment is valid before proceeding with state change and history
          if (providerId !== null) {
            if (!slot) {
              get().showToast({ type: "error", title: "Assignment Failed", message: "Slot not found." });
              return state;
            }
            if (!provider) {
              get().showToast({ type: "error", title: "Assignment Failed", message: "Provider not found." });
              return state;
            }
            const canAssignResult = canAssignProvider(state.slots, provider, slot, state.customRules, slot.id);
            if (!canAssignResult.canAssign) {
              get().showToast({ type: "error", title: "Assignment Failed", message: canAssignResult.reason });
              return state;
            }
          }

          const newAuditEntry: AuditLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            action,
            details,
            slotId,
            providerId: providerId || undefined,
            user: state.currentUser?.name ?? "System",
          };

          const nextSlots = state.slots.map((s) =>
            s.id === slotId ? { ...s, providerId } : s
          );
          const nextAuditLog = [newAuditEntry, ...state.auditLog];

          const postUpdateSnapshot: HistoryState = {
            providers: structuredClone(state.providers),
            slots: structuredClone(nextSlots),
            startDate: state.startDate,
            numWeeks: state.numWeeks,
            customRules: structuredClone(state.customRules),
            dayHandoffs: state.dayHandoffs ? structuredClone(state.dayHandoffs) : [],
            auditLog: structuredClone(nextAuditLog),
          };
          const { history: newHistory, historyIndex: newHistoryIndex } = pushHistory(state, postUpdateSnapshot);

          return {
            slots: nextSlots,
            auditLog: nextAuditLog,
            history: newHistory,
            historyIndex: newHistoryIndex,
            lastActionMessage: details,
          };
        }),

      clearAssignments: () => {
        const state = get();
        const nextSlots = state.slots.map((s) => ({ ...s, providerId: null }));
        const nextAudit: AuditLogEntry[] = [
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            action: "UNASSIGN" as const,
            details: "Cleared all assignments",
            user: state.currentUser?.name ?? "System",
          },
          ...state.auditLog
        ];
        const nextSnapshot = captureHistory({ ...state, slots: nextSlots, auditLog: nextAudit });
        const hist = pushHistory(state, nextSnapshot);

        set({
          slots: nextSlots,
          auditLog: nextAudit,
          ...hist,
          lastActionMessage: "All assignments cleared.",
        });

        get().showToast({ type: "warning", title: "Assignments Cleared", message: "All shift assignments have been removed." });
      },

      clearStaff: () => {
        const state = get();
        const nextSlots = state.slots.map((s) => ({ ...s, providerId: null }));
        const nextAudit: AuditLogEntry[] = [
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            action: "CLEAR" as const,
            details: "Cleared all staff profiles and related assignments",
            user: state.currentUser?.name ?? "System",
          },
          ...state.auditLog
        ];
        const nextSnapshot = captureHistory({ ...state, providers: [], slots: nextSlots, customRules: [], auditLog: nextAudit });
        const hist = pushHistory(state, nextSnapshot);

        set({
          providers: [],
          slots: nextSlots,
          customRules: [],
          auditLog: nextAudit,
          ...hist,
          lastActionMessage: "All staff profiles cleared.",
        });

        get().showToast({ type: "warning", title: "Staff Cleared", message: "All providers and related rules were removed." });
      },

      clearSchedule: () => {
        const state = get();
        const nextSlots = state.slots.length > 0
          ? state.slots.map((s) => ({ ...s, providerId: null }))
          : generateInitialSlots(state.startDate, state.numWeeks);
        const nextAudit: AuditLogEntry[] = [
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            action: "CLEAR" as const,
            details: "Cleared schedule assignments and saved scenarios",
            user: state.currentUser?.name ?? "System",
          },
          ...state.auditLog
        ];
        const nextSnapshot = captureHistory({ ...state, slots: nextSlots, scenarios: [], auditLog: nextAudit });
        const hist = pushHistory(state, nextSnapshot);

        set({
          slots: nextSlots,
          scenarios: [],
          auditLog: nextAudit,
          ...hist,
          lastActionMessage: "Schedule reset to an empty planning window.",
        });

        get().showToast({ type: "warning", title: "Schedule Cleared", message: "All assignments and scenarios were reset." });
      },

      applyImportedSnapshot: (providers, slots, appliedAssignments, skippedRows) => {
        const state = get();
        const nextSnapshot = captureHistory({ ...state, providers, slots });
        const hist = pushHistory(state, nextSnapshot);

        set({
          providers: structuredClone(providers),
          slots: structuredClone(slots),
          ...hist,
          lastActionMessage: `Import applied: ${appliedAssignments} assignments updated (${skippedRows} rows skipped).`,
        });

        get().detectConflicts();
      },

      autoAssign: () => {
        set((state) => {
          // Build a set of holiday dates for fast lookup
          const holidayDates = new Set(state.holidayAssignments.map(h => h.date));

          const newSlots = [...state.slots].sort((a, b) => {
            const prioA = getLocationPriority(a);
            const prioB = getLocationPriority(b);
            if (prioA !== prioB) return prioA - prioB;
            return a.date.localeCompare(b.date);
          });
          const counts = getProviderCounts(newSlots, state.providers);
          const logs: string[] = [];
          const newAuditEntries: AuditLogEntry[] = [];

          let assignedCount = 0;
          newSlots.forEach((slot, index) => {
            if (slot.providerId) return;

            if (slot.isWeekendLayout && (slot.type === "CONSULTS" || slot.type === "NMET")) {
              logs.push(`Slot ${slot.date} (${slot.type}): Skipped weekend assignment per scheduling rules.`);
              return;
            }

            const candidates = state.providers
              .filter((provider) => {
                const result = canAssignProvider(newSlots, provider, slot, state.customRules, slot.id, holidayDates);
                return result.canAssign;
              })
              .map((provider) => ({ provider, score: computeDeficitScore(slot, provider, counts[provider.id]) }))
              .sort((a, b) => b.score - a.score || a.provider.name.localeCompare(b.provider.name));

            const chosen = candidates[0]?.provider;
            if (!chosen) {
              logs.push(`Slot ${slot.date} (${slot.type}): Failed to find an eligible provider.`);
              return;
            }

            newSlots[index] = { ...slot, providerId: chosen.id };
            assignedCount += 1;
            const logMsg = `Slot ${slot.date} (${slot.type}): Assigned ${chosen.name} (Score: ${candidates[0].score.toFixed(2)}). Next best was ${candidates[1]?.provider?.name || 'none'}.`;
            logs.push(logMsg);

            newAuditEntries.push({
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              action: "ASSIGN",
              details: `Auto-assigned: ${chosen.name} to ${slot.type} on ${slot.date}`,
              slotId: slot.id,
              providerId: chosen.id,
              user: "Auto Engine",
            });

            const cc = counts[chosen.id];
            if (slot.type === "DAY") {
              if (slot.isWeekendLayout) cc.weekendDays += 1;
              else cc.weekDays += 1;
            } else if (slot.type === "NIGHT") {
              if (slot.isWeekendLayout) cc.weekendNights += 1;
              else cc.weekNights += 1;
            }
          });

          const nextAuditLog = [...newAuditEntries, ...state.auditLog];
          const nextSnapshot = captureHistory({
            ...state,
            slots: newSlots,
            auditLog: nextAuditLog,
          });
          const hist = pushHistory(state, nextSnapshot);

          return {
            slots: newSlots,
            ...hist,
            assignmentLogs: logs,
            auditLog: nextAuditLog,
            lastActionMessage: assignedCount > 0
              ? `Auto-assigned ${assignedCount} shifts using constraints: skills, fatigue, fairness, and preferences.`
              : `Auto-assigned 0 shifts. All eligible providers are at capacity or restricted by time-off/skills.`,
          };
        });

        get().showToast({
          type: "success",
          title: "Auto-Assignment Complete",
          message: "Shifts have been assigned based on skills, fatigue, and preferences.",
        });
      },

      createScenario: (name) => {
        const trimmed = name ? name.trim() : "";
        if (!trimmed) {
          get().showToast({
            type: "error",
            title: "Validation Error",
            message: "Scenario name cannot be blank. Please enter a descriptive name.",
          });
          return;
        }

        const state = get();
        const isDuplicate = state.scenarios.some(
          (s) => s.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (isDuplicate) {
          get().showToast({
            type: "error",
            title: "Duplicate Scenario",
            message: `A scenario named "${trimmed}" already exists. Please choose a unique name.`,
          });
          return;
        }

        const snapshot: ScenarioSnapshot = {
          id: crypto.randomUUID(),
          name: trimmed,
          createdAt: new Date().toISOString(),
          providers: structuredClone(state.providers),
          slots: structuredClone(state.slots),
          startDate: state.startDate,
          numWeeks: state.numWeeks,
        };

        set({
          scenarios: [snapshot, ...state.scenarios].slice(0, 12),
          lastActionMessage: `Saved scenario: ${trimmed}`,
        });

        get().showToast({ type: "success", title: "Scenario Saved", message: `"${trimmed}" has been saved.` });
      },

      loadScenario: (id) => {
        const state = get();
        const found = state.scenarios.find((scenario) => scenario.id === id);
        if (!found) return;

        const nextSnapshot = captureHistory({
          ...state,
          providers: found.providers,
          slots: found.slots,
          startDate: found.startDate,
          numWeeks: found.numWeeks,
        });
        const hist = pushHistory(state, nextSnapshot);

        set({
          providers: structuredClone(found.providers),
          slots: structuredClone(found.slots),
          startDate: found.startDate,
          numWeeks: found.numWeeks,
          ...hist,
          lastActionMessage: `Loaded scenario: ${found.name}`,
        });

        get().showToast({ type: "info", title: "Scenario Loaded", message: `"${found.name}" has been restored.` });
      },

      updateScenario: (id, updates) => {
        const state = get();
        const index = state.scenarios.findIndex((s) => s.id === id);
        if (index < 0) return;
        const scenario = state.scenarios[index];
        const updated = { ...scenario, ...updates };
        const next = state.scenarios.slice();
        next[index] = updated;
        set({
          scenarios: next,
          lastActionMessage: updates.name != null ? `Renamed scenario to "${updates.name}"` : "Scenario updated.",
        });
        if (updates.name != null) {
          get().showToast({ type: "success", title: "Scenario Updated", message: `Scenario renamed to "${updates.name}".` });
        }
      },

      deleteScenario: (id) => {
        const state = get();
        const scenario = state.scenarios.find((s) => s.id === id);
        set((s) => ({
          scenarios: s.scenarios.filter((sc) => sc.id !== id),
          lastActionMessage: scenario ? `Deleted scenario: ${scenario.name}` : "Scenario deleted.",
        }));

        get().showToast({
          type: "info",
          title: "Scenario Deleted",
          message: scenario ? `"${scenario.name}" has been deleted.` : undefined,
        });
      },

      clearMessage: () => set({ lastActionMessage: null }),

      showToast: (toast) => {
        const id = crypto.randomUUID();
        const duration = toast.duration ?? 4000;

        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));

        if (duration > 0) {
          setTimeout(() => {
            get().dismissToast(id);
          }, duration);
        }
      },

      dismissToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      undo: () => {
        const state = get();
        if (state.historyIndex <= 0 || state.history.length === 0) return;

        const targetIndex = state.historyIndex - 1;
        const targetState = state.history[targetIndex];
        if (!targetState) return;

        set({
          providers: structuredClone(targetState.providers),
          slots: structuredClone(targetState.slots),
          startDate: targetState.startDate,
          numWeeks: targetState.numWeeks,
          customRules: structuredClone(targetState.customRules),
          dayHandoffs: targetState.dayHandoffs ? structuredClone(targetState.dayHandoffs) : [],
          historyIndex: targetIndex,
          lastActionMessage: "Undo applied.",
        });

        get().showToast({ type: "info", title: "Undo", message: "Previous action has been undone." });
      },

      redo: () => {
        const state = get();
        if (state.historyIndex >= state.history.length - 1 || state.historyIndex < 0) return;

        const targetIndex = state.historyIndex + 1;
        const targetState = state.history[targetIndex];
        if (!targetState) return;

        set({
          providers: structuredClone(targetState.providers),
          slots: structuredClone(targetState.slots),
          startDate: targetState.startDate,
          numWeeks: targetState.numWeeks,
          customRules: structuredClone(targetState.customRules),
          dayHandoffs: targetState.dayHandoffs ? structuredClone(targetState.dayHandoffs) : [],
          historyIndex: targetIndex,
          lastActionMessage: "Redo applied.",
        });

        get().showToast({ type: "info", title: "Redo", message: "Action has been restored." });
      },

      canUndo: () => {
        const state = get();
        return state.historyIndex > 0;
      },

      canRedo: () => {
        const state = get();
        return state.historyIndex >= 0 && state.historyIndex < state.history.length - 1;
      },

      restoreLastKnownGoodSchedule: () => {
        const state = get();
        let candidate: HistoryState | null = null;
        if (state.scenarios.length > 0) {
          candidate = {
            providers: state.scenarios[0].providers,
            slots: state.scenarios[0].slots,
            startDate: state.scenarios[0].startDate,
            numWeeks: state.scenarios[0].numWeeks,
            customRules: state.customRules,
            auditLog: state.auditLog,
          };
        } else if (state.history.length > 0) {
          candidate = state.history[0];
        }

        if (!candidate) {
          get().showToast({
            type: "info",
            title: "No Previous Snapshot",
            message: "No baseline schedule snapshot found to restore.",
          });
          return;
        }

        const nextSnapshot = captureHistory(candidate);
        const hist = pushHistory(state, nextSnapshot);

        set({
          providers: structuredClone(candidate.providers),
          slots: structuredClone(candidate.slots),
          startDate: candidate.startDate,
          numWeeks: candidate.numWeeks,
          customRules: candidate.customRules ? structuredClone(candidate.customRules) : state.customRules,
          ...hist,
          lastActionMessage: "Restored last known good schedule.",
        });

        get().showToast({
          type: "success",
          title: "Schedule Restored",
          message: "Restored to the last known good schedule state.",
        });
      },

      deduplicateProviders: (mergeMap) => {
        const state = get();
        if (mergeMap.length === 0) return;

        let nextProviders = [...state.providers];
        let nextSlots = [...state.slots];
        let mergedCount = 0;

        mergeMap.forEach(({ canonicalId, duplicateIds }) => {
          const canonical = nextProviders.find(p => p.id === canonicalId);
          if (!canonical) return;

          const duplicateSet = new Set(duplicateIds);
          const duplicates = nextProviders.filter(p => duplicateSet.has(p.id));

          // Merge skills and time-off into canonical
          duplicates.forEach(dup => {
            canonical.skills = Array.from(new Set([...canonical.skills, ...dup.skills]));
            canonical.timeOffRequests = [...canonical.timeOffRequests, ...dup.timeOffRequests];
            canonical.preferredDates = Array.from(new Set([...canonical.preferredDates, ...dup.preferredDates]));
          });

          // Reassign slots pointing to duplicates
          nextSlots = nextSlots.map(slot => {
            if (slot.providerId && duplicateSet.has(slot.providerId)) {
              return { ...slot, providerId: canonicalId };
            }
            return slot;
          });

          // Remove duplicates from providers array
          nextProviders = nextProviders.filter(p => !duplicateSet.has(p.id));
          mergedCount += duplicates.length;
        });

        const nextSnapshot = captureHistory({
          ...state,
          providers: nextProviders,
          slots: nextSlots,
        });
        const hist = pushHistory(state, nextSnapshot);

        set({
          providers: nextProviders,
          slots: nextSlots,
          ...hist,
          lastActionMessage: `Merged and cleaned ${mergedCount} duplicate provider records.`,
        });

        get().showToast({
          type: "success",
          title: "Deduplication Complete",
          message: `Merged ${mergedCount} duplicate records and updated shift assignments.`,
        });
      },

      // Swap Management
      createSwapRequest: (request) => {
        const state = get();
        const newRequest: SwapRequest = {
          ...request,
          id: crypto.randomUUID(),
          status: 'pending',
          requestedAt: new Date().toISOString(),
        };
        set({
          swapRequests: [newRequest, ...state.swapRequests],
          lastActionMessage: `Swap request created by ${state.providers.find(p => p.id === request.requestorId)?.name}`,
        });
        get().showToast({ type: "info", title: "Swap Requested", message: "Request submitted for approval." });
      },

      approveSwapRequest: (id, approverId) => {
        const state = get();
        const request = state.swapRequests.find(r => r.id === id);
        if (!request || request.status !== 'pending') return;

        // Locate both legs before touching anything, so a stale request (a
        // side reassigned or deleted since it was created) can't apply a
        // one-sided swap.
        const fromSlot = state.slots.find(
          s => s.date === request.fromDate && s.providerId === request.requestorId
        );
        const toSlot = request.targetProviderId
          ? state.slots.find(s => s.date === request.toDate && s.providerId === request.targetProviderId)
          : undefined;

        if (!fromSlot || (request.targetProviderId && !toSlot)) {
          get().showToast({
            type: "error",
            title: "Swap No Longer Valid",
            message: "One of the shifts has changed since this request was made. Reject the request and ask for a new one.",
          });
          return;
        }

        // Perform the swap in slots
        const newSlots = state.slots.map(slot => {
          if (slot.id === fromSlot.id) {
            return { ...slot, providerId: request.targetProviderId || null };
          }
          if (toSlot && slot.id === toSlot.id) {
            return { ...slot, providerId: request.requestorId };
          }
          return slot;
        });

        // Re-validate both providers against the post-swap schedule (time
        // off, double-booking, rest rules) before committing.
        const validations: { providerId: string; slot: ShiftSlot }[] = [];
        if (request.targetProviderId) {
          validations.push({ providerId: request.targetProviderId, slot: fromSlot });
        }
        if (toSlot) {
          validations.push({ providerId: request.requestorId, slot: toSlot });
        }
        for (const { providerId, slot } of validations) {
          const provider = state.providers.find(p => p.id === providerId);
          const result = canAssignProvider(newSlots, provider, slot, state.customRules, slot.id);
          if (!result.canAssign) {
            get().showToast({
              type: "error",
              title: "Swap Blocked",
              message: `${provider?.name || 'Provider'} can't take ${slot.date}: ${result.reason}`,
            });
            return;
          }
        }

        set({
          slots: newSlots,
          swapRequests: state.swapRequests.map(r =>
            r.id === id
              ? { ...r, status: 'approved', resolvedAt: new Date().toISOString(), resolvedBy: approverId }
              : r
          ),
          auditLog: [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              action: 'ASSIGN',
              details: `Swap approved: ${state.providers.find(p => p.id === request.requestorId)?.name} ↔ ${state.providers.find(p => p.id === request.targetProviderId)?.name}`,
              user: state.providers.find(p => p.id === approverId)?.name || 'Scheduler'
            },
            ...state.auditLog
          ],
          lastActionMessage: "Swap request approved and applied",
        });

        get().showToast({ type: "success", title: "Swap Approved", message: "Schedule has been updated." });
      },

      rejectSwapRequest: (id, approverId, reason) => {
        const state = get();
        set({
          swapRequests: state.swapRequests.map(r =>
            r.id === id
              ? { ...r, status: 'rejected', resolvedAt: new Date().toISOString(), resolvedBy: approverId, notes: reason || r.notes }
              : r
          ),
          lastActionMessage: "Swap request rejected",
        });
        get().showToast({ type: "info", title: "Swap Rejected", message: reason || "Request declined." });
      },

      cancelSwapRequest: (id) => {
        const state = get();
        set({
          swapRequests: state.swapRequests.map(r =>
            r.id === id ? { ...r, status: 'cancelled' } : r
          ),
          lastActionMessage: "Swap request cancelled",
        });
        get().showToast({ type: "info", title: "Swap Cancelled" });
      },

      // Holiday Management
      addHolidayAssignment: (assignment) => {
        const state = get();
        // Remove any existing assignment for this holiday
        const filtered = state.holidayAssignments.filter(
          h => !(h.holidayName === assignment.holidayName && h.date === assignment.date)
        );
        set({
          holidayAssignments: [...filtered, assignment],
          lastActionMessage: `Holiday assigned: ${assignment.holidayName}`,
        });
      },

      updateHolidayAssignment: (holidayName, date, updates) => {
        const state = get();
        const index = state.holidayAssignments.findIndex(
          (h) => h.holidayName === holidayName && h.date === date
        );
        if (index < 0) return;
        const assignment = state.holidayAssignments[index];
        const updated = { ...assignment, ...updates };
        const next = state.holidayAssignments.slice();
        next[index] = updated;
        set({
          holidayAssignments: next,
          lastActionMessage: `Holiday assignment updated: ${holidayName}`,
        });
      },

      removeHolidayAssignment: (holidayName, date) => {
        const state = get();
        set({
          holidayAssignments: state.holidayAssignments.filter(
            h => !(h.holidayName === holidayName && h.date === date)
          ),
          lastActionMessage: `Holiday assignment removed: ${holidayName}`,
        });
      },

      getProviderHolidayCount: (providerId, year) => {
        const state = get();
        return state.holidayAssignments.filter(
          h => h.providerId === providerId && h.date.startsWith(String(year))
        ).length;
      },

      // Conflict Detection & Resolution
      detectConflicts: () => {
        const state = get();
        const conflicts: Conflict[] = [];
        const counts = getProviderCounts(state.slots, state.providers);

        state.providers.forEach(provider => {
          const count = counts[provider.id];
          if (!count) return;

          // Check FTE overloads
          if (count.weekDays > provider.targetWeekDays) {
            conflicts.push({
              id: crypto.randomUUID(),
              type: 'OVERLOAD_FTE',
              severity: 'WARNING',
              providerId: provider.id,
              title: `${provider.name} exceeds week day target`,
              description: `Assigned ${count.weekDays} days, target is ${provider.targetWeekDays}`,
              detectedAt: new Date().toISOString(),
              autoResolvable: true,
              suggestedActions: [
                { id: 'redistribute', label: 'Redistribute Shifts', type: 'REASSIGN', description: 'Move excess shifts to other providers' },
                { id: 'increase-target', label: 'Increase Target', type: 'MANUAL', description: 'Update FTE target if acceptable' },
              ]
            });
          }

          if (count.weekendDays > provider.targetWeekendDays) {
            conflicts.push({
              id: crypto.randomUUID(),
              type: 'OVERLOAD_FTE',
              severity: 'WARNING',
              providerId: provider.id,
              title: `${provider.name} exceeds weekend day target`,
              description: `Assigned ${count.weekendDays} weekends, target is ${provider.targetWeekendDays}`,
              detectedAt: new Date().toISOString(),
              autoResolvable: true,
              suggestedActions: [
                { id: 'redistribute', label: 'Redistribute Shifts', type: 'REASSIGN', description: 'Move excess shifts to other providers' },
              ]
            });
          }

          // Check consecutive nights
          const nightSlots = state.slots.filter(s => s.providerId === provider.id && s.type === 'NIGHT');
          let consecutive = 0;
          let maxConsecutive = 0;
          let prevDate: Date | null = null;

          nightSlots.sort((a, b) => a.date.localeCompare(b.date)).forEach(slot => {
            const currDate = parseISO(slot.date);
            if (prevDate && differenceInCalendarDays(currDate, prevDate) === 1) {
              consecutive++;
            } else {
              consecutive = 1;
            }
            maxConsecutive = Math.max(maxConsecutive, consecutive);
            prevDate = currDate;
          });

          if (maxConsecutive > provider.maxConsecutiveNights) {
            conflicts.push({
              id: crypto.randomUUID(),
              type: 'CONSECUTIVE_NIGHTS',
              severity: 'CRITICAL',
              providerId: provider.id,
              title: `${provider.name} exceeds max consecutive nights`,
              description: `Found ${maxConsecutive} consecutive nights, max allowed is ${provider.maxConsecutiveNights}`,
              detectedAt: new Date().toISOString(),
              autoResolvable: false,
              suggestedActions: [
                { id: 'break-sequence', label: 'Break Sequence', type: 'MANUAL', description: 'Manually remove a night shift to break the sequence' },
              ]
            });
          }

          // Check credential expirations
          provider.credentials?.forEach(cred => {
            if (cred.expiresAt) {
              const daysUntil = differenceInCalendarDays(parseISO(cred.expiresAt), new Date());
              if (daysUntil < 0) {
                conflicts.push({
                  id: crypto.randomUUID(),
                  type: 'CREDENTIAL_EXPIRED',
                  severity: 'CRITICAL',
                  providerId: provider.id,
                  title: `${provider.name}'s ${cred.credentialType} has expired`,
                  description: `Expired on ${cred.expiresAt}`,
                  detectedAt: new Date().toISOString(),
                  autoResolvable: false,
                  suggestedActions: [
                    { id: 'update-credential', label: 'Update Credential', type: 'MANUAL', description: 'Update credential with new expiration date' },
                    { id: 'restrict-assignments', label: 'Restrict Assignments', type: 'AUTO_FIX', description: 'Block new assignments until updated' },
                  ]
                });
              } else if (daysUntil <= 30) {
                conflicts.push({
                  id: crypto.randomUUID(),
                  type: 'CREDENTIAL_EXPIRING',
                  severity: daysUntil <= 7 ? 'CRITICAL' : 'WARNING',
                  providerId: provider.id,
                  title: `${provider.name}'s ${cred.credentialType} expiring soon`,
                  description: `Expires in ${daysUntil} days`,
                  detectedAt: new Date().toISOString(),
                  autoResolvable: false,
                  suggestedActions: [
                    { id: 'renew-credential', label: 'Renew Credential', type: 'MANUAL', description: 'Schedule renewal' },
                  ]
                });
              }
            }
          });
        });

        // Check skill mismatches
        state.slots.forEach(slot => {
          if (slot.providerId) {
            const provider = state.providers.find(p => p.id === slot.providerId);
            if (provider && !provider.skills.includes(slot.requiredSkill)) {
              conflicts.push({
                id: crypto.randomUUID(),
                type: 'SKILL_MISMATCH',
                severity: 'CRITICAL',
                providerId: provider.id,
                slotId: slot.id,
                title: `Skill mismatch: ${provider.name}`,
                description: `Assigned to ${slot.type} requiring ${slot.requiredSkill}, but lacks this skill`,
                detectedAt: new Date().toISOString(),
                autoResolvable: false,
                suggestedActions: [
                  { id: 'reassign', label: 'Reassign Shift', type: 'REASSIGN', description: 'Find provider with required skill' },
                  { id: 'add-skill', label: 'Add Skill', type: 'MANUAL', description: 'Add skill to provider profile if appropriate' },
                ]
              });
            }
          }
        });

        // Check unfilled critical shifts
        state.slots.filter(s => s.priority === 'CRITICAL' && !s.providerId).forEach(slot => {
          conflicts.push({
            id: crypto.randomUUID(),
            type: 'UNFILLED_CRITICAL',
            severity: 'CRITICAL',
            slotId: slot.id,
            title: `Unfilled critical shift`,
            description: `${slot.type} on ${slot.date} at ${slot.location} is unfilled`,
            detectedAt: new Date().toISOString(),
            autoResolvable: true,
            suggestedActions: [
              { id: 'auto-assign', label: 'Auto-Assign', type: 'AUTO_FIX', description: 'Run auto-assign for this shift' },
              { id: 'manual-assign', label: 'Manual Assign', type: 'MANUAL', description: 'Select provider manually' },
            ]
          });
        });

        // Carry over identity and acknowledged state from the previous run,
        // so re-detecting doesn't resurrect conflicts the team already
        // acknowledged. Conflicts are identified by what they describe, not
        // by their generated UUID.
        const conflictKey = (c: Conflict) => `${c.type}|${c.providerId ?? ''}|${c.slotId ?? ''}`;
        const previousByKey = new Map(state.conflicts.map(c => [conflictKey(c), c]));
        const mergedConflicts = conflicts.map(c => {
          const prev = previousByKey.get(conflictKey(c));
          return prev ? { ...c, id: prev.id, acknowledged: prev.acknowledged, detectedAt: prev.detectedAt } : c;
        });

        set({ conflicts: mergedConflicts });
      },

      acknowledgeConflict: (id) => {
        const state = get();
        set({
          conflicts: state.conflicts.map(c =>
            c.id === id ? { ...c, acknowledged: true } : c
          )
        });
      },

      resolveConflict: (id, actionId) => {
        const state = get();
        const conflict = state.conflicts.find(c => c.id === id);
        if (!conflict) return;

        // Apply resolution based on action type
        const action = conflict.suggestedActions.find(a => a.id === actionId);
        if (!action) return;

        // Handle auto-fixable actions
        if (action.type === 'AUTO_FIX') {
          // Implementation depends on conflict type
          if (conflict.type === 'UNFILLED_CRITICAL' && conflict.slotId) {
            // Try to auto-assign this specific slot
            get().autoAssign();
          }
        }

        set({
          conflicts: state.conflicts.map(c =>
            c.id === id ? { ...c, resolvedAt: new Date().toISOString() } : c
          )
        });

        get().showToast({ type: "success", title: "Conflict Resolved", message: action.description });
      },

      ignoreConflict: (id) => {
        const state = get();
        set({
          conflicts: state.conflicts.filter(c => c.id !== id)
        });
      },

      // Notifications
      sendNotification: (notification) => {
        const state = get();
        const newNotification: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set({
          notifications: [newNotification, ...state.notifications]
        });
      },

      markNotificationRead: (id) => {
        const state = get();
        set({
          notifications: state.notifications.map(n =>
            n.id === id ? { ...n, readAt: new Date().toISOString() } : n
          )
        });
      },

      updateNotificationPreferences: (providerId, prefs) => {
        const state = get();
        set({
          notificationPreferences: {
            ...state.notificationPreferences,
            [providerId]: {
              ...state.notificationPreferences[providerId],
              providerId,
              emailEnabled: prefs.emailEnabled ?? state.notificationPreferences[providerId]?.emailEnabled ?? true,
              inAppEnabled: prefs.inAppEnabled ?? state.notificationPreferences[providerId]?.inAppEnabled ?? true,
              subscribedTypes: prefs.subscribedTypes ?? state.notificationPreferences[providerId]?.subscribedTypes ?? [],
              ...prefs,
            }
          }
        });
      },

      // ML & Predictive Scheduling
      analyzeProviderPatterns: () => {
        const state = get();
        const profiles: Record<string, ProviderPreferenceProfile> = {};

        state.providers.forEach(provider => {
          const providerSlots = state.slots.filter(s => s.providerId === provider.id);

          // Analyze preferred weekdays
          const weekdayCounts: Record<number, number> = {};
          const shiftTypeCounts: Record<ShiftType, number> = {
            DAY: 0, NIGHT: 0, NMET: 0, JEOPARDY: 0, RECOVERY: 0, CONSULTS: 0, VACATION: 0
          };

          providerSlots.forEach(slot => {
            const date = parseISO(slot.date);
            const day = date.getDay();
            weekdayCounts[day] = (weekdayCounts[day] || 0) + 1;
            shiftTypeCounts[slot.type]++;
          });

          // Determine preferred weekdays (above average)
          const avgShiftsPerDay = providerSlots.length / 7;
          const preferredWeekdays = Object.entries(weekdayCounts)
            .filter(([, count]) => count > avgShiftsPerDay)
            .map(([day]) => parseInt(day));

          const avoidedWeekdays = Object.entries(weekdayCounts)
            .filter(([, count]) => count < avgShiftsPerDay / 2)
            .map(([day]) => parseInt(day));

          // Determine preferred shift types
          const preferredShiftTypes = Object.entries(shiftTypeCounts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type]) => type as ShiftType);

          // Detect patterns
          const detectedPatterns: DetectedPattern[] = [];

          if (shiftTypeCounts.NIGHT > shiftTypeCounts.DAY) {
            detectedPatterns.push({
              type: 'PREFERS_NIGHTS',
              description: 'Tends to prefer night shifts over day shifts',
              confidence: Math.min(0.9, shiftTypeCounts.NIGHT / (shiftTypeCounts.DAY + 1)),
              evidence: [`${shiftTypeCounts.NIGHT} night shifts vs ${shiftTypeCounts.DAY} day shifts`]
            });
          }

          if (shiftTypeCounts.DAY > shiftTypeCounts.NIGHT * 2) {
            detectedPatterns.push({
              type: 'AVOIDS_NIGHTS',
              description: 'Rarely takes night shifts',
              confidence: Math.min(0.9, 1 - (shiftTypeCounts.NIGHT / (shiftTypeCounts.DAY + 1))),
              evidence: [`Only ${shiftTypeCounts.NIGHT} night shifts taken`]
            });
          }

          // Analyze swap history
          const providerSwaps = state.swapRequests.filter(
            s => s.requestorId === provider.id || s.targetProviderId === provider.id
          );
          const completedSwaps = providerSwaps.filter(s => s.status === 'approved');
          const swapWillingness = providerSwaps.length > 0
            ? completedSwaps.length / providerSwaps.length
            : 0.5;

          profiles[provider.id] = {
            providerId: provider.id,
            preferredWeekdays,
            avoidedWeekdays,
            preferredShiftTypes,
            historicalShiftDistribution: shiftTypeCounts,
            swapWillingness,
            avgSwapResponseTime: undefined, // Would need timestamp tracking
            holidayHistory: {}, // Would need historical data
            detectedPatterns,
            lastUpdated: new Date().toISOString(),
          };
        });

        set({ preferenceProfiles: profiles });
        get().showToast({ type: "success", title: "ML Analysis Complete", message: `Analyzed patterns for ${state.providers.length} providers` });
      },

      getProviderPreferenceProfile: (providerId) => {
        return get().preferenceProfiles[providerId];
      },

      generateMLSuggestions: () => {
        const state = get();
        const suggestions: MLSuggestion[] = [];

        // Only generate if we have profiles
        if (Object.keys(state.preferenceProfiles).length === 0) {
          get().analyzeProviderPatterns();
        }

        const profiles = get().preferenceProfiles;

        // Find unfilled slots and suggest optimal providers
        state.slots.filter(s => !s.providerId).forEach(slot => {
          const date = parseISO(slot.date);
          const dayOfWeek = date.getDay();

          // Score each provider for this slot
          const scoredProviders = state.providers.map(provider => {
            const profile = profiles[provider.id];
            let score = 0;
            const factors = {
              historicalFit: 0,
              preferenceMatch: 0,
              fairnessBalance: 0,
              skillMatch: 0,
            };

            // Check skills
            if (provider.skills.includes(slot.requiredSkill)) {
              factors.skillMatch = 1;
              score += 25;
            }

            // Check preferences
            if (profile) {
              // Preferred weekday bonus
              if (profile.preferredWeekdays.includes(dayOfWeek)) {
                factors.preferenceMatch += 0.5;
                score += 20;
              }

              // Avoided weekday penalty
              if (profile.avoidedWeekdays.includes(dayOfWeek)) {
                factors.preferenceMatch -= 0.3;
                score -= 15;
              }

              // Preferred shift type bonus
              if (profile.preferredShiftTypes.includes(slot.type)) {
                factors.historicalFit = 0.7;
                score += 20;
              }

              // Swap willingness
              if (profile.swapWillingness > 0.7) {
                score += 10;
              }
            }

            // Fairness - providers with fewer shifts get bonus
            const counts = getProviderCounts(state.slots, state.providers)[provider.id];
            const totalAssigned = counts.weekDays + counts.weekendDays + counts.weekNights + counts.weekendNights;
            const totalTarget = provider.targetWeekDays + provider.targetWeekendDays + provider.targetWeekNights;

            if (totalAssigned < totalTarget) {
              factors.fairnessBalance = 1 - (totalAssigned / totalTarget);
              score += factors.fairnessBalance * 15;
            }

            return { provider, score, factors };
          }).filter(s => s.factors.skillMatch > 0) // Only providers with required skills
            .sort((a, b) => b.score - a.score);

          // Create suggestion for top match
          if (scoredProviders.length > 0) {
            const topMatch = scoredProviders[0];
            suggestions.push({
              id: crypto.randomUUID(),
              slotId: slot.id,
              providerId: topMatch.provider.id,
              confidence: Math.min(0.95, topMatch.score / 100),
              reason: `${topMatch.provider.name} is the best match based on skills, preferences, and fairness balance`,
              factors: topMatch.factors,
              createdAt: new Date().toISOString(),
            });
          }
        });

        set({ mlSuggestions: suggestions });
        get().showToast({ type: "success", title: "ML Suggestions Generated", message: `${suggestions.length} assignments suggested` });
      },

      applyMLSuggestion: (suggestionId) => {
        const state = get();
        const suggestion = state.mlSuggestions.find(s => s.id === suggestionId);
        if (!suggestion || suggestion.applied) return;

        // Apply the assignment
        const slot = state.slots.find(s => s.id === suggestion.slotId);
        if (slot) {
          // Use existing assignShift logic
          const canAssignResult = canAssignProvider(
            state.slots,
            state.providers.find(p => p.id === suggestion.providerId),
            slot,
            state.customRules,
            slot.id
          );

          if (canAssignResult.canAssign) {
            set({
              slots: state.slots.map(s =>
                s.id === suggestion.slotId ? { ...s, providerId: suggestion.providerId } : s
              ),
              mlSuggestions: state.mlSuggestions.map(s =>
                s.id === suggestionId ? { ...s, applied: true } : s
              ),
            });
            get().showToast({ type: "success", title: "Suggestion Applied", message: `Assigned ${state.providers.find(p => p.id === suggestion.providerId)?.name}` });
          } else {
            get().showToast({ type: "error", title: "Cannot Apply", message: canAssignResult.reason });
          }
        }
      },

      dismissMLSuggestion: (suggestionId) => {
        const state = get();
        set({
          mlSuggestions: state.mlSuggestions.filter(s => s.id !== suggestionId)
        });
      },

      // Schedule Templates
      createTemplate: (template) => {
        const state = get();
        const newTemplate: ScheduleTemplate = {
          ...template,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set({
          scheduleTemplates: [...state.scheduleTemplates, newTemplate]
        });
        get().showToast({ type: "success", title: "Template Created", message: `"${template.name}" saved for reuse` });
      },

      updateTemplate: (id, updates) => {
        const state = get();
        const index = state.scheduleTemplates.findIndex((t) => t.id === id);
        if (index < 0) return;
        const template = state.scheduleTemplates[index];
        const updated = { ...template, ...updates };
        const next = state.scheduleTemplates.slice();
        next[index] = updated;
        set({
          scheduleTemplates: next,
        });
        get().showToast({ type: "success", title: "Template Updated", message: `"${updated.name}" updated.` });
      },

      deleteTemplate: (id) => {
        const state = get();
        set({
          scheduleTemplates: state.scheduleTemplates.filter(t => t.id !== id)
        });
        get().showToast({ type: "info", title: "Template Deleted" });
      },

      applyTemplate: (id, startDate) => {
        const state = get();
        const template = state.scheduleTemplates.find(t => t.id === id);
        if (!template) return;

        const start = parseISO(startDate);
        // Collect assignments first, then rebuild the array immutably —
        // mutating slot objects in place corrupts history/undo snapshots
        // that share the same object references.
        const assignmentsBySlotId = new Map<string, string>();
        template.pattern.forEach(patternSlot => {
          if (patternSlot.assignment === "ROTATE") return;
          const slotDate = format(addDays(start, patternSlot.dayOffset), "yyyy-MM-dd");
          const targetSlot = state.slots.find(s =>
            s.date === slotDate &&
            s.type === patternSlot.shiftType &&
            s.location === patternSlot.location
          );
          if (!targetSlot) return;
          // Find provider by name if it's a group reference
          const provider = state.providers.find(p =>
            p.id === patternSlot.assignment || p.name === patternSlot.assignment
          );
          if (provider) {
            assignmentsBySlotId.set(targetSlot.id, provider.id);
          }
        });

        const newSlots = state.slots.map(s => {
          const providerId = assignmentsBySlotId.get(s.id);
          return providerId ? { ...s, providerId } : s;
        });

        set({ slots: newSlots });
        get().showToast({ type: "success", title: "Template Applied", message: `"${template.name}" applied to schedule` });
      },

      createProviderGroup: (name, providerIds) => {
        // This would be stored with the template or as a separate entity
        // For now, we'll just acknowledge the creation
        get().showToast({ type: "success", title: "Group Created", message: `"${name}" group with ${providerIds.length} providers` });
      },

      // Copilot AI Assistant actions
      toggleCopilot: () => {
        set((state) => ({ isCopilotOpen: !state.isCopilotOpen }));
      },

      setSelectedDate: (date) => {
        set({ selectedDate: date });
      },

      setSelectedProviderId: (id) => {
        set({ selectedProviderId: id });
      },

      setScheduleSurfaceView: (view) => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            surfaceView: view,
          },
        }));
      },

      setCalendarPresentationMode: (mode) => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            calendarPresentationMode: mode,
          },
        }));
      },

      setCurrentWeekOffset: (offset) => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            currentWeekOffset: offset,
          },
        }));
      },

      shiftWeekOffset: (delta) => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            currentWeekOffset: state.scheduleViewport.currentWeekOffset + delta,
          },
        }));
      },

      setShiftTypeFilter: (filter) => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            shiftTypeFilter: filter,
          },
        }));
      },

      setShowConflictsOnly: (show) => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            showConflictsOnly: show,
          },
        }));
      },

      setShowUnfilledOnly: (show) => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            showUnfilledOnly: show,
          },
        }));
      },

      setProviderSearchTerm: (term) => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            providerSearchTerm: term,
          },
        }));
      },

      resetScheduleViewportFilters: () => {
        set((state) => ({
          scheduleViewport: {
            ...state.scheduleViewport,
            shiftTypeFilter: "all",
            showConflictsOnly: false,
            showUnfilledOnly: false,
            providerSearchTerm: "",
            currentWeekOffset: 0,
          },
          startDate: getWeekStart(),
        }));
        get().showToast({ type: "info", title: "Filters Reset", message: "All filters and date range have been reset." });
      },

      pendingAISuggestions: [],
      showChangePreview: false,
      changePreviewData: null,
      pendingMultiAgentResult: null,

      applyAISuggestion: (suggestionId) => {
        const state = get();
        const suggestion = state.pendingAISuggestions.find(s => s.id === suggestionId);
        if (!suggestion) return;

        // Apply the suggestion
        const newSlots = state.slots.map(slot => {
          if (slot.id === suggestion.slotId) {
            return {
              ...slot,
              providerId: suggestion.toProviderId ?? null
            };
          }
          return slot;
        });

        // Remove from pending
        set({
          slots: newSlots,
          pendingAISuggestions: state.pendingAISuggestions.filter(s => s.id !== suggestionId)
        });

        get().showToast({
          type: 'success',
          title: 'Suggestion Applied',
          message: 'The schedule has been updated'
        });
      },

      applyAllAISuggestions: async () => {
        const state = get();
        const raw = state.pendingMultiAgentResult as { schedule?: { slots?: unknown[]; providers?: unknown[] } } | null | undefined;
        if (raw?.schedule) {
          try {
            const approvedBy = state.currentUser?.email ?? null;
            const res = await applyOptimizationResult(raw as Parameters<typeof applyOptimizationResult>[0], approvedBy);
            const next = res.state as { slots?: typeof state.slots; providers?: typeof state.providers };
            const nextSlots = (Array.isArray(next.slots) && next.slots.length > 0) ? (next.slots as ShiftSlot[]) : state.slots;
            const nextProviders = (Array.isArray(next.providers) && next.providers.length > 0) ? (next.providers as Provider[]) : state.providers;

            const nextSnapshot = captureHistory({
              ...state,
              slots: nextSlots,
              providers: nextProviders,
            });
            const hist = pushHistory(state, nextSnapshot);

            set({
              slots: nextSlots,
              providers: nextProviders,
              ...hist,
              pendingMultiAgentResult: null,
              showChangePreview: false,
              lastActionMessage: "Schedule optimized and applied.",
            });
            get().showToast({ type: 'success', title: 'Optimization Applied', message: 'Schedule updated from multi-agent result.' });
          } catch (err) {
            get().showToast({
              type: 'error',
              title: 'Apply Failed',
              message: err instanceof Error ? err.message : 'Failed to apply optimization',
            });
          }
          return;
        }
        let newSlots = [...state.slots];
        state.pendingAISuggestions.forEach(suggestion => {
          newSlots = newSlots.map(slot => {
            if (slot.id === suggestion.slotId) {
              return { ...slot, providerId: suggestion.toProviderId ?? null };
            }
            return slot;
          });
        });
        const nextSnapshot = captureHistory({
          ...state,
          slots: newSlots,
        });
        const hist = pushHistory(state, nextSnapshot);

        set({
          slots: newSlots,
          ...hist,
          pendingAISuggestions: [],
          showChangePreview: false,
          lastActionMessage: `Applied ${state.pendingAISuggestions.length} AI suggestions.`,
        });
        get().showToast({ type: 'success', title: 'All Changes Applied', message: `${state.pendingAISuggestions.length} changes have been applied` });
      },

      rejectAISuggestions: () => {
        set({
          pendingAISuggestions: [],
          pendingMultiAgentResult: null,
          showChangePreview: false
        });

        get().showToast({
          type: 'info',
          title: 'Changes Rejected',
          message: 'All AI suggestions have been dismissed'
        });
      },

      queueAISuggestions: (preview, suggestions) => {
        set({
          pendingAISuggestions: suggestions,
          showChangePreview: true,
          changePreviewData: preview,
        });
      },

      openChangePreview: (preview) => {
        set({ showChangePreview: true, changePreviewData: preview, pendingMultiAgentResult: null });
      },

      openChangePreviewWithMultiAgentResult: (preview, rawResult) => {
        set({ showChangePreview: true, changePreviewData: preview, pendingMultiAgentResult: rawResult ?? null });
      },

      closeChangePreview: () => {
        set({ showChangePreview: false, pendingMultiAgentResult: null });
      },

      runMultiAgentOptimize: async () => {
        const state = get();
        const scheduleState = {
          slots: state.slots,
          providers: state.providers,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
          scenarios: state.scenarios,
          customRules: state.customRules,
          auditLog: state.auditLog,
        };
        try {
          const result = await multiAgentOptimize(scheduleState);
          if (!result?.success || !result.schedule) {
            get().showToast({ type: "error", title: "Optimization failed", message: "No schedule result returned." });
            return;
          }
          const preview = buildOptimizationPreview(result, state.slots, state.providers);
          get().openChangePreviewWithMultiAgentResult(preview, result);
        } catch (err) {
          get().showToast({
            type: "error",
            title: "Optimization failed",
            message: err instanceof Error ? err.message : "Multi-agent optimize request failed.",
          });
        }
      },

      // Copilot Conversation History
      copilotConversations: [],
      currentConversationId: null,

      createConversation: () => {
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newConversation: CopilotConversation = {
          id,
          title: `Conversation ${new Date().toLocaleDateString()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [{
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm your scheduling assistant. How can I help you today?",
            timestamp: new Date().toISOString()
          }]
        };

        set((state) => ({
          copilotConversations: [newConversation, ...state.copilotConversations].slice(0, 50), // Keep last 50
          currentConversationId: id
        }));

        return id;
      },

      loadConversation: (id) => {
        set({ currentConversationId: id });
      },

      deleteConversation: (id) => {
        set((state) => ({
          copilotConversations: state.copilotConversations.filter(c => c.id !== id),
          currentConversationId: state.currentConversationId === id ? null : state.currentConversationId
        }));
      },

      addMessageToConversation: (conversationId, message) => {
        set((state) => ({
          copilotConversations: state.copilotConversations.map(conv => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                messages: [...conv.messages, message],
                updatedAt: new Date().toISOString(),
                // Update title based on first user message
                title: conv.messages.length === 1 && message.role === 'user'
                  ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
                  : conv.title
              };
            }
            return conv;
          })
        }));
      },

      // Copilot Personalization
      copilotFeedback: [],

      recordCopilotFeedback: (feedback) => {
        const entry: CopilotFeedbackEntry = {
          id: `feedback_${Date.now()}`,
          ...feedback,
          timestamp: new Date().toISOString()
        };

        set((state) => ({
          copilotFeedback: [entry, ...state.copilotFeedback].slice(0, 1000) // Keep last 1000
        }));
      },

      getCopilotPreferenceScore: (intent) => {
        const state = get();
        const relevantFeedback = state.copilotFeedback.filter(f => f.intent === intent);

        if (relevantFeedback.length === 0) return 0.5; // Neutral default

        const accepted = relevantFeedback.filter(f => f.action === 'accepted').length;
        const rejected = relevantFeedback.filter(f => f.action === 'rejected').length;

        if (relevantFeedback.length < 3) return 0.5; // Need more data

        return accepted / (accepted + rejected);
      },

      // Day Handoff Notes Actions
      setDayHandoff: (date, notes) => {
        const state = get();
        const trimmedNotes = notes.trim();

        if (!trimmedNotes) {
          // If empty, remove the handoff
          set({
            dayHandoffs: state.dayHandoffs.filter(h => h.date !== date),
            lastActionMessage: `Cleared handoff notes for ${date}`,
          });
          return;
        }

        const existingIndex = state.dayHandoffs.findIndex(h => h.date === date);
        const newHandoff: import("./types").DayHandoff = {
          date,
          notes: trimmedNotes,
          updatedAt: new Date().toISOString(),
          updatedBy: state.currentUser?.name || 'Unknown',
        };

        if (existingIndex >= 0) {
          // Update existing
          const updatedHandoffs = [...state.dayHandoffs];
          updatedHandoffs[existingIndex] = newHandoff;
          set({
            dayHandoffs: updatedHandoffs,
            lastActionMessage: `Updated handoff notes for ${date}`,
          });
        } else {
          // Add new
          set({
            dayHandoffs: [...state.dayHandoffs, newHandoff],
            lastActionMessage: `Added handoff notes for ${date}`,
          });
        }
      },

      getDayHandoff: (date) => {
        const state = get();
        return state.dayHandoffs.find(h => h.date === date);
      },

      clearDayHandoff: (date) => {
        const state = get();
        set({
          dayHandoffs: state.dayHandoffs.filter(h => h.date !== date),
          lastActionMessage: `Cleared handoff notes for ${date}`,
        });
      },

      postShiftForCoverage: (slotId, postedByProviderId, notes = "") => {
        const state = get();
        const slot = state.slots.find(s => s.id === slotId);
        if (!slot) throw new Error(`Slot ${slotId} not found`);
        const id = `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newShift: MarketplaceShift = {
          id,
          slotId,
          postedByProviderId,
          date: slot.date,
          shiftType: slot.type,
          location: slot.location || "",
          lifecycleState: "POSTED",
          postedAt: new Date().toISOString(),
          claimedByProviderId: null,
          claimedAt: null,
          approvedBy: null,
          approvedAt: null,
          broadcastRecipients: [],
          notes,
        };
        set({
          marketplaceShifts: [...state.marketplaceShifts, newShift],
          lastActionMessage: `Shift posted for coverage: ${id}`,
        });
        return id;
      },

      transitionShiftLifecycle: (shiftId, newState) => {
        const state = get();
        const validTransitions: Record<string, ShiftLifecycleStatus[]> = {
          POSTED: ["AI_EVALUATING", "CANCELLED"],
          AI_EVALUATING: ["BROADCASTING", "CANCELLED"],
          BROADCASTING: ["CLAIMED", "CANCELLED"],
          CLAIMED: ["APPROVED", "CANCELLED"],
          APPROVED: [],
          CANCELLED: [],
        };
        const shift = state.marketplaceShifts.find(s => s.id === shiftId);
        if (!shift) throw new Error(`Marketplace shift ${shiftId} not found`);
        const allowed = validTransitions[shift.lifecycleState] || [];
        if (!allowed.includes(newState)) {
          throw new Error(`Invalid transition: ${shift.lifecycleState} → ${newState}`);
        }
        const updated = state.marketplaceShifts.map(s =>
          s.id === shiftId ? { ...s, lifecycleState: newState } : s
        );
        set({
          marketplaceShifts: updated,
          lastActionMessage: `Shift ${shiftId} transitioned to ${newState}`,
        });
      },

      cancelMarketplaceShift: (shiftId) => {
        const state = get();
        const updated = state.marketplaceShifts.map(s =>
          s.id === shiftId ? { ...s, lifecycleState: "CANCELLED" as const } : s
        );
        set({
          marketplaceShifts: updated,
          lastActionMessage: `Marketplace shift ${shiftId} cancelled`,
        });
      },

      claimShift: (shiftId: string, providerId: string) => {
        const state = get();
        const updated = state.marketplaceShifts.map(s =>
          s.id === shiftId
            ? {
                ...s,
                lifecycleState: "CLAIMED" as ShiftLifecycleStatus,
                claimedByProviderId: providerId,
                claimedAt: new Date().toISOString(),
              }
            : s
        );
        set({
          marketplaceShifts: updated,
          lastActionMessage: `Shift ${shiftId} claimed by provider ${providerId}`,
        });
      },

      approveShift: (shiftId: string, approvedBy: string) => {
        const state = get();
        const updated = state.marketplaceShifts.map(s =>
          s.id === shiftId
            ? {
                ...s,
                lifecycleState: "APPROVED" as ShiftLifecycleStatus,
                approvedBy,
                approvedAt: new Date().toISOString(),
              }
            : s
        );
        set({
          marketplaceShifts: updated,
          lastActionMessage: `Shift ${shiftId} approved by ${approvedBy}`,
        });
      },

      escalateBroadcast: (shiftId: string) => {
        const state = get();
        const existingTiers = state.broadcastHistory.filter(e => e.marketplaceShiftId === shiftId);
        const newTier = existingTiers.length + 1;
        const id = `bh-escalated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const entry: BroadcastHistoryEntry = {
          id,
          marketplaceShiftId: shiftId,
          tier: newTier,
          recipients: [],
          sentAt: new Date().toISOString(),
          channel: "push",
          status: "sent",
        };
        set({
          broadcastHistory: [...state.broadcastHistory, entry],
          lastActionMessage: `Broadcast escalated to tier ${newTier} for shift ${shiftId}`,
        });
      },

      updateEscalationConfig: (config) => {
        const state = get();
        set({
          escalationConfig: { ...state.escalationConfig, ...config },
          lastActionMessage: "Escalation config updated",
        });
      },

      addBroadcastEntry: (shiftId, recipients, channel) => {
        const state = get();
        const existingTiers = state.broadcastHistory.filter(e => e.marketplaceShiftId === shiftId);
        const tier = existingTiers.length + 1;
        const id = `bh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const entry: BroadcastHistoryEntry = {
          id,
          marketplaceShiftId: shiftId,
          tier,
          recipients,
          sentAt: new Date().toISOString(),
          channel,
          status: "sent",
        };
        set({
          broadcastHistory: [...state.broadcastHistory, entry],
          lastActionMessage: `Broadcast tier ${tier} sent for shift ${shiftId}`,
        });
      },

      updateBroadcastRecipientStatus: (entryId, _providerId, status) => {
        const state = get();
        const updated = state.broadcastHistory.map(entry => {
          if (entry.id !== entryId) return entry;
          return { ...entry, status: status as "sent" | "delivered" | "failed" };
        });
        set({
          broadcastHistory: updated,
          lastActionMessage: `Broadcast status updated to ${status} for entry ${entryId}`,
        });
      },

      setSyncStatus: (status, error) => {
        const now = new Date().toISOString();
        set({
          syncStatus: status,
          syncError: error ?? null,
          lastSyncedAt: status === "synced" ? now : get().lastSyncedAt,
        });
        if (error) {
          get().showToast({ type: "error", title: "Sync Failed", message: error });
        } else if (status === "synced") {
          get().showToast({ type: "success", title: "Synced", message: "Changes saved to cloud" });
        }
      },
    }),
    {
      name: "nicu-schedule-store-v4",
      storage: createJSONStorage(() => _safeStorage),
      partialize: (state) => ({
        currentUser: state.currentUser,
        providers: state.providers,
        startDate: state.startDate,
        numWeeks: state.numWeeks,
        slots: state.slots,
        scenarios: state.scenarios,
        // Cap undo history at 30 entries to keep storage lean.
        history: state.history.slice(-30),
        historyIndex: Math.min(state.historyIndex, 29),
        swapRequests: state.swapRequests,
        holidayAssignments: state.holidayAssignments,
        conflicts: state.conflicts,
        // Keep only the 30 most recent notifications.
        notifications: state.notifications.slice(-30),
        notificationPreferences: state.notificationPreferences,
        preferenceProfiles: state.preferenceProfiles,
        // ML suggestions are regenerated on demand — do not persist.
        scheduleTemplates: state.scheduleTemplates,
        dayHandoffs: state.dayHandoffs,
        marketplaceShifts: state.marketplaceShifts,
        broadcastHistory: state.broadcastHistory.slice(-50),
        escalationConfig: state.escalationConfig,
        scheduleViewport: state.scheduleViewport,
        syncStatus: state.syncStatus,
        syncError: state.syncError,
        lastSyncedAt: state.lastSyncedAt,
        // Keep only the 5 most recent AI conversations.
        copilotConversations: state.copilotConversations.slice(-5),
        copilotFeedback: state.copilotFeedback,
      }),
      onRehydrateStorage: () => (state, err) => {
        if (err) return;
        if (state && (!Array.isArray(state.slots) || !Array.isArray(state.providers))) {
          useScheduleStore.setState({
            slots: Array.isArray(state.slots) ? state.slots : [],
            providers: Array.isArray(state.providers) ? state.providers : [],
          });
        }
      },
    },
  ),
);
