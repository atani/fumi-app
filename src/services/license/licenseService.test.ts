import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TRIAL_DAYS,
  trialDaysLeft,
  activateLicense,
  validateStoredLicense,
} from "./licenseService";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("trialDaysLeft", () => {
  it("returns the full trial on day zero", () => {
    const now = 1_000_000_000_000;
    expect(trialDaysLeft(now, now)).toBe(TRIAL_DAYS);
  });

  it("counts down as time passes", () => {
    const start = 1_000_000_000_000;
    expect(trialDaysLeft(start, start + 3 * DAY_MS)).toBe(TRIAL_DAYS - 3);
  });

  it("returns 0 once the trial is over", () => {
    const start = 1_000_000_000_000;
    expect(trialDaysLeft(start, start + (TRIAL_DAYS + 1) * DAY_MS)).toBe(0);
  });

  it("never returns negative", () => {
    const start = 1_000_000_000_000;
    expect(trialDaysLeft(start, start + 999 * DAY_MS)).toBe(0);
  });
});

describe("activateLicense", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an empty key without calling the API", async () => {
    const result = await activateLicense("   ");
    expect(result).toEqual({ ok: false, reason: "invalid_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("succeeds when the server activates the key", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ activated: true, instance: { id: "inst-1" }, meta: {} }),
    });
    const result = await activateLicense("VALID-KEY");
    expect(result.ok).toBe(true);
  });

  it("fails with invalid_key when the server declines", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ activated: false, error: "license_key not found" }),
    });
    const result = await activateLicense("BAD-KEY");
    expect(result).toEqual({ ok: false, reason: "invalid_key" });
  });

  it("reports a network reason when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const result = await activateLicense("ANY-KEY");
    expect(result).toEqual({ ok: false, reason: "network" });
  });
});

describe("validateStoredLicense", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when no license is stored", async () => {
    // In the in-memory test DB no license has been persisted.
    const result = await validateStoredLicense();
    expect(result).toBe(false);
  });
});
