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
