/**
 * Schedule State API
 * Schedule state persistence and retrieval
 */

import { supabase, supabaseStatus } from "../supabase";
import { requestJson } from "./client";
import type {
  AuditLogEntry,
  CustomRule,
  DayHandoff,
  PersistedScheduleState,
  Provider,
  ScenarioSnapshot,
  ShiftSlot,
} from "../../types";

type ProviderRow = {
  id: string;
  name: string;
  email: string;
  role: Provider["role"];
  target_week_days: number;
  target_weekend_days: number;
  target_week_nights: number;
  target_weekend_nights: number;
  time_off_requests: Provider["timeOffRequests"];
  preferred_dates: string[];
  skills: string[];
  max_consecutive_nights: number;
  min_days_off_after_night: number;
  credentials: Provider["credentials"];
  scheduling_restrictions: Provider["schedulingRestrictions"];
  notes: string | null;
  communication_preferences: Provider["communicationPreferences"];
  fatigue_metrics: Provider["fatigueMetrics"];
  auto_approve_claims: boolean;
};

type SlotRow = {
  id: string;
  date: string;
  type: ShiftSlot["type"];
  provider_id: string | null;
  is_weekend_layout: boolean;
  required_skill: string;
  priority: ShiftSlot["priority"];
  is_backup: boolean;
  location: string;
  secondary_provider_ids: string[];
  is_shared_assignment: boolean;
  location_group: ShiftSlot["locationGroup"];
  service_priority: ShiftSlot["servicePriority"];
  service_location: ShiftSlot["serviceLocation"];
  notes: string | null;
};

const toProviderRow = (provider: Provider): ProviderRow => ({
  id: provider.id,
  name: provider.name,
  email: provider.email || `${provider.id}@placeholder.org`,
  role: provider.role || "CLINICIAN",
  target_week_days: provider.targetWeekDays,
  target_weekend_days: provider.targetWeekendDays,
  target_week_nights: provider.targetWeekNights,
  target_weekend_nights: provider.targetWeekendNights,
  time_off_requests: provider.timeOffRequests,
  preferred_dates: provider.preferredDates,
  skills: provider.skills,
  max_consecutive_nights: provider.maxConsecutiveNights,
  min_days_off_after_night: provider.minDaysOffAfterNight,
  credentials: provider.credentials || [],
  scheduling_restrictions: provider.schedulingRestrictions || {},
  notes: provider.notes || null,
  communication_preferences: provider.communicationPreferences || { sms: false, email: true, push: true },
  fatigue_metrics: provider.fatigueMetrics || { consecutiveShiftsWorked: 0, shiftsThisMonth: 0, riskLevel: "low" },
  auto_approve_claims: provider.autoApproveClaims || false,
});

const fromProviderRow = (row: ProviderRow): Provider => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  targetWeekDays: row.target_week_days,
  targetWeekendDays: row.target_weekend_days,
  targetWeekNights: row.target_week_nights,
  targetWeekendNights: row.target_weekend_nights,
  timeOffRequests: row.time_off_requests || [],
  preferredDates: row.preferred_dates || [],
  skills: row.skills || [],
  maxConsecutiveNights: row.max_consecutive_nights,
  minDaysOffAfterNight: row.min_days_off_after_night,
  credentials: row.credentials || [],
  schedulingRestrictions: row.scheduling_restrictions || {},
  notes: row.notes || undefined,
  communicationPreferences: row.communication_preferences,
  fatigueMetrics: row.fatigue_metrics,
  autoApproveClaims: row.auto_approve_claims,
});

const toSlotRow = (slot: ShiftSlot): SlotRow => ({
  id: slot.id,
  date: slot.date,
  type: slot.type,
  provider_id: slot.providerId,
  is_weekend_layout: slot.isWeekendLayout,
  required_skill: slot.requiredSkill,
  priority: slot.priority,
  is_backup: slot.isBackup || false,
  location: slot.location,
  secondary_provider_ids: slot.secondaryProviderIds || [],
  is_shared_assignment: slot.isSharedAssignment || false,
  location_group: slot.locationGroup,
  service_priority: slot.servicePriority,
  service_location: slot.serviceLocation,
  notes: slot.notes || null,
});

