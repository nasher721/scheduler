/**
 * Schedule State API
 * Schedule state persistence and retrieval
 */

import { supabase } from "../supabase";
import { requestJson } from "./client";
import type { PersistedScheduleState, Provider, ShiftSlot } from "../../types";

export async function saveScheduleState(state: PersistedScheduleState): Promise<{ ok: boolean }> {
  // 1. Upsert Providers
  if (state.providers.length > 0) {
    const providersToUpsert = state.providers.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email || `${p.id}@placeholder.org`,
      role: p.role || "CLINICIAN",
      target_week_days: p.targetWeekDays,
      target_weekend_days: p.targetWeekendDays,
      target_week_nights: p.targetWeekNights,
      target_weekend_nights: p.targetWeekendNights,
      time_off_requests: p.timeOffRequests,
      preferred_dates: p.preferredDates,
      skills: p.skills,
      max_consecutive_nights: p.maxConsecutiveNights,
      min_days_off_after_night: p.minDaysOffAfterNight,
      credentials: p.credentials || [],
      scheduling_restrictions: p.schedulingRestrictions || {},
      notes: p.notes || null,
    }));
    const { error: pError } = await supabase.from("providers").upsert(providersToUpsert);
    if (pError) throw new Error(`Failed to save providers: ${pError.message}`);
  }

  // 1b. Delete removed providers
  const { data: existingProviders } = await supabase.from("providers").select("id");
  if (existingProviders) {
    const incomingProviderIds = new Set(state.providers.map((p) => p.id));
    const providersToDelete = existingProviders.filter((p) => !incomingProviderIds.has(p.id)).map((p) => p.id);
    if (providersToDelete.length > 0) {
      const { error } = await supabase.from("providers").delete().in("id", providersToDelete);
      if (error) throw new Error(`Failed to delete removed providers: ${error.message}`);
    }
  }

  // 2. Upsert Slots
  if (state.slots.length > 0) {
    const slotsToUpsert = state.slots.map((s) => ({
      id: s.id,
      date: s.date,
      type: s.type,
      provider_id: s.providerId,
      is_weekend_layout: s.isWeekendLayout,
      required_skill: s.requiredSkill,
      priority: s.priority,
      location: s.location,
      secondary_provider_ids: s.secondaryProviderIds || [],
      is_shared_assignment: s.isSharedAssignment || false,
      location_group: s.locationGroup,
      service_priority: s.servicePriority,
      service_location: s.serviceLocation,
    }));

    for (let i = 0; i < slotsToUpsert.length; i += 500) {
      const chunk = slotsToUpsert.slice(i, i + 500);
      const { error: sError } = await supabase.from("slots").upsert(chunk);
      if (sError) throw new Error(`Failed to save slots: ${sError.message}`);
    }
  }

  // 2b. Delete removed slots
  const { data: existingSlots } = await supabase.from("slots").select("id");
  if (existingSlots && state.slots) {
    const incomingSlotIds = new Set(state.slots.map((s) => s.id));
    const slotsToDelete = existingSlots.filter((s) => !incomingSlotIds.has(s.id)).map((s) => s.id);
    if (slotsToDelete.length > 0) {
      for (let i = 0; i < slotsToDelete.length; i += 500) {
        const chunk = slotsToDelete.slice(i, i + 500);
        const { error } = await supabase.from("slots").delete().in("id", chunk);
        if (error) throw new Error(`Failed to delete removed slots: ${error.message}`);
      }
    }
  }

  // 3. Save config
  const configValues = {
    startDate: state.startDate,
    numWeeks: state.numWeeks,
    scenarios: state.scenarios,
    customRules: state.customRules,
    auditLog: state.auditLog,
  };

  const { error: configError } = await supabase
    .from("global_settings")
    .upsert({
      key: "schedule_config",
      value: configValues,
    });

  if (configError) throw new Error(`Failed to save schedule config: ${configError.message}`);

  return { ok: true };
}

export async function loadScheduleState(): Promise<{ state: PersistedScheduleState }> {
  // 1. Fetch config
  const { data: configData, error: configError } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "schedule_config")
    .single();

  if (configError && configError.code !== "PGRST116") {
    throw new Error(`Failed to load schedule config: ${configError.message}`);
  }

  const baseState = configData?.value
    ? (configData.value as Partial<PersistedScheduleState>)
    : {
        startDate: new Date().toISOString().split("T")[0],
        numWeeks: 4,
        scenarios: [],
        customRules: [],
        auditLog: [],
      };

  // 2. Fetch Providers
  const { data: providersData, error: pError } = await supabase.from("providers").select("*");
  if (pError) throw new Error(`Failed to load providers: ${pError.message}`);

  const providers: Provider[] = (providersData || []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    targetWeekDays: p.target_week_days,
    targetWeekendDays: p.target_weekend_days,
    targetWeekNights: p.target_week_nights,
    targetWeekendNights: p.target_weekend_nights,
    timeOffRequests: p.time_off_requests || [],
    preferredDates: p.preferred_dates || [],
    skills: p.skills || [],
    maxConsecutiveNights: p.max_consecutive_nights,
    minDaysOffAfterNight: p.min_days_off_after_night,
    credentials: p.credentials || [],
    schedulingRestrictions: p.scheduling_restrictions || {},
    notes: p.notes,
  }));

  // 3. Fetch Slots
  const { data: slotsData, error: sError } = await supabase.from("slots").select("*");
  if (sError) throw new Error(`Failed to load slots: ${sError.message}`);

  const slots: ShiftSlot[] = (slotsData || []).map((s) => ({
    id: s.id,
    date: s.date,
    type: s.type,
    providerId: s.provider_id,
    isWeekendLayout: s.is_weekend_layout,
    requiredSkill: s.required_skill,
    priority: s.priority,
    location: s.location,
    secondaryProviderIds: s.secondary_provider_ids || [],
    isSharedAssignment: s.is_shared_assignment || false,
    locationGroup: s.location_group || "MAIN_CAMPUS_UNIT",
    servicePriority: s.service_priority || "STANDARD",
    serviceLocation: s.service_location || s.location,
  }));

  const persistedState: PersistedScheduleState = {
    providers,
    slots,
    startDate: baseState.startDate ?? new Date().toISOString().split("T")[0],
    numWeeks: baseState.numWeeks ?? 4,
    scenarios: baseState.scenarios || [],
    customRules: baseState.customRules || [],
    auditLog: baseState.auditLog || [],
  };

  return { state: persistedState };
}

// Solver optimization
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
