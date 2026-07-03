import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render/lifecycle errors anywhere below it and shows a recoverable
 * fallback instead of a blank white window — a hard requirement for a paid
 * desktop app where an uncaught error would otherwise make the whole app
 * unusable. The error is logged (persisted via the log plugin) for support.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Uncaught UI error:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-4 bg-bg-primary px-8 text-center"
        data-testid="error-boundary"
      >
        <h1 className="text-2xl font-bold text-text-primary">
          {i18n.t("error.title")}
        </h1>
        <p className="max-w-sm text-sm text-text-secondary">
          {i18n.t("error.description")}
        </p>
        <button
          onClick={this.handleReload}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          data-testid="error-boundary-reload"
        >
          {i18n.t("error.reload")}
        </button>
      </div>
    );
  }
}
