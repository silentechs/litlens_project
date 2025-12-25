"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 mx-auto bg-rose-50 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif text-ink">Something went wrong</h2>
              <p className="text-muted font-serif italic">
                We encountered an unexpected error. Please try refreshing the page.
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="btn-editorial inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded text-left text-xs text-rose-800 overflow-auto max-h-40">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============== SPECIALIZED ERROR BOUNDARIES ==============

export function ImportErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="py-20 text-center space-y-6">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
          <div>
            <h2 className="text-2xl font-serif text-ink">Import Error</h2>
            <p className="text-muted font-serif italic mt-2">
              There was a problem with the import process. Please try again.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function ScreeningErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="py-20 text-center space-y-6">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
          <div>
            <h2 className="text-2xl font-serif text-ink">Screening Error</h2>
            <p className="text-muted font-serif italic mt-2">
              Unable to load the screening queue. Your progress has been saved.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function ExtractionErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="py-20 text-center space-y-6">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
          <div>
            <h2 className="text-2xl font-serif text-ink">Extraction Error</h2>
            <p className="text-muted font-serif italic mt-2">
              There was a problem loading the extraction form. Your data is safe.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function SearchErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="py-20 text-center space-y-6">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
          <div>
            <h2 className="text-2xl font-serif text-ink">Search Unavailable</h2>
            <p className="text-muted font-serif italic mt-2">
              Unable to connect to search services. Please try again later.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

