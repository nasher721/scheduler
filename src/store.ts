import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { registerProvider } from "./lib/api";

export type ShiftType = "DAY" | "NIGHT" | "NMET" | "JEOPARDY" | "RECOVERY" | "CONSULTS" | "VACATION";

export type TimeOffType = "PTO" | "CME" | "SICK" | "UNAVAILABLE";

export interface TimeOffRequest {
  date: string;
  type: TimeOffType;
}

export type CredentialStatus = "active" | "expiring_soon" | "expired" | "pending_verification";

export interface ProviderCredential {
  credentialType: string;
  issuedAt?: string;
  expiresAt?: string;
  status: CredentialStatus;
}

export interface SchedulingRestrictions {
  /** Provider cannot be assigned night shifts */
  noNights?: boolean;
  /** Provider cannot be assigned weekend shifts */
  noWeekends?: boolean;
  /** Provider cannot be assigned holiday shifts */
  noHolidays?: boolean;
  /** Maximum shifts allowed per week (rolling 7-day window) */
  maxShiftsPerWeek?: number;
  /** Specific date range restrictions (e.g., maternity leave) */
  restrictedDateRanges?: { start: string; end: string; reason?: string }[];
}

export interface Provider {
  id: string;
  name: string;
  targetWeekDays: number;
  targetWeekendDays: number;
  targetWeekNights: number;
  targetWeekendNights: number;
  timeOffRequests: TimeOffRequest[];
  preferredDates: string[];
  skills: string[];
  maxConsecutiveNights: number;
  minDaysOffAfterNight: number;
  credentials?: ProviderCredential[];
  email?: string;
  role?: "ADMIN" | "SCHEDULER" | "CLINICIAN";
  /** Scheduling restrictions for this provider */
  schedulingRestrictions?: SchedulingRestrictions;
  /** Notes about provider (e.g., "FTE with no nights", "Maternity leave") */
  notes?: string;
}

export type CustomRuleType = 'AVOID_PAIRING' | 'MAX_SHIFTS_PER_WEEK';

export interface CustomRule {
  id: string;
  type: CustomRuleType;
  providerA?: string;
  providerB?: string;
  providerId?: string;
  maxShifts?: number;
}

export interface ShiftSlot {
  id: string;
  date: string;
  type: ShiftType;
  providerId: string | null;
  isWeekendLayout: boolean;
  requiredSkill: string;
  priority: "CRITICAL" | "STANDARD";
  isBackup?: boolean;
  location: string;
  /** Secondary providers for shared assignments (e.g., "Bates & Hassett") */
  secondaryProviderIds?: string[];
  /** Whether this is a shared/multi-provider assignment */
  isSharedAssignment?: boolean;
}

export interface ProviderCounts {
  weekDays: number;
  weekendDays: number;
  weekNights: number;
  weekendNights: number;
}

