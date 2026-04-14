/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI; receives error + reset callback */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches unhandled render errors and prevents the
 * entire app from crashing to a blank white screen.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[ErrorBoundary] Unhandled render error:",
      error,
      info.componentStack,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.handleReset);
      }

      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <h2 className="text-lg font-semibold text-red-800">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-red-600">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <details className="mt-3 text-left text-xs text-red-500">
              <summary className="cursor-pointer font-medium">
                Error details
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-red-100 p-2">
                {error.message}
              </pre>
            </details>
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                <RefreshCw size={14} />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
