import type { ApiError } from "./types";

export type ClientErrorReport = {
  kind: "client_error_report";
  generatedAt: string;
  incidentId: string;
  app: {
    mode: string;
    path: string;
    href: string;
    userAgent: string;
  };
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  api?: {
    status: number;
    requestId?: string;
    code?: string;
    supportLine: string;
  };
};

const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const buildIncidentId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `inc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const buildClientErrorReport = (params: {
  incidentId: string;
  error: Error;
  apiError?: ApiError | null;
}): ClientErrorReport => {
  const { incidentId, error, apiError } = params;
  const isDev = import.meta.env.DEV;
  return {
    kind: "client_error_report",
    generatedAt: new Date().toISOString(),
    incidentId,
    app: {
      mode: import.meta.env.MODE,
      path: typeof window !== "undefined" ? window.location.pathname : "",
      href: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    },
    error: {
      name: error.name,
      message: error.message,
      ...(isDev && error.stack ? { stack: error.stack } : {}),
    },
    ...(apiError
      ? {
          api: {
            status: apiError.status,
            requestId: apiError.requestId,
            code: apiError.code,
            supportLine: apiError.toSupportString(),
          },
        }
      : {}),
  };
};

export const formatReportForClipboard = (report: ClientErrorReport): string => safeJson(report);

/** Store last API error for optional inclusion in a later UI error report */
let lastApiError: ApiError | null = null;

export const setLastApiError = (err: ApiError | null): void => {
  lastApiError = err;
};

export const consumeLastApiError = (): ApiError | null => {
  const v = lastApiError;
  lastApiError = null;
  return v;
};

export const peekLastApiError = (): ApiError | null => lastApiError;
