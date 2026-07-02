import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the service so the store's status state machine is tested in isolation —
// this mapping is the single thing that decides whether the paywall appears.
const mockValidate = vi.fn();
const mockGetStored = vi.fn();
const mockGetTrialStart = vi.fn();
const mockTrialDaysLeft = vi.fn();
const mockActivate = vi.fn();
const mockDeactivate = vi.fn();

vi.mock("../services/license/licenseService", () => ({
  validateStoredLicense: () => mockValidate(),
  getStoredLicense: () => mockGetStored(),
  getTrialStart: () => mockGetTrialStart(),
  trialDaysLeft: (start: number) => mockTrialDaysLeft(start),
  activateLicense: (key: string) => mockActivate(key),
  deactivateLicense: () => mockDeactivate(),
}));

const { useLicenseStore } = await import("./licenseStore");

beforeEach(() => {
  vi.clearAllMocks();
  useLicenseStore.setState({ status: "loading", trialDaysLeft: 0, licenseKey: null });
  mockGetTrialStart.mockResolvedValue(1000);
});

describe("licenseStore.init", () => {
  it("becomes 'licensed' when a stored license validates", async () => {
    mockValidate.mockResolvedValue(true);
    mockGetStored.mockResolvedValue({ key: "PAID-KEY", instanceId: "i1" });

    await useLicenseStore.getState().init();

    const s = useLicenseStore.getState();
    expect(s.status).toBe("licensed");
    expect(s.licenseKey).toBe("PAID-KEY");
    expect(s.trialDaysLeft).toBe(0);
    // A paying customer must never trigger the trial computation.
    expect(mockGetTrialStart).not.toHaveBeenCalled();
  });

  it("becomes 'trial' with days left when unlicensed and within the trial", async () => {
    mockValidate.mockResolvedValue(false);
    mockTrialDaysLeft.mockReturnValue(5);

    await useLicenseStore.getState().init();

    const s = useLicenseStore.getState();
    expect(s.status).toBe("trial");
    expect(s.trialDaysLeft).toBe(5);
    expect(s.licenseKey).toBeNull();
  });

  it("becomes 'expired' when unlicensed and the trial is over (day 0)", async () => {
    mockValidate.mockResolvedValue(false);
    mockTrialDaysLeft.mockReturnValue(0);

    await useLicenseStore.getState().init();

    expect(useLicenseStore.getState().status).toBe("expired");
  });
});

describe("licenseStore.activate", () => {
  it("flips to 'licensed' on success", async () => {
    mockActivate.mockResolvedValue({ ok: true });
    mockGetStored.mockResolvedValue({ key: "NEW-KEY", instanceId: "i2" });

    const result = await useLicenseStore.getState().activate("NEW-KEY");

    expect(result.ok).toBe(true);
    const s = useLicenseStore.getState();
    expect(s.status).toBe("licensed");
    expect(s.licenseKey).toBe("NEW-KEY");
  });

  it("leaves state unchanged and returns the reason on failure", async () => {
    useLicenseStore.setState({ status: "trial", trialDaysLeft: 3, licenseKey: null });
    mockActivate.mockResolvedValue({ ok: false, reason: "invalid_key" });

    const result = await useLicenseStore.getState().activate("BAD");

    expect(result).toEqual({ ok: false, reason: "invalid_key" });
    const s = useLicenseStore.getState();
    expect(s.status).toBe("trial");
    expect(s.trialDaysLeft).toBe(3);
  });
});

describe("licenseStore.deactivate", () => {
  it("falls back to the trial/expired state", async () => {
    useLicenseStore.setState({ status: "licensed", trialDaysLeft: 0, licenseKey: "K" });
    mockDeactivate.mockResolvedValue(undefined);
    mockTrialDaysLeft.mockReturnValue(0);

    await useLicenseStore.getState().deactivate();

    const s = useLicenseStore.getState();
    expect(s.status).toBe("expired");
    expect(s.licenseKey).toBeNull();
  });
});
