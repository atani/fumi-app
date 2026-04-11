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
