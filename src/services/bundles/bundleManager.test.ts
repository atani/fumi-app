import { describe, it, expect, beforeEach, vi } from "vitest";
import { matchSenderToBundle, checkBundleSchedules } from "./bundleManager";
import type { Account, BundleRule } from "../../types";

vi.mock("../db/connection", () => ({
  getDb: vi.fn(),
}));

function makeRule(overrides: Partial<BundleRule> = {}): BundleRule {
  return {
    id: "rule-1",
    account_id: "acc-1",
    sender_pattern: "*@example.com",
    bundle_name: "Example",
    schedule: "daily",
    enabled: true,
    ...overrides,
  };
}

function makeAccount(): Account {
  return {
    id: "acc-1",
    email: "me@example.com",
    name: "Me",
    picture: "",
    provider: "gmail_api",
    access_token: null,
    refresh_token: null,
    token_expiry: null,
  };
}

describe("matchSenderToBundle", () => {
  it("matches a wildcard domain pattern", () => {
    const rules = [makeRule({ sender_pattern: "*@example.com" })];
    expect(matchSenderToBundle("alice@example.com", rules)).toBe(rules[0]);
    expect(matchSenderToBundle("bob@other.com", rules)).toBeNull();
  });

  it("matches a wildcard localpart pattern", () => {
    const rules = [makeRule({ sender_pattern: "newsletter@*" })];
    expect(matchSenderToBundle("newsletter@foo.com", rules)).toBe(rules[0]);
    expect(matchSenderToBundle("news@foo.com", rules)).toBeNull();
  });

  it("is case-insensitive", () => {
    const rules = [makeRule({ sender_pattern: "*@Example.COM" })];
    expect(matchSenderToBundle("ALICE@example.com", rules)).toBe(rules[0]);
  });

  it("falls back to substring match for non-glob patterns", () => {
    const rules = [makeRule({ sender_pattern: "noreply" })];
    expect(matchSenderToBundle("noreply@github.com", rules)).toBe(rules[0]);
    expect(matchSenderToBundle("real-human@github.com", rules)).toBeNull();
  });

  it("skips disabled rules", () => {
    const rules = [
      makeRule({ enabled: false, sender_pattern: "*@example.com" }),
    ];
    expect(matchSenderToBundle("alice@example.com", rules)).toBeNull();
  });

  it("returns the first matching rule when several apply", () => {
    const rules = [
      makeRule({ id: "a", sender_pattern: "*@example.com" }),
      makeRule({ id: "b", sender_pattern: "alice@*" }),
    ];
    expect(matchSenderToBundle("alice@example.com", rules)?.id).toBe("a");
  });
});

describe("checkBundleSchedules", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("delivers daily bundles whose oldest item is >= 24h old", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const oldBundledAt = new Date(
      now.getTime() - 25 * 60 * 60 * 1000,
    ).toISOString();

    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    // Call order inside checkBundleSchedules:
    //  1. getBundleRules SELECT
    //  2. oldest bundled_threads SELECT
    //  3. deliverBundle's SELECT of undelivered thread ids
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          account_id: "acc-1",
          sender_pattern: "*@example.com",
          bundle_name: "Example",
          schedule: "daily",
          enabled: 1,
        },
      ])
      .mockResolvedValueOnce([{ bundled_at: oldBundledAt }])
      .mockResolvedValueOnce([]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    await checkBundleSchedules(makeAccount());

    // deliverBundle runs the final UPDATE marking threads as delivered
    const executedSql = executeMock.mock.calls.map((c) => c[0] as string);
    expect(
      executedSql.some((sql) => sql.includes("UPDATE bundled_threads")),
    ).toBe(true);
  });

  it("does not deliver daily bundles whose oldest item is < 24h old", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const recent = new Date(
      now.getTime() - 5 * 60 * 60 * 1000,
    ).toISOString();

    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 0 });
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          account_id: "acc-1",
          sender_pattern: "*@example.com",
          bundle_name: "Example",
          schedule: "daily",
          enabled: 1,
        },
      ])
      .mockResolvedValueOnce([{ bundled_at: recent }]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    await checkBundleSchedules(makeAccount());

    // No UPDATE / INSERT for delivery should have run
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("holds weekly bundles until the oldest item is >= 7 days old", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const threeDaysAgo = new Date(
      now.getTime() - 3 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 0 });
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "rule-2",
          account_id: "acc-1",
          sender_pattern: "*@example.com",
          bundle_name: "Weekly",
          schedule: "weekly",
          enabled: 1,
        },
      ])
      .mockResolvedValueOnce([{ bundled_at: threeDaysAgo }]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    await checkBundleSchedules(makeAccount());
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("always flushes instant bundles via deliverBundle", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 0 });
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "rule-3",
          account_id: "acc-1",
          sender_pattern: "*@example.com",
          bundle_name: "Instant",
          schedule: "instant",
          enabled: 1,
        },
      ])
      // deliverBundle's own SELECT for undelivered thread ids
      .mockResolvedValueOnce([]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    await checkBundleSchedules(makeAccount());

    // Instant path always calls deliverBundle which issues the UPDATE statement
    const executedSql = executeMock.mock.calls.map((c) => c[0] as string);
    expect(
      executedSql.some((sql) => sql.includes("UPDATE bundled_threads")),
    ).toBe(true);
  });

  it("skips rules that currently have no undelivered threads", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 0 });
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          account_id: "acc-1",
          sender_pattern: "*@example.com",
          bundle_name: "Example",
          schedule: "daily",
          enabled: 1,
        },
      ])
      // oldest lookup returns empty => continue without touching deliverBundle
      .mockResolvedValueOnce([]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    await checkBundleSchedules(makeAccount());
    expect(executeMock).not.toHaveBeenCalled();
  });
});
