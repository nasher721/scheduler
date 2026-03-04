import { supabase } from "./supabase";
import { type PersistedScheduleState, type Provider } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:4000");

export type ShiftRequestType = "time_off" | "swap" | "availability";
export type ShiftRequestStatus = "pending" | "approved" | "denied";

export interface ShiftRequest {
  id: string;
  providerName: string;
  providerEmail?: string;
  date: string;
  type: ShiftRequestType;
  notes: string;
  status: ShiftRequestStatus;
  source?: "app" | "email";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface EmailEvent {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}

export async function saveScheduleState(state: PersistedScheduleState) {
  // 1. Upsert Providers
  if (state.providers.length > 0) {
    const providersToUpsert = state.providers.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email || `${p.id}@placeholder.org`, // Fallback since DB structure requires an email
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
    const incomingProviderIds = new Set(state.providers.map(p => p.id));
    const providersToDelete = existingProviders.filter(p => !incomingProviderIds.has(p.id)).map(p => p.id);
    if (providersToDelete.length > 0) {
      const { error } = await supabase.from("providers").delete().in("id", providersToDelete);
      if (error) throw new Error(`Failed to delete removed providers: ${error.message}`);
    }
  }

  // 2. Upsert Slots
  if (state.slots.length > 0) {
    const slotsToUpsert = state.slots.map(s => ({
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
    }));

    for (let i = 0; i < slotsToUpsert.length; i += 500) {
      const chunk = slotsToUpsert.slice(i, i + 500);
      const { error: sError } = await supabase.from("slots").upsert(chunk);
      if (sError) throw new Error(`Failed to save slots: ${sError.message}`);
    }
  }

  // 2b. Delete removed slots
  const { data: existingSlots } = await supabase.from("slots").select("id");
  if (existingSlots) {
    const incomingSlotIds = new Set(state.slots.map(s => s.id));
    const slotsToDelete = existingSlots.filter(s => !incomingSlotIds.has(s.id)).map(s => s.id);
    if (slotsToDelete.length > 0) {
      for (let i = 0; i < slotsToDelete.length; i += 500) {
        const chunk = slotsToDelete.slice(i, i + 500);
        const { error } = await supabase.from("slots").delete().in("id", chunk);
        if (error) throw new Error(`Failed to delete removed slots: ${error.message}`);
      }
    }
  }

  // 3. Save remaining state configuration variables to global_settings (startDate, numWeeks, scenarios, customRules, auditLog)
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

export async function loadScheduleState() {
  // 1. Fetch config variables
  const { data: configData, error: configError } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "schedule_config")
    .single();

  if (configError && configError.code !== "PGRST116") {
    throw new Error(`Failed to load schedule config: ${configError.message}`);
  }

  const baseState = configData?.value ? (configData.value as Partial<PersistedScheduleState>) : {
    startDate: new Date().toISOString().split("T")[0],
    numWeeks: 4,
    scenarios: [],
    customRules: [],
    auditLog: []
  };

  // 2. Fetch Providers
  const { data: providersData, error: pError } = await supabase.from("providers").select("*");
  if (pError) throw new Error(`Failed to load providers: ${pError.message}`);

  const providers = (providersData || []).map(p => ({
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

  const slots = (slotsData || []).map(s => ({
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

export async function listShiftRequests(status?: ShiftRequestStatus) {
  let query = supabase
    .from("shift_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load shift requests: ${error.message}`);
  }

  return {
    requests: (data || []).map(r => ({
      id: r.id,
      providerName: r.provider_name,
      providerEmail: r.provider_email,
      date: r.date,
      type: r.type as ShiftRequestType,
      notes: r.notes || "",
      status: r.status as ShiftRequestStatus,
      source: r.source as "app" | "email",
      createdAt: r.requested_at,
      reviewedAt: r.resolved_at,
      reviewedBy: r.resolved_by,
    })) as ShiftRequest[]
  };
}

export async function createShiftRequest(payload: {
  providerName: string;
  providerEmail?: string;
  date: string;
  type: ShiftRequestType;
  notes?: string;
  source?: "app" | "email";
}) {
  const { data, error } = await supabase
    .from("shift_requests")
    .insert({
      provider_name: payload.providerName,
      provider_email: payload.providerEmail,
      date: payload.date,
      type: payload.type,
      notes: payload.notes,
      source: payload.source || "app",
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create shift request: ${error.message}`);
  }

  return {
    request: {
      id: data.id,
      providerName: data.provider_name,
      providerEmail: data.provider_email,
      date: data.date,
      type: data.type as ShiftRequestType,
      notes: data.notes || "",
      status: data.status as ShiftRequestStatus,
      source: data.source as "app" | "email",
      createdAt: data.requested_at,
      reviewedAt: data.resolved_at,
      reviewedBy: data.resolved_by,
    } as ShiftRequest
  };
}

export async function listEmailEvents(type?: string) {
  let query = supabase
    .from("email_events")
    .select("*")
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load email events: ${error.message}`);
  }

  return { events: data as EmailEvent[] };
}

export async function updateEmailEvent(id: string, payload: { status: string }) {
  const response = await fetch(`${API_BASE}/api/email-events/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update email event (${response.status})`);
  }

  return response.json() as Promise<{ event: EmailEvent; updatedAt: string }>;
}

export async function deleteEmailEvent(id: string) {
  const response = await fetch(`${API_BASE}/api/email-events/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete email event (${response.status})`);
  }

  return response.json() as Promise<{ ok: boolean; deletedId: string; updatedAt: string }>;
}

export async function submitInboundEmail(payload: {
  from: string;
  subject: string;
  body: string;
  providerName?: string;
  date?: string;
  type?: ShiftRequestType;
}) {
  // 1. Log the email event
  await supabase.from("email_events").insert({
    type: "inbound",
    status: "received",
    raw_payload: payload,
  });

  // 2. Create a shift request if possible
  if (payload.providerName && payload.date && payload.type) {
    return createShiftRequest({
      providerName: payload.providerName,
      providerEmail: payload.from,
      date: payload.date,
      type: payload.type,
      notes: `Subbed from subject: ${payload.subject}`,
      source: "email",
    });
  }

  throw new Error("Missing required fields for inbound email processing");
}

export async function reviewShiftRequest(id: string, payload: { status: "approved" | "denied"; reviewedBy: string }) {
  const { data, error } = await supabase
    .from("shift_requests")
    .update({
      status: payload.status,
      resolved_by: payload.reviewedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to review shift request: ${error.message}`);
  }

  return {
    request: {
      id: data.id,
      providerName: data.provider_name,
      providerEmail: data.provider_email,
      date: data.date,
      type: data.type as ShiftRequestType,
      notes: data.notes || "",
      status: data.status as ShiftRequestStatus,
      source: data.source as "app" | "email",
      createdAt: data.requested_at,
      reviewedAt: data.resolved_at,
      reviewedBy: data.resolved_by,
    } as ShiftRequest
  };
}

export async function deleteShiftRequest(id: string) {
  const response = await fetch(`${API_BASE}/api/shift-requests/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete shift request (${response.status})`);
  }

  return response.json() as Promise<{ ok: boolean; deletedId: string; updatedAt: string }>;
}

export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationRecord {
  id: string;
  eventType: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  channels: string[];
  statusByChannel: Record<string, string>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function sendNotification(payload: {
  title: string;
  body: string;
  severity?: NotificationSeverity;
  eventType?: string;
  channels?: string[];
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      title: payload.title,
      body: payload.body,
      severity: payload.severity || "info",
      event_type: payload.eventType,
      channels: payload.channels || [],
      metadata: payload.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to send notification: ${error.message}`);
  }

  return {
    notification: {
      id: data.id,
      eventType: data.event_type,
      title: data.title,
      body: data.body,
      severity: data.severity as NotificationSeverity,
      channels: data.channels as string[],
      statusByChannel: data.status_by_channel as Record<string, string>,
      metadata: data.metadata as Record<string, unknown>,
      createdAt: data.created_at,
    } as NotificationRecord
  };
}

export async function listNotificationHistory(limit = 50) {
  const { data, error, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load notification history: ${error.message}`);
  }

  return {
    records: (data || []).map(d => ({
      id: d.id,
      eventType: d.event_type,
      title: d.title,
      body: d.body,
      severity: d.severity as NotificationSeverity,
      channels: d.channels as string[],
      statusByChannel: d.status_by_channel as Record<string, string>,
      metadata: d.metadata as Record<string, unknown>,
      createdAt: d.created_at,
    })) as NotificationRecord[],
    total: count || 0
  };
}

export async function updateNotification(id: string, payload: {
  title?: string;
  body?: string;
  severity?: NotificationSeverity;
  channels?: string[];
  statusByChannel?: Record<string, string>;
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`${API_BASE}/api/notifications/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update notification (${response.status})`);
  }

  return response.json() as Promise<{ notification: NotificationRecord; updatedAt: string }>;
}

export async function deleteNotification(id: string) {
  const response = await fetch(`${API_BASE}/api/notifications/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete notification (${response.status})`);
  }

  return response.json() as Promise<{ ok: boolean; deletedId: string; updatedAt: string }>;
}

export async function optimizeWithSolver(payload: PersistedScheduleState | { state: PersistedScheduleState; solverProfile?: string }) {
  const response = await fetch(`${API_BASE}/api/solver/optimize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to optimize with solver (${response.status})`);
  }

  return response.json() as Promise<{ result: unknown }>;
}

// ==================== COPILOT API ====================

export interface CopilotContext {
  viewType?: 'week' | 'month';
  selectedDate?: string | null;
  selectedProviderId?: string | null;
  userRole?: 'ADMIN' | 'SCHEDULER' | 'CLINICIAN';
  visibleProviderCount?: number;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  confidence?: number;
  suggestions?: string[];
  requiresConfirmation?: boolean;
  preview?: unknown;
  actions?: unknown[];
}

export interface CopilotChatResponse {
  result: {
    messageId: string;
    intent: string;
    confidence: number;
    entities: Record<string, unknown>;
    response: string;
    suggestions: string[];
    requiresConfirmation: boolean;
    preview: unknown | null;
    actions: unknown[];
  };
  updatedAt: string;
}

export async function sendCopilotMessage(
  message: string,
  context: CopilotContext,
  conversationHistory: CopilotMessage[] = []
): Promise<CopilotChatResponse> {
  const response = await fetch(`${API_BASE}/api/copilot/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, context, conversationHistory }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send copilot message (${response.status})`);
  }

  return response.json() as Promise<CopilotChatResponse>;
}

export interface CopilotIntentResponse {
  result: {
    provider: string;
    source: string;
    intent: string;
    confidence: number;
    entities: {
      providerName: string | null;
      date: string | null;
      shiftType: string | null;
      targetProvider: string | null;
    };
    originalText: string;
  };
  updatedAt: string;
}

export async function parseCopilotIntent(
  text: string,
  context: CopilotContext
): Promise<CopilotIntentResponse> {
  const response = await fetch(`${API_BASE}/api/copilot/intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, context }),
  });

  if (!response.ok) {
    throw new Error(`Failed to parse intent (${response.status})`);
  }

  return response.json() as Promise<CopilotIntentResponse>;
}

export interface CopilotSuggestionsResponse {
  result: {
    recommendations: Array<{
      id: string;
      title: string;
      impact: 'high' | 'medium' | 'low';
      rationale: string;
      context?: Record<string, unknown>;
    }>;
    context: CopilotContext;
    source: string;
  };
  updatedAt: string;
}

export interface CopilotCapabilitiesResponse {
  result: {
    capabilitySchemaVersion: string;
    intents: string[];
    actions: string[];
    confirmationRequiredIntents: string[];
    examplePrompts: string[];
  };
  updatedAt: string;
}

export async function getCopilotSuggestions(
  context: CopilotContext
): Promise<CopilotSuggestionsResponse> {
  const params = new URLSearchParams();
  if (context.viewType) params.append('viewType', context.viewType);
  if (context.selectedDate) params.append('selectedDate', context.selectedDate);
  if (context.selectedProviderId) params.append('selectedProviderId', context.selectedProviderId);
  if (context.userRole) params.append('userRole', context.userRole);
  if (context.visibleProviderCount) params.append('visibleProviderCount', context.visibleProviderCount.toString());

  const response = await fetch(`${API_BASE}/api/copilot/suggestions?${params}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get suggestions (${response.status})`);
  }

  return response.json() as Promise<CopilotSuggestionsResponse>;
}

export async function getCopilotCapabilities(): Promise<CopilotCapabilitiesResponse> {
  const response = await fetch(`${API_BASE}/api/copilot/capabilities`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load copilot capabilities (${response.status})`);
  }

  return response.json() as Promise<CopilotCapabilitiesResponse>;
}
export async function registerProvider(provider: Omit<Provider, "id">) {
  try {
    // 1. Sign up the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: provider.email || "",
      password: "password123", // Default password for migration simplicity
      options: {
        data: {
          name: provider.name,
          role: provider.role,
        },
      },
    });

    if (authError) {
      console.error("Supabase Auth Error:", authError);
      throw new Error(`Auth Error: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error("Registration failed: No user returned from Supabase");
    }

    // 2. Insert provider details into the providers table
    const { data: providerData, error: providerError } = await supabase
      .from("providers")
      .insert({
        id: crypto.randomUUID(),
        profile_id: authData.user.id,
        name: provider.name,
        email: provider.email,
        role: provider.role,
        target_week_days: provider.targetWeekDays,
        target_weekend_days: provider.targetWeekendDays,
        target_week_nights: provider.targetWeekNights,
        target_weekend_nights: provider.targetWeekendNights,
        time_off_requests: provider.timeOffRequests,
        preferred_dates: provider.preferredDates,
        skills: provider.skills,
        max_consecutive_nights: provider.maxConsecutiveNights,
        min_days_off_after_night: provider.minDaysOffAfterNight,
        notes: provider.notes,
      })
      .select()
      .single();

    if (providerError) {
      console.error("Supabase Database Error:", providerError);
      throw new Error(`Database Error: ${providerError.message}`);
    }

    return { ok: true, provider: { ...provider, id: providerData.id } as Provider };
  } catch (err) {
    console.error("Full Registration Failure:", err);
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error("Connection failed: Ensure Supabase URL is correct and you have an internet connection.");
    }
    throw err;
  }
}
