/**
 * Structured API failures from the Scheduler backend (and consistent client errors).
 */

export type ApiErrorPayload = {
  error?: string;
  message?: string;
  code?: string;
  requestId?: string;
  details?: unknown;
  stack?: string;
};

export class ApiError extends Error {
  readonly status: number;

  readonly requestId?: string;

  readonly code?: string;

  readonly details?: unknown;

  readonly rawBody?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      requestId?: string;
      code?: string;
      details?: unknown;
      rawBody?: unknown;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "ApiError";
    if (options.cause instanceof Error) {
      Object.defineProperty(this, "cause", { value: options.cause, enumerable: false, configurable: true });
    }
    this.status = options.status;
    this.requestId = options.requestId;
    this.code = options.code;
    this.details = options.details;
    this.rawBody = options.rawBody;
  }

  /** Human + support-friendly one-liner for logs and toasts */
  toSupportString(): string {
    const parts = [this.message];
    if (this.code) {
      parts.push(`code=${this.code}`);
    }
    if (this.requestId) {
      parts.push(`requestId=${this.requestId}`);
    }
    return parts.join(" · ");
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseApiErrorPayload = (payload: unknown): ApiErrorPayload | null => {
  if (!isRecord(payload)) {
    return null;
  }
  const out: ApiErrorPayload = {};
  if (typeof payload.error === "string") {
    out.error = payload.error;
  }
  if (typeof payload.message === "string") {
    out.message = payload.message;
  }
  if (typeof payload.code === "string") {
    out.code = payload.code;
  }
  if (typeof payload.requestId === "string") {
    out.requestId = payload.requestId;
  }
  if (payload.details !== undefined) {
    out.details = payload.details;
  }
  if (typeof payload.stack === "string") {
    out.stack = payload.stack;
  }
  return out;
};

export const apiErrorFromResponse = (
  status: number,
  payload: unknown,
  fallbackMessage: string,
  headerRequestId?: string | null
): ApiError => {
  const parsed = parseApiErrorPayload(payload);
  const msgFromBody =
    (parsed?.error && parsed.error.trim()) ||
    (parsed?.message && parsed.message.trim()) ||
    null;
  const message = msgFromBody ?? fallbackMessage;
  const requestId = parsed?.requestId ?? headerRequestId ?? undefined;
  return new ApiError(message, {
    status,
    requestId,
    code: parsed?.code,
    details: parsed?.details,
    rawBody: isRecord(payload) ? payload : undefined,
  });
};
