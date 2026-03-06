import * as Sentry from '@sentry/react';
import { useEffect } from 'react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.MODE || 'development';

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.01 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Before sending events
    beforeSend(event) {
      // Filter out specific errors
      if (event.exception?.values?.some(e => 
        e.value?.includes('ResizeObserver loop limit exceeded')
      )) {
        return null;
      }
      return event;
    },
  });
}

/**
 * Custom hook to capture navigation for Sentry
 */
export function useSentryNavigation(): void {
  useEffect(() => {
    const handleRouteChange = () => {
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: `Navigated to ${window.location.pathname}`,
        level: 'info',
        data: {
          path: window.location.pathname,
          search: window.location.search,
        },
      });
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);
}

/**
 * Sentry Error Boundary component wrapper
 */
export function SentryErrorBoundary({ children }: { children: React.ReactNode }): JSX.Element {
  const ErrorBoundary = Sentry.ErrorBoundary;
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-6">
              We've been notified and are working to fix the issue.
            </p>
            <button
              onClick={resetError}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
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
 * Capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id: string; email?: string; name?: string } | null): void {
  Sentry.setUser(user);
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

export { Sentry };
