"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-danger/30 bg-danger/5 p-6 text-center">
            <div>
              <div className="mb-1 text-sm font-semibold text-danger">Render error</div>
              <div className="text-xs text-muted-foreground">{this.state.message || "An unexpected error occurred in this component."}</div>
              <button
                type="button"
                className="mt-3 rounded-md border border-white/15 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
                onClick={() => this.setState({ hasError: false, message: "" })}
              >
                Retry
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
