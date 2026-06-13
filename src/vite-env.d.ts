/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth client ID embedded at build time for one-click sign-in. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Google OAuth client secret for the "Desktop app" client type (non-confidential). */
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
