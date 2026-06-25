# Fumi

A fast, local-first desktop email client for Gmail and IMAP — built with Tauri v2, React 19, and TypeScript. Your mail stays on your device. English and 日本語 included.

## Features

- **Gmail & IMAP** with one-click sign-in (embedded OAuth client)
- **Keyboard-first**: command palette and customizable shortcuts
- **Organize**: labels, smart folders, bundles, filters, snooze, follow-up reminders
- **Compose**: templates, signatures, scheduled send, undo send
- **Optional AI** (bring your own key — Anthropic / OpenAI / Google): summaries, smart replies, "Ask Inbox", task extraction
- **Tasks & calendar** alongside your inbox
- **Local-first & private**: data stored in a local SQLite database; no servers we operate, no telemetry

## Development

```bash
npm install
npm run tauri dev      # Tauri app + Vite dev server (port 1420)
npm run dev            # Vite only (browser-only mode, in-memory DB)
```

### Quality gates

```bash
npm run typecheck      # tsc --noEmit (strict)
npm run test           # Vitest unit tests
npm run e2e            # Playwright E2E
npm run tauri build    # production bundles
```

## Configuration (build-time)

Copy `.env.example` to `.env` and fill in the values for a distributable build. All are optional — without them the app falls back to manual OAuth entry and licensing skips product verification.

| Variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_SECRET` | Embedded Google OAuth client (Desktop app type) for one-click sign-in |
| `VITE_LEMONSQUEEZY_STORE_ID` / `VITE_LEMONSQUEEZY_PRODUCT_ID` | Verify a license key belongs to this product |
| `VITE_BUY_URL` | Checkout/landing URL opened by in-app "Buy" buttons |

## Architecture

Tauri v2: Rust backend + React frontend over IPC.

- **Rust** (`src-tauri/`): OAuth localhost callback server (PKCE), code verifier/challenge. Plugins: sql (SQLite), http, notification, log, opener.
- **Services** (`src/services/`): `db/` (SQLite via `getDb()`, in-memory fallback off-Tauri), `gmail/` (auth, API, sync), `license/` (Lemon Squeezy activation + trial), `ai/` (BYO-key providers).
- **UI** (`src/components/`, `src/stores/`): Zustand stores; i18n via react-i18next (`src/i18n/`).

See `AGENTS.md` for the full architecture notes and gotchas.

## Selling & releasing

- **Go-to-market plan**: [`docs/GO-TO-MARKET.md`](docs/GO-TO-MARKET.md)
- **Release runbook** (signing, accounts, tagging): [`docs/RELEASE.md`](docs/RELEASE.md)
- **Legal drafts**: [`docs/legal/`](docs/legal/)
- **Landing page draft**: [`landing/index.html`](landing/index.html)

## License

See [LICENSE](LICENSE).
