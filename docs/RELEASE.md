# Release runbook — shipping Fumi to your first 100 users

Everything in the codebase is ready. What remains is account-side setup that only
you can do (your Google, Lemon Squeezy, and Apple accounts). This runbook is the
exact checklist. Do steps 1–3 to start selling; step 4 is signing; step 5 cuts the
build; step 6 (auto-update) is optional for launch.

Each external value becomes a **GitHub Actions secret** (Repo → Settings → Secrets
and variables → Actions) that `.github/workflows/release.yml` injects at build time.

---

## 1. Google OAuth — one-click sign-in (≤100 users, unverified)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project.
2. Enable **Gmail API** and **Google Calendar API**.
3. OAuth consent screen → User type **External**. Fill app name, support email, your
   homepage (the published `landing/` page), and the privacy policy + terms URLs
   (from `docs/legal/`, hosted publicly).
4. Add scopes: `gmail.modify`, `gmail.compose`, `gmail.send`, `calendar`,
   `userinfo.email`, `userinfo.profile`.
5. **Publish the app to "In production"** (do NOT leave it in "Testing" — Testing
   expires refresh tokens after 7 days). Unverified + Production = stable tokens,
   capped at 100 new user grants until you pass CASA.
6. Credentials → Create OAuth client ID → type **Desktop app**. Copy the client ID
   and secret.
7. Secrets: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_SECRET`.

> Users will see a "Google hasn't verified this app" screen (Advanced → Continue).
> The login screen already explains this. Pursue CASA (see `docs/GO-TO-MARKET.md`
> Phase 1.5) only when you approach 100 users.

## 2. Lemon Squeezy — payments + license keys

1. Create a [Lemon Squeezy](https://www.lemonsqueezy.com/) account and a Store.
2. Create a **Product** priced as a one-time purchase ($39 suggested) with
   **License keys enabled** (single activation, or a small activation limit).
3. Note the **Store ID** and **Product ID** (Settings / product URL).
4. Secrets: `VITE_LEMONSQUEEZY_STORE_ID`, `VITE_LEMONSQUEEZY_PRODUCT_ID`, and
   `VITE_BUY_URL` (your product checkout/landing URL).

The app already calls the Lemon Squeezy License API to activate/validate/deactivate.
Once these are set, the purchase → key → in-app activation flow works end to end.

## 3. Publish the landing page + legal docs

1. Fill the `[…]` placeholders in `docs/legal/*.md` (entity name, contact,
   jurisdiction) and `landing/index.html` (Buy/Download links, screenshot, contact).
2. Host them on your domain. The privacy policy and homepage URLs are required by
   step 1.3.

## 4. Code signing (distribution requirement)

Without signing, macOS Gatekeeper blocks the app and Windows shows SmartScreen.

**macOS** (Apple Developer Program, ~$99/yr — in progress):
- Export your **Developer ID Application** certificate as a base64 `.p12`.
- Secrets: `APPLE_CERTIFICATE` (base64 .p12), `APPLE_CERTIFICATE_PASSWORD`,
  `APPLE_SIGNING_IDENTITY` (e.g. `Developer ID Application: Name (TEAMID)`),
  `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password), `APPLE_TEAM_ID`.
- The macOS bundle config (`tauri.conf.json` → `bundle.macOS`) and
  `entitlements.plist` are already in place; `release.yml` signs + notarizes when
  these secrets exist.

**Windows** (optional for an initial macOS-first launch): obtain a code-signing
certificate and wire it into `release.yml` (e.g. via `signtool`).

## 5. Cut a release

```bash
# bump version in package.json and src-tauri/tauri.conf.json, then:
git tag v0.1.0
git push origin v0.1.0
```

`release.yml` builds macOS (universal), Windows, and Linux, signs/notarizes when
secrets are present, and creates a **draft** GitHub Release. Review and publish it.

## 6. Auto-update (optional, after launch)

Not yet enabled — it needs an updater signing keypair.

1. `npm run tauri signer generate` → save the private key as the
   `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`) secrets (already referenced by
   `release.yml`).
2. Add `@tauri-apps/plugin-updater` (JS) and `tauri-plugin-updater` (Cargo).
3. In `tauri.conf.json` add `plugins.updater` with `endpoints` (your
   `latest.json`, e.g. served from GitHub Releases) and the generated **public
   key**.
4. Wire an "update available" check in the app.

---

## Secrets checklist

| Secret | Step |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_SECRET` | 1 |
| `VITE_LEMONSQUEEZY_STORE_ID` / `VITE_LEMONSQUEEZY_PRODUCT_ID` / `VITE_BUY_URL` | 2 |
| `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY` | 4 |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | 4 |
| `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 6 |
