import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockGetAccount = vi.fn();

vi.mock("../db/accounts", () => ({
  getAccount: (...args: unknown[]) => mockGetAccount(...args),
}));

const mockGetDueScheduledEmails = vi.fn();
const mockUpdateScheduledEmailStatus = vi.fn();
const mockClaimScheduledEmail = vi.fn();

vi.mock("../db/scheduledEmails", () => ({
  getDueScheduledEmails: () => mockGetDueScheduledEmails(),
  updateScheduledEmailStatus: (...args: unknown[]) =>
    mockUpdateScheduledEmailStatus(...args),
  claimScheduledEmail: (...args: unknown[]) => mockClaimScheduledEmail(...args),
}));

const mockSendEmail = vi.fn();

vi.mock("../gmail/send", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const { startScheduledSendChecker, stopScheduledSendChecker } = await import(
  "./scheduledSendChecker"
);

function makeAccount() {
  return {
    id: "acc-1",
    email: "test@example.com",
    name: "Test",
    picture: "",
    provider: "gmail_api" as const,
    access_token: "token",
    refresh_token: "refresh",
    token_expiry: null,
  };
}

describe("scheduledSendChecker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetDueScheduledEmails.mockResolvedValue([]);
    mockUpdateScheduledEmailStatus.mockResolvedValue(undefined);
    // Default: the row is successfully claimed for sending.
    mockClaimScheduledEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    stopScheduledSendChecker();
    vi.useRealTimers();
  });

  it("sends due emails and marks them as sent", async () => {
    const account = makeAccount();
    mockGetDueScheduledEmails.mockResolvedValue([
      {
        id: "se-1",
        account_id: "acc-1",
        to_addresses: "recipient@example.com",
        cc: null,
        bcc: null,
        subject: "Scheduled Subject",
        body: "<p>Hello</p>",
        attachments: null,
        scheduled_at: "2024-01-01T09:00:00Z",
        status: "pending",
        error: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
    mockGetAccount.mockResolvedValue(account);
    mockSendEmail.mockResolvedValue(undefined);

    startScheduledSendChecker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockSendEmail).toHaveBeenCalledWith(account, {
      to: "recipient@example.com",
      cc: undefined,
      bcc: undefined,
      subject: "Scheduled Subject",
      body: "<p>Hello</p>",
      attachments: undefined,
    });
    expect(mockUpdateScheduledEmailStatus).toHaveBeenCalledWith("se-1", "sent");
  });

  it("marks email as failed when account is not found", async () => {
    mockGetDueScheduledEmails.mockResolvedValue([
      {
        id: "se-2",
        account_id: "missing-acc",
        to_addresses: "x@example.com",
        cc: null,
        bcc: null,
        subject: "Test",
        body: "body",
        attachments: null,
        scheduled_at: "2024-01-01T09:00:00Z",
        status: "pending",
        error: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
    mockGetAccount.mockResolvedValue(null);

    startScheduledSendChecker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateScheduledEmailStatus).toHaveBeenCalledWith(
      "se-2",
      "failed",
      "Account not found",
    );
  });

  it("marks email as failed when send throws", async () => {
    const account = makeAccount();
    mockGetDueScheduledEmails.mockResolvedValue([
      {
        id: "se-3",
        account_id: "acc-1",
        to_addresses: "y@example.com",
        cc: null,
        bcc: null,
        subject: "Fail",
        body: "body",
        attachments: null,
        scheduled_at: "2024-01-01T09:00:00Z",
        status: "pending",
        error: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
    mockGetAccount.mockResolvedValue(account);
    mockSendEmail.mockRejectedValue(new Error("SMTP timeout"));

    startScheduledSendChecker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockUpdateScheduledEmailStatus).toHaveBeenCalledWith(
      "se-3",
      "failed",
      "SMTP timeout",
    );
  });

  it("parses JSON attachments when present", async () => {
    const account = makeAccount();
    const attachments = [
      { name: "file.pdf", data: "base64data", mimeType: "application/pdf" },
    ];
    mockGetDueScheduledEmails.mockResolvedValue([
      {
        id: "se-4",
        account_id: "acc-1",
        to_addresses: "z@example.com",
        cc: "cc@example.com",
        bcc: null,
        subject: "With attachment",
        body: "body",
        attachments: JSON.stringify(attachments),
        scheduled_at: "2024-01-01T09:00:00Z",
        status: "pending",
        error: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
    mockGetAccount.mockResolvedValue(account);
    mockSendEmail.mockResolvedValue(undefined);

    startScheduledSendChecker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockSendEmail).toHaveBeenCalledWith(account, {
      to: "z@example.com",
      cc: "cc@example.com",
      bcc: undefined,
      subject: "With attachment",
      body: "body",
      attachments,
    });
    expect(mockUpdateScheduledEmailStatus).toHaveBeenCalledWith("se-4", "sent");
  });

  it("does nothing when no emails are due", async () => {
    mockGetDueScheduledEmails.mockResolvedValue([]);

    startScheduledSendChecker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockGetAccount).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateScheduledEmailStatus).not.toHaveBeenCalled();
  });

  it("does not send when the row is already claimed (double-send guard)", async () => {
    mockGetDueScheduledEmails.mockResolvedValue([
      {
        id: "se-dup",
        account_id: "acc-1",
        to_addresses: "d@example.com",
        cc: null,
        bcc: null,
        subject: "Dup",
        body: "body",
        attachments: null,
        scheduled_at: "2024-01-01T09:00:00Z",
        status: "pending",
        error: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
    // Another run already claimed this row.
    mockClaimScheduledEmail.mockResolvedValue(false);

    startScheduledSendChecker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockGetAccount).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("marks failed on malformed attachments instead of sending without them", async () => {
    const account = makeAccount();
    mockGetDueScheduledEmails.mockResolvedValue([
      {
        id: "se-bad",
        account_id: "acc-1",
        to_addresses: "b@example.com",
        cc: null,
        bcc: null,
        subject: "Bad attachment",
        body: "body",
        attachments: "{not valid json",
        scheduled_at: "2024-01-01T09:00:00Z",
        status: "pending",
        error: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
    mockGetAccount.mockResolvedValue(account);

    startScheduledSendChecker();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateScheduledEmailStatus).toHaveBeenCalledWith(
      "se-bad",
      "failed",
      "Malformed attachment data",
    );
  });
});
