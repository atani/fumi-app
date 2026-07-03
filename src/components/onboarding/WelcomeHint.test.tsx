import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const settings = new Map<string, string>();

vi.mock("../../services/db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: async (_sql: string, params: string[]) => {
      const value = settings.get(String(params[0]));
      return value === undefined ? [] : [{ value }];
    },
    execute: async (_sql: string, params: string[]) => {
      settings.set(String(params[0]), "1");
      return { rowsAffected: 1 };
    },
  }),
}));

const { WelcomeHint } = await import("./WelcomeHint");

beforeEach(() => settings.clear());

describe("WelcomeHint", () => {
  it("shows on first run, then dismisses and persists 'seen'", async () => {
    render(<WelcomeHint />);

    await waitFor(() =>
      expect(screen.getByTestId("welcome-hint")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId("welcome-hint-dismiss"));

    await waitFor(() =>
      expect(screen.queryByTestId("welcome-hint")).toBeNull(),
    );
    expect(settings.get("welcome_hint_seen")).toBe("1");
  });

  it("does not show once it has been seen", async () => {
    settings.set("welcome_hint_seen", "1");
    render(<WelcomeHint />);

    // Give the async check a tick to resolve.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("welcome-hint")).toBeNull();
  });
});
