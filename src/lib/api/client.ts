/**
 * API Client
 * Base HTTP client with request/response handling
 */

import { ApiError, apiErrorFromResponse, setLastApiError } from "@/lib/errors";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:4000");
const API_TIMEOUT_MS = 15_000;

const newClientRequestId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

export async function requestJson<T>(path: string, init: RequestInit, actionLabel: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const clientRequestId = newClientRequestId();
  const headers = new Headers(init.headers ?? undefined);
  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", clientRequestId);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const correlationId = response.headers.get("x-request-id")?.trim() || clientRequestId;
    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? ((await response.json()) as unknown) : await response.text();

    if (!response.ok) {
      const fallback =
        typeof payload === "string" && payload.trim().length > 0
          ? `${actionLabel} failed: ${payload.trim()}`
          : `${actionLabel} failed: HTTP ${response.status}`;
      const err = apiErrorFromResponse(response.status, payload, fallback, correlationId);
      setLastApiError(err);
      throw err;
    }

    setLastApiError(null);
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const err = new ApiError(`${actionLabel} timed out after ${API_TIMEOUT_MS}ms`, {
        status: 408,
        code: "CLIENT_TIMEOUT",
        requestId: clientRequestId,
      });
      setLastApiError(err);
      throw err;
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export { API_BASE, API_TIMEOUT_MS };
