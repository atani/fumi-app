import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AiNotConfiguredError } from "../../services/ai/errors";

const mockSummarize = vi.fn();
vi.mock("../../services/ai/aiService", () => ({
  summarizeThread: (...args: unknown[]) => mockSummarize(...args),
}));

const { ThreadSummary } = await import("./ThreadSummary");

function renderSummary() {
  return render(
    <MemoryRouter>
      <ThreadSummary messages={[]} threadId="t1" accountId="a1" />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("ThreadSummary AI-not-configured handling", () => {
  it("shows the AI setup prompt (not a raw error) when AI is unconfigured", async () => {
    mockSummarize.mockRejectedValue(new AiNotConfiguredError());
    renderSummary();

    fireEvent.click(screen.getByTestId("summarize-btn"));

    await waitFor(() =>
      expect(screen.getByTestId("ai-setup-prompt")).toBeInTheDocument(),
    );
  });

  it("shows a generic error for other failures", async () => {
    mockSummarize.mockRejectedValue(new Error("network boom"));
    renderSummary();

    fireEvent.click(screen.getByTestId("summarize-btn"));

    await waitFor(() => expect(screen.getByText("network boom")).toBeInTheDocument());
    expect(screen.queryByTestId("ai-setup-prompt")).toBeNull();
  });
});
