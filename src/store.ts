import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { registerProvider, loadScheduleState } from "./lib/api";
import { supabase, supabaseStatus } from "./lib/supabase";
export * from "./types";
import {
  ShiftType, ProviderCredential, CredentialStatus,
  Provider, CustomRule, ShiftSlot, ScenarioSnapshot, AuditLogEntry,
  LocationGroup, ServicePriority, ServiceLocation
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
}

// Copilot Conversation Types
export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  confidence?: number;
  suggestions?: string[];
  requiresConfirmation?: boolean;
  actions?: unknown[];
}

export interface CopilotConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: CopilotMessage[];
  context?: {
    viewType?: string;
    selectedDate?: string | null;
    userRole?: string;
  };
}

export interface CopilotFeedbackEntry {
  id: string;
  conversationId: string;
  messageId: string;
  intent: string;
  action: 'accepted' | 'rejected' | 'modified' | 'ignored';
  timestamp: string;
  context?: Record<string, unknown>;
}

export type ScheduleSurfaceView = "calendar" | "excel";
export type CalendarPresentationMode = "grid" | "list" | "timeline" | "month";
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
  addProvider: (provider: Omit<Provider, "id">) => void;
  updateProvider: (id: string, provider: Partial<Provider>) => void;
  removeProvider: (id: string) => void;
  addCustomRule: (rule: Omit<CustomRule, "id">) => void;
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
  deleteScenario: (id: string) => void;
  clearMessage: () => void;
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
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
  openChangePreview: (preview: unknown) => void;
  closeChangePreview: () => void;
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
  return bypassByEnv || supabaseStatus.isPlaceholder;
}

const baseProviders: Provider[] = [
  { id: "1", name: "Dr. Adams", email: "adams@hospital.org", role: "ADMIN", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "AIRWAY", "STROKE"], maxConsecutiveNights: 2, minDaysOffAfterNight: 1, credentials: [{ credentialType: "ACLS", expiresAt: "2027-01-01", status: "active" }] },
  { id: "2", name: "Dr. Baker", email: "baker@hospital.org", role: "CLINICIAN", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "EEG", "NIGHT_FLOAT"], maxConsecutiveNights: 3, minDaysOffAfterNight: 1, credentials: [{ credentialType: "Stroke Certification", expiresAt: "2027-02-01", status: "active" }] },
  { id: "3", name: "Dr. Clark", email: "clark@hospital.org", role: "SCHEDULER", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ["NEURO_CRITICAL", "ECMO", "STROKE"], maxConsecutiveNights: 2, minDaysOffAfterNight: 2, credentials: [{ credentialType: "NIHSS", expiresAt: "2027-03-01", status: "active" }] },
];

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

