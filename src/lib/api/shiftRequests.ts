/**
 * Shift Requests API
 * Shift request management and email workflow
 */

import { supabase } from "../supabase";
import {
  type ShiftRequest,
  type ShiftRequestType,
  type ShiftRequestStatus,
  type EmailEvent,
} from "../../types";

export async function listShiftRequests(status?: ShiftRequestStatus): Promise<{ requests: ShiftRequest[] }> {
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
    requests: (data || []).map((r) => ({
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
}): Promise<{ request: ShiftRequest }> {
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

export async function reviewShiftRequest(
  id: string,
  payload: { status: "approved" | "denied"; reviewedBy: string }
): Promise<{ request: ShiftRequest }> {
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

// Email workflow
export async function listEmailEvents(type?: string): Promise<{ events: EmailEvent[] }> {
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

export async function submitInboundEmail(payload: {
  from: string;
  subject: string;
  body: string;
  providerName?: string;
  date?: string;
  type?: ShiftRequestType;
}): Promise<{ ok: boolean; request?: ShiftRequest }> {
  // 1. Log the email event
  const { error: emailEventError } = await supabase.from("email_events").insert({
    type: "inbound",
    status: "received",
    raw_payload: payload,
  });
  if (emailEventError) {
    throw new Error(`Failed to log inbound email event: ${emailEventError.message}`);
  }

  // 2. Create a shift request if the required fields are present
  if (payload.providerName && payload.date && payload.type) {
    const { request } = await createShiftRequest({
      providerName: payload.providerName,
      providerEmail: payload.from,
      date: payload.date,
      type: payload.type,
      notes: `Subbed from subject: ${payload.subject}`,
      source: "email",
    });
    return { ok: true, request };
  }

  // Email was logged successfully but not enough information to create a shift request
  console.warn("[submitInboundEmail] Email logged but missing providerName/date/type — skipping shift request creation.");
  return { ok: true };
}


export async function deleteShiftRequest(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("shift_requests").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete shift request: ${error.message}`);
  }

  return { ok: true };
}

export async function updateEmailEvent(
  id: string,
  payload: Partial<Pick<EmailEvent, "status" | "type">>
): Promise<{ event: EmailEvent }> {
  const { data, error } = await supabase
    .from("email_events")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update email event: ${error.message}`);
  }

  return { event: data as EmailEvent };
}

export async function deleteEmailEvent(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("email_events").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete email event: ${error.message}`);
  }

  return { ok: true };
}
