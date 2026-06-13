/**
 * Google OAuth credential resolution.
 *
 * Distributed builds embed a single verified OAuth client at build time via
 * `VITE_GOOGLE_CLIENT_ID` (and, for the "Desktop app" client type, the
 * non-confidential `VITE_GOOGLE_CLIENT_SECRET`). When embedded credentials are
 * present, end users sign in with one click and never see Google Cloud
 * configuration. When they are absent (e.g. a from-source build before the app
 * is verified), the login screen falls back to manual entry stored in the
 * `settings` table.
 *
 * Per Google's OAuth policy, the client secret of an installed/desktop app is
 * "not treated as a secret", so shipping it in the binary is expected.
 */

const RAW_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
const RAW_CLIENT_SECRET = (import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "").trim();

/** The OAuth client ID baked into this build, or null if none was provided. */
export const EMBEDDED_CLIENT_ID: string | null = RAW_CLIENT_ID || null;

/** The OAuth client secret baked into this build, or null if none was provided. */
export const EMBEDDED_CLIENT_SECRET: string | null = RAW_CLIENT_SECRET || null;

/**
 * Whether this build ships with its own OAuth client. When true, the login UI
 * shows a single "Sign in with Google" button and hides manual credential entry.
 */
export function hasEmbeddedCredentials(): boolean {
  return EMBEDDED_CLIENT_ID !== null;
}
