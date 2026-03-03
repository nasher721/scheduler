export interface PersistedScheduleState {
  providers: unknown[];
  startDate: string;
  numWeeks: number;
  slots: unknown[];
  scenarios: unknown[];
  customRules: unknown[];
  auditLog: unknown[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type ShiftRequestType = "time_off" | "swap" | "availability";
export type ShiftRequestStatus = "pending" | "approved" | "denied";

export interface ShiftRequest {
  id: string;
  providerName: string;
  date: string;
  type: ShiftRequestType;
  notes: string;
  status: ShiftRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
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
