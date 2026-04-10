import { getDb } from "./connection";

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

    const statements = migration.sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await db.execute(statement);
    }

    await db.execute("INSERT INTO _migrations (version) VALUES ($1)", [
      migration.version,
    ]);
  }
}