const fromSlotRow = (row: SlotRow): ShiftSlot => ({
  id: row.id,
  date: row.date,
  type: row.type,
  providerId: row.provider_id,
  isWeekendLayout: row.is_weekend_layout,
  requiredSkill: row.required_skill,
  priority: row.priority,
  isBackup: row.is_backup || false,
  location: row.location,
  secondaryProviderIds: row.secondary_provider_ids || [],
  isSharedAssignment: row.is_shared_assignment || false,
  locationGroup: row.location_group || "MAIN_CAMPUS_UNIT",
  servicePriority: row.service_priority || "STANDARD",
  serviceLocation: row.service_location || (row.location as ShiftSlot["serviceLocation"]),
  notes: row.notes || undefined,
});

const replaceKeyedRows = async (
  table: "custom_rules" | "audit_logs" | "scenarios" | "day_handoffs",
  keyColumn: "id" | "date",
  upsertRows: Record<string, unknown>[]
): Promise<void> => {
  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(upsertRows);
    if (upsertError) throw new Error(`Failed to save ${table}: ${upsertError.message}`);
  }

  const { data: existing } = await supabase.from(table).select(keyColumn);
  if (!existing) return;
  const keep = new Set(upsertRows.map((row) => row[keyColumn] as string));
  const toDelete = (existing as Array<Record<string, unknown>>)
    .map((row) => row[keyColumn] as string)
    .filter((key) => !keep.has(key));
  if (toDelete.length === 0) return;
  const { error } = await supabase.from(table).delete().in(keyColumn, toDelete);
  if (error) throw new Error(`Failed to delete ${table}: ${error.message}`);
};

export async function saveScheduleState(state: PersistedScheduleState): Promise<{ ok: boolean; offline?: boolean }> {
  if (supabaseStatus.isPlaceholder) {
    return { ok: true, offline: true };
  }

  try {
    if (state.providers.length > 0) {
      const { error: pError } = await supabase.from("providers").upsert(state.providers.map(toProviderRow));
      if (pError) throw new Error(`Failed to save providers: ${pError.message}`);
    }

    const { data: existingProviders } = await supabase.from("providers").select("id");
    if (existingProviders) {
      const incomingProviderIds = new Set(state.providers.map((provider) => provider.id));
      const providersToDelete = existingProviders.filter((row) => !incomingProviderIds.has(row.id)).map((row) => row.id);
      if (providersToDelete.length > 0) {
        const { error } = await supabase.from("providers").delete().in("id", providersToDelete);
        if (error) throw new Error(`Failed to delete removed providers: ${error.message}`);
      }
    }

    if (state.slots.length > 0) {
      const slotsToUpsert = state.slots.map(toSlotRow);
      for (let i = 0; i < slotsToUpsert.length; i += 500) {
        const chunk = slotsToUpsert.slice(i, i + 500);
        const { error: sError } = await supabase.from("slots").upsert(chunk);
        if (sError) throw new Error(`Failed to save slots: ${sError.message}`);
      }
    }

    const { data: existingSlots } = await supabase.from("slots").select("id");
    if (existingSlots && state.slots) {
      const incomingSlotIds = new Set(state.slots.map((slot) => slot.id));
      const slotsToDelete = existingSlots.filter((row) => !incomingSlotIds.has(row.id)).map((row) => row.id);
      for (let i = 0; i < slotsToDelete.length; i += 500) {
        const chunk = slotsToDelete.slice(i, i + 500);
        const { error } = await supabase.from("slots").delete().in("id", chunk);
        if (error) throw new Error(`Failed to delete removed slots: ${error.message}`);
      }
    }

    await replaceKeyedRows(
      "custom_rules",
      "id",
      state.customRules.map((rule) => ({
        id: rule.id,
        type: rule.type,
        provider_a: rule.providerA ?? null,
        provider_b: rule.providerB ?? null,
        provider_id: rule.providerId ?? null,
        max_shifts: rule.maxShifts ?? null,
      }))
    );

    await replaceKeyedRows(
      "audit_logs",
      "id",
      state.auditLog.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        action: entry.action,
        details: entry.details,
        slot_id: entry.slotId ?? null,
        provider_id: entry.providerId ?? null,
        actor: entry.user ?? null,
      }))
    );

    await replaceKeyedRows(
      "scenarios",
      "id",
      state.scenarios.map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        created_at: scenario.createdAt,
        start_date: scenario.startDate,
        num_weeks: scenario.numWeeks,
        providers: scenario.providers,
        slots: scenario.slots,
      }))
    );

    await replaceKeyedRows(
      "day_handoffs",
      "date",
      (state.dayHandoffs || []).map((handoff) => ({
        date: handoff.date,
        notes: handoff.notes,
        updated_at: handoff.updatedAt,
        updated_by: handoff.updatedBy ?? null,
      }))
    );

    const { error: configError } = await supabase.from("global_settings").upsert({
      key: "schedule_config",
      value: { startDate: state.startDate, numWeeks: state.numWeeks },
    });
    if (configError) throw new Error(`Failed to save schedule config: ${configError.message}`);

    return { ok: true };
  } catch (error) {
    console.warn("[scheduleState] saveScheduleState fallback to local:", error);
    return { ok: true, offline: true };
  }
}

