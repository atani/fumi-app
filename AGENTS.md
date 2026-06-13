# AGENTS.md

## Commands

```bash
# Development - starts Tauri app with Vite dev server (port 1420)
npm run tauri dev

# Vite dev server only (no Tauri)
npm run dev

# Build production app
npm run tauri build

# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# TypeScript type check
npm run typecheck

# Run E2E tests (headless)
npm run e2e

# Rust backend only (from src-tauri/)
cargo check
cargo build
```

## Architecture

Tauri v2 desktop app: Rust backend + React 19 frontend via Tauri IPC.

### Three-layer data flow

1. **Rust backend** (`src-tauri/`): OAuth localhost server (PKCE, ports 17248-17251), code verifier/challenge generation. Plugins: sql (SQLite), http, notification, log, opener.

2. **Service layer** (`src/services/`):
   - `db/` — SQLite via `getDb()` singleton. Falls back to in-memory DB in non-Tauri environments. Migrations in `migrations.ts`.
   - `gmail/auth.ts` — OAuth PKCE flow, token exchange, refresh, user info fetch. Tauri API imports are lazy-loaded.
   - `gmail/api.ts` — Gmail API wrapper: threads, messages, labels, body decoding.
   - `gmail/sync.ts` — Inbox sync: fetches threads, parses messages, stores to SQLite.

3. **UI layer** (`src/components/`, `src/stores/`):
   - Three Zustand stores: `accountStore`, `threadStore`, `uiStore`
   - Components: `auth/LoginPage`, `layout/{MailLayout, Sidebar, ThreadList, ReadingPane}`

### Key patterns

- Tauri API imports are dynamic (`await import(...)`) to support browser-only mode for testing
- `getDb()` returns a `MemoryDb` fallback when not running in Tauri
- Gmail OAuth uses PKCE (no client secret), localhost callback server in Rust

## Database

SQLite via Tauri SQL plugin. Tables: `accounts`, `labels`, `threads`, `thread_labels`, `messages`, `settings`, `_migrations`.

## Styling

Tailwind CSS v4. Semantic color tokens: `bg-bg-primary`, `text-text-primary`, `border-border-primary`, `bg-accent`, etc. Dark mode via `.dark` class.

## Testing

- **Unit**: Vitest + jsdom. Tests colocated with source.
- **E2E**: Playwright against Vite dev server. Tests in `tests/e2e/`.

## Key Gotchas

- **Tauri SQL plugin**: `preload` in tauri.conf.json must be array `["sqlite:fumi.db"]`
- **OAuth ports**: Tries 17248-17251 sequentially
- **Browser mode**: When `__TAURI__` is not on window, DB falls back to in-memory, OAuth throws
- **CSP**: Allows googleapis.com for Gmail API + OAuth
- **TypeScript**: strict mode with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- **Path alias**: `@/*` maps to `src/*`
