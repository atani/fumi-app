import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkConfirmDialog } from "./LinkConfirmDialog";

const noop = () => {};

describe("LinkConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <LinkConfirmDialog
        isOpen={false}
        url="https://example.com"
        displayText="example.com"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByTestId("link-confirm-dialog")).toBeNull();
  });

  it("warns when the shown domain differs from the real destination (phishing)", () => {
    render(
      <LinkConfirmDialog
        isOpen
        url="https://evil.example.com/login"
        displayText="paypal.com"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId("link-mismatch-warning")).toBeInTheDocument();
    expect(screen.getByTestId("link-confirm-url")).toHaveTextContent(
      "https://evil.example.com/login",
    );
  });

  it("does not warn when the shown domain matches the destination", () => {
    render(
      <LinkConfirmDialog
        isOpen
        url="https://paypal.com/account"
        displayText="paypal.com"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByTestId("link-mismatch-warning")).toBeNull();
  });

  it("calls onConfirm when the open button is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <LinkConfirmDialog
        isOpen
        url="https://example.com"
        displayText={null}
        onConfirm={onConfirm}
        onCancel={noop}
      />,
    );
    screen.getByTestId("link-confirm-open").click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