export async function loadScheduleState(): Promise<{ state: PersistedScheduleState | null }> {
  if (supabaseStatus.isPlaceholder) {
    return { state: null };
  }

  try {
    const { data: configData, error: configError } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "schedule_config")
      .single();

    if (configError && configError.code !== "PGRST116") {
      console.warn(`[Supabase] Failed to load schedule config: ${configError.message}`);
      return { state: null };
    }

    const configValue = (configData?.value || {}) as Partial<PersistedScheduleState> & {
      startDate?: string;
      numWeeks?: number;
    };

    const { data: providersData, error: pError } = await supabase.from("providers").select("*");
    if (pError) {
      console.warn(`[Supabase] Failed to load providers: ${pError.message}`);
      return { state: null };
    }

    const { data: slotsData, error: sError } = await supabase.from("slots").select("*");
    if (sError) {
      console.warn(`[Supabase] Failed to load slots: ${sError.message}`);
      return { state: null };
    }

    const [{ data: ruleRows }, { data: auditRows }, { data: scenarioRows }, { data: handoffRows }] = await Promise.all([
      supabase.from("custom_rules").select("*"),
      supabase.from("audit_logs").select("*"),
      supabase.from("scenarios").select("*"),
      supabase.from("day_handoffs").select("*"),
    ]);

    const customRules: CustomRule[] = (ruleRows || []).map((row) => ({
      id: row.id,
      type: row.type,
      providerA: row.provider_a ?? undefined,
      providerB: row.provider_b ?? undefined,
      providerId: row.provider_id ?? undefined,
      maxShifts: row.max_shifts ?? undefined,
    }));

    const auditLog: AuditLogEntry[] = (auditRows || []).map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      action: row.action,
      details: row.details,
      slotId: row.slot_id ?? undefined,
      providerId: row.provider_id ?? undefined,
      user: row.actor ?? undefined,
    }));

    const scenarios: ScenarioSnapshot[] = (scenarioRows || []).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      startDate: row.start_date,
      numWeeks: row.num_weeks,
      providers: row.providers || [],
      slots: row.slots || [],
    }));

    const dayHandoffs: DayHandoff[] = (handoffRows || []).map((row) => ({
      date: row.date,
      notes: row.notes,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by ?? undefined,
    }));

    const persistedState: PersistedScheduleState = {
      providers: (providersData || []).map((row) => fromProviderRow(row as ProviderRow)),
      slots: (slotsData || []).map((row) => fromSlotRow(row as SlotRow)),
      startDate: configValue.startDate ?? new Date().toISOString().split("T")[0],
      numWeeks: configValue.numWeeks ?? 4,
      scenarios: scenarios.length > 0 ? scenarios : configValue.scenarios || [],
      customRules: customRules.length > 0 ? customRules : configValue.customRules || [],
      auditLog: auditLog.length > 0 ? auditLog : configValue.auditLog || [],
      dayHandoffs: dayHandoffs.length > 0 ? dayHandoffs : configValue.dayHandoffs || [],
    };

    return { state: persistedState };
  } catch (err) {
    console.warn("[scheduleState] loadScheduleState fallback to local:", err);
    return { state: null };
  }
}

export async function optimizeWithSolver(
  payload: PersistedScheduleState | { state: PersistedScheduleState; solverProfile?: string }
): Promise<{ result: unknown }> {
  return requestJson<{ result: unknown }>(
    "/api/solver/optimize",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Optimize with solver"
  );
}
