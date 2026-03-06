/**
 * API Client
 * Base HTTP client with request/response handling
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:4000");
const API_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const candidates = ["error", "message", "details"];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

export async function requestJson<T>(path: string, init: RequestInit, actionLabel: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? ((await response.json()) as unknown) : await response.text();

    if (!response.ok) {
      const details =
        (typeof payload === "string" && payload.trim().length > 0)
          ? payload
          : extractErrorMessage(payload) ?? `HTTP ${response.status}`;
      throw new Error(`${actionLabel} failed: ${details}`);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${actionLabel} timed out after ${API_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export { API_BASE, API_TIMEOUT_MS };
