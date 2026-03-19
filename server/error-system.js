/**
 * Request correlation, structured logging, and consistent API error responses.
 */
import { randomUUID } from "node:crypto";
import pino from "pino";

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level: logLevel,
  base: { service: "scheduler-api" },
});

/**
 * Attach requestId (from X-Request-Id or new UUID), child logger on req.
 */
export function requestContextMiddleware(req, res, next) {
  const headerId = req.headers["x-request-id"];
  const requestId =
    typeof headerId === "string" && headerId.trim().length > 0 ? headerId.trim() : randomUUID();
  req.requestId = requestId;
  req.log = logger.child({ requestId });
  res.setHeader("X-Request-Id", requestId);
  next();
}

/**
 * Log one line per completed HTTP response (RED-oriented: status + duration).
 */
export function httpLogMiddleware(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const log = req.log || logger;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    log[level](
      {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs,
      },
      "http_request"
    );
  });
  next();
}

/**
 * 404 for unmatched /api routes with same envelope as other API errors.
 */
export function apiNotFoundHandler(req, res, next) {
  if (!req.path.startsWith("/api")) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }
  const requestId = req.requestId || "unknown";
  res.status(404).json({
    error: `No route for ${req.method} ${req.originalUrl}`,
    code: "NOT_FOUND",
    requestId,
  });
}

/**
 * Central error handler: structured log + JSON body with requestId for support/debugging.
 */
export function globalErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  const requestId = req.requestId || "unknown";
  const log = req.log || logger;
  log.error({ err, path: req.originalUrl || req.url }, "unhandled_error");

  const status = Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
  const isDev = process.env.NODE_ENV !== "production";
  const body = {
    error: typeof err.message === "string" && err.message.length > 0 ? err.message : "Internal server error",
    code: typeof err.code === "string" && err.code.length > 0 ? err.code : "INTERNAL",
    requestId,
    ...(isDev && err.stack ? { stack: err.stack } : {}),
  };
  res.status(status).json(body);
}
