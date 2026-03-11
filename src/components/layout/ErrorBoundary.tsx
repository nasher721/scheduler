import React, { type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches React errors in the tree and renders a fallback UI instead of crashing.
 * Aligns with Next.js-style error boundaries for route segments.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
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
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-3 text-left text-xs text-rose-700 bg-rose-100/50 p-3 rounded-lg overflow-auto max-h-24">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