export interface ScenarioSnapshot {
  id: string;
  name: string;
  createdAt: string;
  providers: Provider[];
  slots: ShiftSlot[];
  startDate: string;
  numWeeks: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'ASSIGN' | 'UNASSIGN' | 'AUTO_ASSIGN' | 'CLEAR' | 'RULE_CHANGE';
  details: string;
  slotId?: string;
  providerId?: string;
  user?: string;
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

interface HistoryState {
  providers: Provider[];
  slots: ShiftSlot[];
  startDate: string;
  numWeeks: number;
  assignmentLogs?: string[];
  customRules: CustomRule[];
  auditLog: AuditLogEntry[];
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
}

const getWeekStart = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
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

const shiftRequirements: Record<ShiftType, { skill: string; priority: "CRITICAL" | "STANDARD" }> = {
  DAY: { skill: "NEURO_CRITICAL", priority: "CRITICAL" },
  NIGHT: { skill: "NIGHT_FLOAT", priority: "CRITICAL" },
  NMET: { skill: "AIRWAY", priority: "STANDARD" },
  JEOPARDY: { skill: "STROKE", priority: "STANDARD" },
  RECOVERY: { skill: "NEURO_CRITICAL", priority: "STANDARD" },
  CONSULTS: { skill: "NEURO_CRITICAL", priority: "STANDARD" },
  VACATION: { skill: "NEURO_CRITICAL", priority: "STANDARD" },
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

    // G20, H22, Akron are essentially our Day units
    slots.push({ id: `${dateStr}-DAY-G20`, date: dateStr, type: "DAY", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.DAY.skill, priority: shiftRequirements.DAY.priority, isBackup: false, location: "G20 Unit" });
    slots.push({ id: `${dateStr}-DAY-H22`, date: dateStr, type: "DAY", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.DAY.skill, priority: shiftRequirements.DAY.priority, isBackup: false, location: "H22 Unit" });
    slots.push({ id: `${dateStr}-DAY-Akron`, date: dateStr, type: "DAY", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.DAY.skill, priority: shiftRequirements.DAY.priority, isBackup: false, location: "Akron" });

    // Other roles mapped directly
    slots.push({ id: `${dateStr}-NIGHT-0`, date: dateStr, type: "NIGHT", providerId: null, isWeekendLayout: isWeekendNight, requiredSkill: shiftRequirements.NIGHT.skill, priority: shiftRequirements.NIGHT.priority, isBackup: false, location: "Main Campus (Nights)" });
    slots.push({ id: `${dateStr}-CONSULTS-0`, date: dateStr, type: "CONSULTS", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.CONSULTS.skill, priority: shiftRequirements.CONSULTS.priority, isBackup: false, location: "Main Campus (Consults)" });
    slots.push({ id: `${dateStr}-NMET-0`, date: dateStr, type: "NMET", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.NMET.skill, priority: shiftRequirements.NMET.priority, isBackup: false, location: "Main Campus (NMET)" });
    slots.push({ id: `${dateStr}-JEOPARDY-0`, date: dateStr, type: "JEOPARDY", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.JEOPARDY.skill, priority: shiftRequirements.JEOPARDY.priority, isBackup: true, location: "Jeopardy" });
    slots.push({ id: `${dateStr}-RECOVERY-0`, date: dateStr, type: "RECOVERY", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.RECOVERY.skill, priority: shiftRequirements.RECOVERY.priority, isBackup: false, location: "Recovery" });
    // Vacations can just be time-off requests, but the sheet has a column. 
    // We could store it as a slot or derive it. For now, we'll store as a slot for 1-to-1 excel parity.
    slots.push({ id: `${dateStr}-VACATION-0`, date: dateStr, type: "VACATION", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.VACATION.skill, priority: shiftRequirements.VACATION.priority, isBackup: false, location: "Any" });
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

      login: (email) => {
        const state = get();
        const user = state.providers.find(p => p.email?.toLowerCase() === email.toLowerCase());
        if (user) {
          set({ currentUser: user });
          get().showToast({ type: "success", title: "Logged In", message: `Welcome back, ${user.name}` });
        } else {
          get().showToast({ type: "error", title: "Login Failed", message: "User not found" });
        }
      },

      logout: () => {
        set({ currentUser: null });
        get().showToast({ type: "info", title: "Logged Out", message: "You have been logged out." });
      },

      register: async (provider) => {
        const state = get();
        try {
          const { provider: newProvider } = await registerProvider(provider);

          // Still update local state for immediate feedback
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
            providers: [...state.providers, newProvider],
            currentUser: newProvider,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            lastActionMessage: `Self-registered: ${newProvider.name}`,
          });
          get().showToast({ type: "success", title: "Registration Successful", message: `Welcome, ${newProvider.name}!` });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Email already in use.";
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

          const getLocationPriority = (location: string) => {
            const loc = location.toLowerCase();
            if (loc.includes("g20") || loc.includes("h22") || loc.includes("akron")) return 0;
            if (loc.includes("main campus") || loc.includes("consults") || loc.includes("nmet") || loc.includes("nights")) return 1;
            if (loc.includes("jeopardy")) return 2;
            return 3;
          };

          const newSlots = [...state.slots].sort((a, b) => {
            const prioA = getLocationPriority(a.location);
            const prioB = getLocationPriority(b.location);
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
      }),
    },
  ),
);
