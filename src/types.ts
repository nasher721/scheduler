export type ShiftType = "DAY" | "NIGHT" | "NMET" | "JEOPARDY" | "RECOVERY" | "CONSULTS" | "VACATION";

/**
 * Location group classification for organizing services
 */
export type LocationGroup = 
  | "MAIN_CAMPUS_UNIT"      // G20, H22 - primary units
  | "MAIN_CAMPUS_SERVICE"   // Nights, Consults, AMET/NMET
  | "AKRON_UNIT"           // Akron - separate neuro ICU location
  | "SUPPORT_SERVICE";     // Jeopardy, Recovery, Vacation

/**
 * Service priority for scheduling emphasis
 * CRITICAL: Must be staffed (G20, H22, Akron)
 * STANDARD: Important but can survive without (Nights, Consults)
 * FLEXIBLE: As needed (Jeopardy, Recovery, NMET)
 */
export type ServicePriority = "CRITICAL" | "STANDARD" | "FLEXIBLE";

/**
 * Service location for identifying specific units
 */
export type ServiceLocation = 
  | "G20"
  | "H22" 
  | "Akron"
  | "Nights"
  | "Consults"
  | "AMET"
  | "NMET"
  | "Jeopardy"
  | "Recovery"
  | "Vacation";  

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
    noNights?: boolean;
    noWeekends?: boolean;
    noHolidays?: boolean;
    maxShiftsPerWeek?: number;
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
    schedulingRestrictions?: SchedulingRestrictions;
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
    secondaryProviderIds?: string[];
    isSharedAssignment?: boolean;
    /** Location group for organizing display */
    locationGroup: LocationGroup;
    /** Service priority for scheduling emphasis */
    servicePriority: ServicePriority;
    /** Specific service location identifier */
    serviceLocation: ServiceLocation;
    /** Notes for this shift (e.g., special instructions, handoff notes) */
    notes?: string;
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

/** Day-level handoff notes for charge nurses */
export interface DayHandoff {
    date: string;
    notes: string;
    updatedAt: string;
    updatedBy?: string;
}

export interface PersistedScheduleState {
    providers: Provider[];
    startDate: string;
    numWeeks: number;
    slots: ShiftSlot[];
    scenarios: ScenarioSnapshot[];
    customRules: CustomRule[];
    auditLog: AuditLogEntry[];
    dayHandoffs?: DayHandoff[];
}
