import { create } from "zustand";
import {
  activateLicense,
  deactivateLicense,
  getStoredLicense,
  getTrialStart,
  trialDaysLeft,
  validateStoredLicense,
  type ActivateResult,
} from "../services/license/licenseService";

export type LicenseStatus = "loading" | "licensed" | "trial" | "expired";

interface LicenseState {
  status: LicenseStatus;
  trialDaysLeft: number;
  licenseKey: string | null;
  /** Initialize on app start: validate any stored license, else compute trial. */
  init: () => Promise<void>;
  /** Activate a key; returns the result so the UI can show a reason on failure. */
  activate: (key: string) => Promise<ActivateResult>;
  /** Remove the license from this install and fall back to trial/expired. */
  deactivate: () => Promise<void>;
}

async function computeTrialState(): Promise<{ status: LicenseStatus; trialDaysLeft: number }> {
  const start = await getTrialStart();
  const left = trialDaysLeft(start);
  return { status: left > 0 ? "trial" : "expired", trialDaysLeft: left };
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: "loading",
  trialDaysLeft: 0,
  licenseKey: null,

  init: async () => {
    const licensed = await validateStoredLicense();
    if (licensed) {
      const stored = await getStoredLicense();
      set({ status: "licensed", licenseKey: stored?.key ?? null, trialDaysLeft: 0 });
      return;
    }
    const trial = await computeTrialState();
    set({ ...trial, licenseKey: null });
  },

  activate: async (key: string) => {
    const result = await activateLicense(key);
    if (result.ok) {
      const stored = await getStoredLicense();
      set({ status: "licensed", licenseKey: stored?.key ?? null, trialDaysLeft: 0 });
    }
    return result;
  },

  deactivate: async () => {
    await deactivateLicense();
    const trial = await computeTrialState();
    set({ ...trial, licenseKey: null });
  },
}));
