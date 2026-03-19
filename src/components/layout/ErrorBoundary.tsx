import React, { type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';
import { ApiError, buildClientErrorReport, buildIncidentId, formatReportForClipboard, peekLastApiError } from '@/lib/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  incidentId: string | null;
  copyDone: boolean;
}

/**
 * Catches React errors in the tree and renders a fallback UI instead of crashing.
 * Aligns with Next.js-style error boundaries for route segments.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, incidentId: null, copyDone: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, incidentId: buildIncidentId(), copyDone: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    const { incidentId } = this.state;
    void import('@/lib/sentry')
      .then((m) => {
        m.captureError(error, {
          incidentId,
          reactComponentStack: errorInfo.componentStack,
        });
      })
      .catch(() => {});
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, incidentId: null, copyDone: false });
  };

  handleCopyDebugReport = async (): Promise<void> => {
    const { error, incidentId } = this.state;
    if (!error || !incidentId) {
      return;
    }
    const lastApi = peekLastApiError();
    const report = buildClientErrorReport({
      incidentId,
      error,
      apiError: lastApi instanceof ApiError ? lastApi : error instanceof ApiError ? error : null,
    });
    const text = formatReportForClipboard(report);
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copyDone: true });
      window.setTimeout(() => this.setState({ copyDone: false }), 2500);
    } catch {
      console.error('Could not copy debug report to clipboard');
    }
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          className="satin-panel border-rose-200/60 bg-rose-50/30 p-8 rounded-2xl flex flex-col items-center justify-center gap-6 min-h-[280px] text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center border border-rose-200/60">
            <AlertTriangle className="w-7 h-7 text-rose-600" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-600 max-w-md">
              This view encountered an error. You can try again or switch to another section.
            </p>
            {this.state.error && (
              <div className="mt-3 space-y-2 text-left w-full max-w-md">
                {this.state.incidentId && (
                  <p className="text-xs text-slate-500 font-mono break-all">
                    Incident: {this.state.incidentId}
                  </p>
                )}
                {import.meta.env.DEV && (
                  <pre className="text-xs text-rose-700 bg-rose-100/50 p-3 rounded-lg overflow-auto max-h-28">
                    {this.state.error.message}
                  </pre>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleCopyDebugReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors"
              aria-label="Copy debug report for troubleshooting"
            >
              {this.state.copyDone ? (
                <Check className="w-4 h-4 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="w-4 h-4" aria-hidden />
              )}
              {this.state.copyDone ? 'Copied' : 'Copy debug report'}
            </button>
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
