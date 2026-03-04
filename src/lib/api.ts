import { type Provider } from "../store";

export interface PersistedScheduleState {
  providers: Provider[];
  startDate: string;
  numWeeks: number;
  slots: unknown[];
  scenarios: unknown[];
  customRules: unknown[];
  auditLog: unknown[];
}

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
  const response = await fetch(`${API_BASE}/api/state`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error(`Failed to save state (${response.status})`);
  }

  return response.json();
}

export async function loadScheduleState() {
  const response = await fetch(`${API_BASE}/api/state`);
  if (!response.ok) {
    throw new Error(`Failed to load state (${response.status})`);
  }

  return response.json() as Promise<{ state: PersistedScheduleState | null }>;
}

export async function listShiftRequests(status?: ShiftRequestStatus) {
  const query = status ? `?status=${status}` : "";
  const response = await fetch(`${API_BASE}/api/shift-requests${query}`);
  if (!response.ok) {
    throw new Error(`Failed to load shift requests (${response.status})`);
  }

  return response.json() as Promise<{ requests: ShiftRequest[] }>;
}

export async function createShiftRequest(payload: {
  providerName: string;
  date: string;
  type: ShiftRequestType;
  notes?: string;
  source?: "app" | "email";
}) {
  const response = await fetch(`${API_BASE}/api/shift-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create shift request (${response.status})`);
  }

  return response.json() as Promise<{ request: ShiftRequest }>;
}

export async function listEmailEvents(type?: string) {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  const response = await fetch(`${API_BASE}/api/email-events${query}`);
  if (!response.ok) {
    throw new Error(`Failed to load email events (${response.status})`);
  }

  return response.json() as Promise<{ events: EmailEvent[] }>;
}

export async function submitInboundEmail(payload: {
  from: string;
  subject: string;
  body: string;
  providerName?: string;
  date?: string;
  type?: ShiftRequestType;
}) {
  const response = await fetch(`${API_BASE}/api/email/inbound`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit inbound email (${response.status})`);
  }

  return response.json() as Promise<{ request: ShiftRequest }>;
}

export async function reviewShiftRequest(id: string, payload: { status: "approved" | "denied"; reviewedBy: string }) {
  const response = await fetch(`${API_BASE}/api/shift-requests/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to review shift request (${response.status})`);
  }

  return response.json() as Promise<{ request: ShiftRequest }>;
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
  const response = await fetch(`${API_BASE}/api/notifications/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to send notification (${response.status})`);
  }

  return response.json() as Promise<{ notification: NotificationRecord }>;
}

export async function listNotificationHistory(limit = 50) {
  const response = await fetch(`${API_BASE}/api/notifications/history?limit=${Math.max(1, Math.floor(limit))}`);
  if (!response.ok) {
    throw new Error(`Failed to load notification history (${response.status})`);
  }

  return response.json() as Promise<{ records: NotificationRecord[]; total: number }>;
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
export async function registerProvider(provider: Omit<Provider, "id">) {
  const response = await fetch(`${API_BASE}/api/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(provider),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Registration failed (${response.status})`);
  }

  return response.json() as Promise<{ ok: boolean; provider: Provider }>;
}
