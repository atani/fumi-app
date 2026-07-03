import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs the caught error; silence it to keep test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">ok</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary")).toBeNull();
  });

  it("shows a recoverable fallback instead of crashing when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("error-boundary-reload")).toBeInTheDocument();
  });
});
