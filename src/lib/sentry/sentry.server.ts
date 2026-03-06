import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * Initialize Sentry for Node.js server
 */
export function initSentryServer(): void {
  if (!SENTRY_DSN) {
    console.warn('[Sentry Server] DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.postgresIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    // Profiles sample rate
    profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
  });
}

/**
 * Express error handler middleware
 */
export function sentryErrorHandler(): ReturnType<typeof Sentry.expressErrorHandler> {
  return Sentry.expressErrorHandler();
}

/**
 * Request handler middleware (must be first)
 */
export function sentryRequestHandler(): ReturnType<typeof Sentry.expressRequestHandler> {
  return Sentry.expressRequestHandler();
}

/**
 * Capture an error with additional context
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Set user context
 */
export function setUser(user: { id: string; email?: string; name?: string } | null): void {
  Sentry.setUser(user);
}

export { Sentry };
