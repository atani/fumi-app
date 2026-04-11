import { getDb } from "./connection";

/**
 * Split SQL text into individual statements, respecting BEGIN...END blocks
 * (used by triggers). Statements are separated by `;` but `;` inside
 * BEGIN...END pairs are kept together with their enclosing statement.
 */
export function splitStatements(sql: string): string[] {
  const results: string[] = [];
  let current = "";
  let depth = 0;

  for (const raw of sql.split(";")) {
    const trimmed = raw.trim();
    if (!trimmed && depth === 0) continue;

    current += (current ? ";" : "") + raw;

    const upper = trimmed.toUpperCase();
    if (upper.includes("BEGIN")) depth++;
    if (upper.includes("END") && depth > 0) depth--;

    if (depth === 0) {
      const stmt = current.trim();
      if (stmt.length > 0) {
        results.push(stmt);
      }
      current = "";
    }
  }

  const remaining = current.trim();
  if (remaining.length > 0) {
    results.push(remaining);
  }

  return results;
}

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        picture TEXT DEFAULT '',
        provider TEXT NOT NULL DEFAULT 'gmail_api',
        access_token TEXT,
        refresh_token TEXT,
        token_expiry INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS labels (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'system',
        color TEXT,
        PRIMARY KEY (id, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS threads (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        snippet TEXT DEFAULT '',
        subject TEXT DEFAULT '',
        last_message_at TEXT,
        message_count INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 0,
        is_starred INTEGER DEFAULT 0,
        PRIMARY KEY (id, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS thread_labels (
        thread_id TEXT NOT NULL,
        label_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, label_id, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        from_address TEXT,
        from_name TEXT,
        to_addresses TEXT,
        cc_addresses TEXT,
        bcc_addresses TEXT,
        subject TEXT,
        snippet TEXT,
        body_html TEXT,
        body_text TEXT,
        date TEXT,
        is_read INTEGER DEFAULT 0,
        has_attachments INTEGER DEFAULT 0,
        header_message_id TEXT,
        PRIMARY KEY (id, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        subject,
        body_text,
        from_address,
        to_addresses,
        content='messages',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, subject, body_text, from_address, to_addresses)
        VALUES (NEW.rowid, NEW.subject, NEW.body_text, NEW.from_address, NEW.to_addresses);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, subject, body_text, from_address, to_addresses)
        VALUES ('delete', OLD.rowid, OLD.subject, OLD.body_text, OLD.from_address, OLD.to_addresses);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, subject, body_text, from_address, to_addresses)
        VALUES ('delete', OLD.rowid, OLD.subject, OLD.body_text, OLD.from_address, OLD.to_addresses);
        INSERT INTO messages_fts(rowid, subject, body_text, from_address, to_addresses)
        VALUES (NEW.rowid, NEW.subject, NEW.body_text, NEW.from_address, NEW.to_addresses);
      END
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE accounts ADD COLUMN imap_host TEXT;
      ALTER TABLE accounts ADD COLUMN imap_port INTEGER;
      ALTER TABLE accounts ADD COLUMN imap_security TEXT DEFAULT 'ssl';
      ALTER TABLE accounts ADD COLUMN imap_username TEXT;
      ALTER TABLE accounts ADD COLUMN imap_password TEXT;
      ALTER TABLE accounts ADD COLUMN smtp_host TEXT;
      ALTER TABLE accounts ADD COLUMN smtp_port INTEGER;
      ALTER TABLE accounts ADD COLUMN smtp_security TEXT DEFAULT 'ssl';

      ALTER TABLE messages ADD COLUMN imap_uid INTEGER;
      ALTER TABLE messages ADD COLUMN imap_folder TEXT;
      ALTER TABLE messages ADD COLUMN message_id_header TEXT;
      ALTER TABLE messages ADD COLUMN references_header TEXT;
      ALTER TABLE messages ADD COLUMN in_reply_to_header TEXT;

      ALTER TABLE labels ADD COLUMN imap_folder_path TEXT;
      ALTER TABLE labels ADD COLUMN imap_special_use TEXT;
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        filename TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        size INTEGER NOT NULL DEFAULT 0,
        content_id TEXT,
        cached_at TEXT,
        cache_size INTEGER,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_attachments_message
        ON attachments(message_id, account_id);
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS local_drafts (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        mode TEXT,
        to_addresses TEXT,
        cc TEXT,
        bcc TEXT,
        subject TEXT,
        body TEXT,
        reply_to_message_id TEXT,
        in_reply_to TEXT,
        reference_headers TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 6,
    sql: `
      ALTER TABLE threads ADD COLUMN snoozed_until TEXT;
      CREATE INDEX idx_threads_snoozed ON threads(snoozed_until) WHERE snoozed_until IS NOT NULL;
    `,
  },
  {
    version: 7,
    sql: `
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        name TEXT,
        frequency INTEGER DEFAULT 1,
        first_contacted_at TEXT DEFAULT (datetime('now')),
        last_contacted_at TEXT DEFAULT (datetime('now')),
        account_id TEXT,
        UNIQUE(email, account_id)
      );
    `,
  },
  {
    version: 8,
    sql: `
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        name TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS signatures (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 9,
    sql: `
      CREATE TABLE IF NOT EXISTS filter_rules (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        criteria TEXT NOT NULL,
        actions TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `,
  },
];

export async function runMigrations(): Promise<void> {
  const db = await getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = await db.select<{ version: number }[]>(
    "SELECT version FROM _migrations ORDER BY version",
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    const statements = splitStatements(migration.sql);

    for (const statement of statements) {
      await db.execute(statement);
    }

    await db.execute("INSERT INTO _migrations (version) VALUES ($1)", [
      migration.version,
    ]);
  }
}