const generateInitialSlots = (startDateStr: string, numWeeks: number): ShiftSlot[] => {
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

    // Priority 2: Nights, Consults - Important but can survive without
    const priority2Services = ["Nights", "Consults"] as const;
    priority2Services.forEach((serviceKey) => {
      const config = serviceLocationConfig[serviceKey];
      slots.push({
        id: `${dateStr}-${config.type}-${serviceKey}`,
        date: dateStr,
        type: config.type,
        providerId: null,
        isWeekendLayout: serviceKey === "Nights" ? isWeekendNight : isWeekendDay,
        requiredSkill: config.requiredSkill,
        priority: config.priority,
        isBackup: false,
        location: config.location,
        locationGroup: config.locationGroup,
        servicePriority: config.servicePriority,
        serviceLocation: config.serviceLocation,
      });
    });

    // Priority 3: AMET/NMET, Jeopardy, Recovery - Flexible/as needed
    const priority3Services = ["AMET", "Jeopardy", "Recovery"] as const;
    priority3Services.forEach((serviceKey) => {
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

  let consecutive = 0;
  let cursorDate = parseISO(targetDate);
  while (nights.includes(format(cursorDate, "yyyy-MM-dd"))) {
    consecutive += 1;
    cursorDate = addDays(cursorDate, -1);
  }
  return consecutive;
};

const violatesPostNightRecovery = (slots: ShiftSlot[], providerId: string, slot: ShiftSlot, provider: Provider) => {
  if (slot.type === "NIGHT") return false;

  const nightDates = slots
    .filter((s) => s.providerId === providerId && s.type === "NIGHT")
    .map((s) => s.date);

  return nightDates.some((nightDate) => {
    const diff = differenceInCalendarDays(parseISO(slot.date), parseISO(nightDate));
    return diff > 0 && diff <= provider.minDaysOffAfterNight;
  });
};

const canAssignProvider = (slots: ShiftSlot[], provider: Provider | undefined, slot: ShiftSlot, customRules: CustomRule[], currentSlotId?: string) => {
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

    // Check maxShiftsPerWeek restriction
    if (restrictions.maxShiftsPerWeek) {
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
    const target = slot.isWeekendLayout ? provider.targetWeekendNights : provider.targetWeekNights;
    const current = slot.isWeekendLayout ? count.weekendNights : count.weekNights;
    return target - current + preferenceBoost + criticalBoost;
  }

  return (provider.targetWeekDays + provider.targetWeekendDays + provider.targetWeekNights + provider.targetWeekendNights)
    - (count.weekDays + count.weekendDays + count.weekNights + count.weekendNights)
    + preferenceBoost;
};

const initialStart = getWeekStart();
const MAX_HISTORY = 50;

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      providers: baseProviders,
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

      initialize: async () => {
        // 1. Set up session listener
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === "SIGNED_IN" && session?.user) {
            const { providers } = get();
            const user = providers.find(p => p.email?.toLowerCase() === session.user.email?.toLowerCase());
            if (user) {
              set({ currentUser: user });
            }
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
              startDate: state.startDate,
              numWeeks: state.numWeeks,
              customRules: state.customRules,
              auditLog: state.auditLog,
            });
          }
        } catch (error) {
          console.error("Failed to load initial state:", error);
        }
      },

      login: async (email) => {
        const normalizedEmail = email.toLowerCase().trim();
        const bypassSupabase = shouldUseLocalAuthBypass();
        
        if (bypassSupabase) {
          console.log('[DEV] Bypassing Supabase auth for:', normalizedEmail);
          
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
            // Auto-create a provider for unknown emails in dev mode
            const newProvider: Provider = {
              id: crypto.randomUUID(),
              name: normalizedEmail.split('@')[0],
              email: normalizedEmail,
              role: "CLINICIAN",
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
          const message = error instanceof Error ? error.message : "An unexpected error occurred.";
          
          // Provide more helpful error message
          let userMessage = message;
          if (message.includes("Failed to fetch")) {
            userMessage = "Cannot connect to authentication server. If you're a developer, you can enable DEV mode bypass.";
          }
          
          get().showToast({
            type: "error",
            title: "Login Error",
            message: userMessage
          });
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
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
          customRules: state.customRules,
          auditLog: state.auditLog,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

        set({
          providers: [...state.providers, { ...provider, id: crypto.randomUUID() }],
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: `Added ${provider.name} to roster.`,
        });

        get().showToast({ type: "success", title: "Provider Added", message: `${provider.name} has been added to the roster.` });
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      removeProvider: (id) => {
        const state = get();
        const provider = state.providers.find(p => p.id === id);
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
          customRules: state.customRules,
          auditLog: state.auditLog,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

        set({
          providers: state.providers.filter((p) => p.id !== id),
          slots: state.slots.map((s) => (s.providerId === id ? { ...s, providerId: null } : s)),
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: "Provider removed and related assignments cleared.",
        });

        get().showToast({ type: "info", title: "Provider Removed", message: provider ? `${provider.name} has been removed.` : undefined });
      },

      setScheduleRange: (startDate, numWeeks) => {
        set(() => ({
          startDate,
          numWeeks,
          slots: generateInitialSlots(startDate, numWeeks),
          lastActionMessage: "Schedule window updated.",
        }));

        get().showToast({ type: "info", title: "Schedule Updated", message: `Now viewing ${numWeeks} week${numWeeks > 1 ? 's' : ''} starting ${startDate}.` });
      },

      addCustomRule: (rule) => {
        const state = get();
        set({
          customRules: [...state.customRules, { ...rule, id: crypto.randomUUID() }],
          lastActionMessage: `Added custom rule: ${rule.type}`,
        });
        get().showToast({ type: "success", title: "Rule Added", message: `Custom rule created.` });
      },

      removeCustomRule: (id) => {
        const state = get();
        const ruleToRemove = state.customRules.find(r => r.id === id);
        set({
          customRules: state.customRules.filter(r => r.id !== id),
          lastActionMessage: `Removed custom rule.`,
          auditLog: [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              action: "RULE_CHANGE" as const,
              details: `Removed custom rule: ${ruleToRemove?.type || id}`,
              user: "Current User"
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
          if (providerId !== null) { // Only check for assignment, unassignment is always allowed
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
            user: "Current User"
          };

          const nextSlots = state.slots.map((s) =>
            s.id === slotId ? { ...s, providerId } : s
          );
          const nextAuditLog = [newAuditEntry, ...state.auditLog];

          const historyState: HistoryState = {
            providers: state.providers,
            slots: nextSlots, // Use nextSlots for history
            startDate: state.startDate,
            numWeeks: state.numWeeks,
            customRules: state.customRules,
            auditLog: nextAuditLog, // Use nextAuditLog for history
          };
          const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

          return {
            slots: nextSlots,
            auditLog: nextAuditLog,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            lastActionMessage: details
          };
        }),

      clearAssignments: () => {
        const state = get();
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
          customRules: state.customRules,
          auditLog: state.auditLog,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

        set({
          slots: state.slots.map((s) => ({ ...s, providerId: null })),
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: "All assignments cleared.",
          auditLog: [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              action: "UNASSIGN" as const,
              details: "Cleared all assignments",
              user: "Current User"
            },
            ...state.auditLog
          ]
        });

        get().showToast({ type: "warning", title: "Assignments Cleared", message: "All shift assignments have been removed." });
      },

      clearStaff: () => {
        const state = get();
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
          customRules: state.customRules,
          auditLog: state.auditLog,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

        set({
          providers: [],
          slots: state.slots.map((s) => ({ ...s, providerId: null })),
          customRules: [],
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: "All staff profiles cleared.",
          auditLog: [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              action: "CLEAR" as const,
              details: "Cleared all staff profiles and related assignments",
              user: "Current User"
            },
            ...state.auditLog
          ]
        });

        get().showToast({ type: "warning", title: "Staff Cleared", message: "All providers and related rules were removed." });
      },

      clearSchedule: () => {
        const state = get();
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
          customRules: state.customRules,
          auditLog: state.auditLog,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

        set({
          slots: generateInitialSlots(state.startDate, state.numWeeks),
          scenarios: [],
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: "Schedule reset to an empty planning window.",
          auditLog: [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              action: "CLEAR" as const,
              details: "Cleared schedule assignments and saved scenarios",
              user: "Current User"
            },
            ...state.auditLog
          ]
        });

        get().showToast({ type: "warning", title: "Schedule Cleared", message: "All assignments and scenarios were reset." });
      },

      applyImportedSnapshot: (providers, slots, appliedAssignments, skippedRows) => {
        const state = get();
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
          customRules: state.customRules,
          auditLog: state.auditLog,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

        set({
          providers,
          slots,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: `Import applied: ${appliedAssignments} assignments updated (${skippedRows} rows skipped).`,
        });

        get().detectConflicts();
      },

      autoAssign: () => {
        set((state) => {
          const historyState: HistoryState = {
            providers: state.providers,
            slots: state.slots,
            startDate: state.startDate,
            numWeeks: state.numWeeks,
            assignmentLogs: state.assignmentLogs || [],
            customRules: state.customRules,
            auditLog: state.auditLog, // Add auditLog to historyState
          };
          const prevHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

          const getServicePriority = (slot: ShiftSlot): number => {
            // Priority 1: Critical units (G20, H22, Akron)
            if (slot.servicePriority === "CRITICAL") return 0;
            // Priority 2: Standard services (Nights, Consults)
            if (slot.servicePriority === "STANDARD") return 1;
            // Priority 3: Flexible services (Jeopardy, Recovery, NMET)
            return 2;
          };

          const getLocationPriority = (slot: ShiftSlot) => {
            const serviceOrder = getServicePriority(slot);
            if (serviceOrder !== 0) return serviceOrder;
            
            // Within critical services, prioritize by location
            const loc = slot.location.toLowerCase();
            if (loc.includes("g20")) return 0;
            if (loc.includes("h22")) return 1;
            if (loc.includes("akron")) return 2;
            return 3;
          };

          const newSlots = [...state.slots].sort((a, b) => {
            const prioA = getLocationPriority(a);
            const prioB = getLocationPriority(b);
            if (prioA !== prioB) return prioA - prioB;
            // Secondary sort by date to keep it chronological within priority
            return a.date.localeCompare(b.date);
          });
          const counts = getProviderCounts(newSlots, state.providers);
          const logs: string[] = [];
          const newAuditEntries: AuditLogEntry[] = [];

          let assignedCount = 0;
          newSlots.forEach((slot, index) => {
            if (slot.providerId) return;

            const candidates = state.providers
              .filter((provider) => {
                const result = canAssignProvider(newSlots, provider, slot, state.customRules, slot.id);
                if (!result.canAssign) {
                  // If we need strict logs here we could extract the reason from canAssignProvider
                }
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
              user: "Auto Engine"
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

          return {
            slots: newSlots,
            history: prevHistory,
            historyIndex: prevHistory.length - 1,
            assignmentLogs: logs,
            auditLog: [...newAuditEntries, ...state.auditLog],
            lastActionMessage: `Auto-assigned ${assignedCount} shifts using constraints: skills, fatigue, fairness, and preferences.`,
          };
        });

        get().showToast({ type: "success", title: "Auto-Assignment Complete", message: "Shifts have been assigned based on skills, fatigue, and preferences." });
      },

      createScenario: (name) => {
        const state = get();
        const trimmed = name.trim() || `Scenario ${state.scenarios.length + 1}`;
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

        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
          customRules: state.customRules,
          auditLog: state.auditLog,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

        set({
          providers: structuredClone(found.providers),
          slots: structuredClone(found.slots),
          startDate: found.startDate,
          numWeeks: found.numWeeks,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: `Loaded scenario: ${found.name}`,
        });

        get().showToast({ type: "info", title: "Scenario Loaded", message: `"${found.name}" has been restored.` });
      },

      deleteScenario: (id) => {
        set((state) => ({
          scenarios: state.scenarios.filter((scenario) => scenario.id !== id),
        }));

        get().showToast({ type: "info", title: "Scenario Deleted" });
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
        if (state.historyIndex < 0) return;

        const historyState = state.history[state.historyIndex];
        if (!historyState) return;

        const previousIndex = state.historyIndex - 1;
        const previousState = previousIndex >= 0 ? state.history[previousIndex] : null;

        set({
          providers: previousState?.providers ?? historyState.providers,
          slots: previousState?.slots ?? historyState.slots,
          startDate: previousState?.startDate ?? historyState.startDate,
          numWeeks: previousState?.numWeeks ?? historyState.numWeeks,
          historyIndex: previousIndex,
          lastActionMessage: "Undo applied.",
        });

        get().showToast({ type: "info", title: "Undo", message: "Previous action has been undone." });
      },

      redo: () => {
        const state = get();
        if (state.historyIndex >= state.history.length - 1) return;

        const nextIndex = state.historyIndex + 1;
        const nextState = state.history[nextIndex];
        if (!nextState) return;

        set({
          providers: nextState.providers,
          slots: nextState.slots,
          startDate: nextState.startDate,
          numWeeks: nextState.numWeeks,
          historyIndex: nextIndex,
          lastActionMessage: "Redo applied.",
        });

        get().showToast({ type: "info", title: "Redo", message: "Action has been restored." });
      },

      canUndo: () => {
        const state = get();
        return state.historyIndex >= 0;
      },

      canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
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

        // Perform the swap in slots
        const newSlots = state.slots.map(slot => {
          // Swap the providers
          if (slot.date === request.fromDate && slot.providerId === request.requestorId) {
            return { ...slot, providerId: request.targetProviderId || null };
          }
          if (slot.date === request.toDate && slot.providerId === request.targetProviderId) {
            return { ...slot, providerId: request.requestorId };
          }
          return slot;
        });

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

        set({ conflicts });
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
            const totalTarget = provider.targetWeekDays + provider.targetWeekendDays + provider.targetWeekNights + provider.targetWeekendNights;

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
        const newSlots = [...state.slots];

        template.pattern.forEach(patternSlot => {
          const slotDate = format(addDays(start, patternSlot.dayOffset), "yyyy-MM-dd");
          const targetSlot = newSlots.find(s =>
            s.date === slotDate &&
            s.type === patternSlot.shiftType &&
            s.location === patternSlot.location
          );

          if (targetSlot && patternSlot.assignment !== "ROTATE") {
            // Find provider by name if it's a group reference
            const provider = state.providers.find(p =>
              p.id === patternSlot.assignment || p.name === patternSlot.assignment
            );
            if (provider) {
              targetSlot.providerId = provider.id;
            }
          }
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
          },
        }));
      },

      pendingAISuggestions: [],
      showChangePreview: false,
      changePreviewData: null,

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

      applyAllAISuggestions: () => {
        const state = get();
        let newSlots = [...state.slots];

        state.pendingAISuggestions.forEach(suggestion => {
          newSlots = newSlots.map(slot => {
            if (slot.id === suggestion.slotId) {
              return {
                ...slot,
                providerId: suggestion.toProviderId ?? null
              };
            }
            return slot;
          });
        });

        set({
          slots: newSlots,
          pendingAISuggestions: [],
          showChangePreview: false
        });

        get().showToast({
          type: 'success',
          title: 'All Changes Applied',
          message: `${state.pendingAISuggestions.length} changes have been applied`
        });
      },

      rejectAISuggestions: () => {
        set({
          pendingAISuggestions: [],
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
        set({
          showChangePreview: true,
          changePreviewData: preview
        });
      },

      closeChangePreview: () => {
        set({ showChangePreview: false });
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
    }),
    {
      name: "nicu-schedule-store-v4",
      partialize: (state) => ({
        providers: state.providers,
        startDate: state.startDate,
        numWeeks: state.numWeeks,
        slots: state.slots,
        scenarios: state.scenarios,
        history: state.history,
        historyIndex: state.historyIndex,
        swapRequests: state.swapRequests,
        holidayAssignments: state.holidayAssignments,
        conflicts: state.conflicts,
        notifications: state.notifications,
        notificationPreferences: state.notificationPreferences,
        preferenceProfiles: state.preferenceProfiles,
        mlSuggestions: state.mlSuggestions,
        scheduleTemplates: state.scheduleTemplates,
        scheduleViewport: state.scheduleViewport,
        copilotConversations: state.copilotConversations,
        copilotFeedback: state.copilotFeedback,
      }),
    },
  ),
);
