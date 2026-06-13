/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth client ID embedded at build time for one-click sign-in. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Google OAuth client secret for the "Desktop app" client type (non-confidential). */
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
  /** Lemon Squeezy store ID — when set, license activation verifies the key belongs to this store. */
  readonly VITE_LEMONSQUEEZY_STORE_ID?: string;
  /** Lemon Squeezy product ID — when set, license activation verifies the key belongs to this product. */
  readonly VITE_LEMONSQUEEZY_PRODUCT_ID?: string;
  /** Public URL where the app can be purchased (used by Buy buttons). */
  readonly VITE_BUY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
