import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useAccountStore } from "../../stores/accountStore";
import { useLabelStore } from "../../stores/labelStore";

const mockAddLabelToThread = vi.fn().mockResolvedValue(undefined);
const mockRemoveLabelFromThread = vi.fn().mockResolvedValue(undefined);

vi.mock("../../services/gmail/labels", () => ({
  addLabelToThread: (...args: unknown[]) => mockAddLabelToThread(...args),
  removeLabelFromThread: (...args: unknown[]) => mockRemoveLabelFromThread(...args),
}));

vi.mock("../../services/db/labels", () => ({
  getThreadLabelIds: vi.fn().mockResolvedValue([]),
}));

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
vi.mock("../../services/db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({ execute: (...a: unknown[]) => mockExecute(...a) }),
}));

const { MoveToLabelDialog } = await import("./MoveToLabelDialog");

beforeEach(() => {
  vi.clearAllMocks();
  useAccountStore.setState({
    accounts: [
      {
        id: "acc-1",
        email: "me@example.com",
        name: "Me",
        picture: "",
        provider: "gmail_api",
        access_token: "t",
        refresh_token: "r",
        token_expiry: null,
      },
    ],
    activeAccountId: "acc-1",
    isLoading: false,
  });
  useLabelStore.setState({
    userLabels: [
      { id: "Label_1", account_id: "acc-1", name: "Work", type: "user", color: null },
    ],
  });
});

describe("MoveToLabelDialog bulk mode", () => {
  it("shows the bulk title with the selected count", () => {
    render(
      <MoveToLabelDialog
        isOpen
        onClose={() => {}}
        accountId="acc-1"
        threadIds={["t1", "t2", "t3"]}
      />,
    );
    expect(screen.getByTestId("move-to-label-dialog")).toHaveTextContent("3");
  });

  it("applies the chosen label to every selected thread", async () => {
    const onClose = vi.fn();
    render(
      <MoveToLabelDialog
        isOpen
        onClose={onClose}
        accountId="acc-1"
        threadIds={["t1", "t2"]}
      />,
    );

    fireEvent.click(screen.getByTestId("label-option-Label_1"));
    fireEvent.click(screen.getByTestId("move-to-label-apply"));

    await waitFor(() => expect(mockAddLabelToThread).toHaveBeenCalledTimes(2));
    const targets = mockAddLabelToThread.mock.calls.map((c) => c[1]);
    expect(targets).toEqual(["t1", "t2"]);
    expect(mockAddLabelToThread.mock.calls.every((c) => c[2] === "Label_1")).toBe(true);
    // Bulk mode is add-only — it must not remove labels.
    expect(mockRemoveLabelFromThread).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
