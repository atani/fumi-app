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
  {
    version: 10,
    sql: `
      CREATE TABLE IF NOT EXISTS ai_cache (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        account_id TEXT,
        type TEXT,
        result TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS thread_categories (
        thread_id TEXT,
        account_id TEXT,
        category TEXT,
        PRIMARY KEY (thread_id, account_id)
      );
    `,
  },
  {
    version: 11,
    sql: `
      CREATE TABLE IF NOT EXISTS bundle_rules (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        sender_pattern TEXT NOT NULL,
        bundle_name TEXT NOT NULL,
        schedule TEXT DEFAULT 'daily',
        enabled INTEGER DEFAULT 1,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bundled_threads (
        thread_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        bundle_rule_id TEXT NOT NULL,
        bundled_at TEXT DEFAULT (datetime('now')),
        delivered INTEGER DEFAULT 0,
        PRIMARY KEY (thread_id, account_id),
        FOREIGN KEY (bundle_rule_id) REFERENCES bundle_rules(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 12,
    sql: `
      CREATE TABLE IF NOT EXISTS link_scan_results (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        account_id TEXT,
        url TEXT,
        risk_level TEXT,
        reasons TEXT,
        scanned_at TEXT DEFAULT (datetime('now'))
      );

      ALTER TABLE messages ADD COLUMN auth_results TEXT;
    `,
  },
  {
    version: 13,
    sql: `
      CREATE TABLE IF NOT EXISTS pending_operations (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_pending_operations_account_status
        ON pending_operations(account_id, status);
    `,
  },
  {
    version: 14,
    sql: `
      CREATE TABLE IF NOT EXISTS unsubscribe_actions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        method TEXT NOT NULL,
        target TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_unsubscribe_actions_message
        ON unsubscribe_actions(message_id, account_id);

      ALTER TABLE messages ADD COLUMN list_unsubscribe TEXT;
      ALTER TABLE messages ADD COLUMN list_unsubscribe_post TEXT;
    `,
  },
  {
    version: 15,
    sql: `
      CREATE INDEX IF NOT EXISTS idx_thread_categories_account_category
        ON thread_categories(account_id, category);
    `,
  },
  {
    version: 16,
    sql: `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        completed INTEGER NOT NULL DEFAULT 0,
        parent_task_id TEXT,
        source_thread_id TEXT,
        source_message_id TEXT,
        recurrence_rule TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date) WHERE due_date IS NOT NULL;

      CREATE TABLE IF NOT EXISTS task_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        account_id TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 17,
    sql: `
      CREATE TABLE IF NOT EXISTS follow_up_reminders (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        remind_after_hours INTEGER NOT NULL DEFAULT 48,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        reminded_at TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_follow_up_reminders_thread
        ON follow_up_reminders(thread_id, account_id);
    `,
  },
  {
    version: 18,
    sql: `
      ALTER TABLE threads ADD COLUMN is_muted INTEGER DEFAULT 0;

      CREATE TABLE IF NOT EXISTS notification_vips (
        email TEXT NOT NULL,
        account_id TEXT NOT NULL,
        PRIMARY KEY (email, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 19,
    sql: `
      CREATE TABLE IF NOT EXISTS send_as_aliases (
        email TEXT NOT NULL,
        account_id TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        is_default INTEGER DEFAULT 0,
        is_primary INTEGER DEFAULT 0,
        PRIMARY KEY (email, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 20,
    sql: `
      CREATE TABLE IF NOT EXISTS scheduled_emails (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        to_addresses TEXT NOT NULL,
        cc TEXT,
        bcc TEXT,
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        attachments TEXT,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status
        ON scheduled_emails(status, scheduled_at);
    `,
  },
  {
    version: 21,
    sql: `
      CREATE TABLE IF NOT EXISTS smart_folders (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_smart_folders_account
        ON smart_folders(account_id, sort_order);
    `,
  },
  {
    version: 22,
    sql: `
      CREATE TABLE IF NOT EXISTS quick_steps (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        actions TEXT NOT NULL DEFAULT '[]',
        shortcut TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 23,
    sql: `
      CREATE TABLE IF NOT EXISTS image_allowlist (
        sender TEXT NOT NULL,
        account_id TEXT NOT NULL,
        domain TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (sender, account_id)
      );
    `,
  },
  {
    version: 24,
    sql: `
      CREATE TABLE IF NOT EXISTS folder_sync_state (
        folder TEXT NOT NULL,
        account_id TEXT NOT NULL,
        uidvalidity INTEGER,
        last_uid INTEGER,
        modseq INTEGER,
        PRIMARY KEY (folder, account_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 25,
    sql: `
      CREATE TABLE IF NOT EXISTS phishing_allowlist (
        url_or_sender TEXT NOT NULL,
        account_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (url_or_sender, account_id)
      );
    `,
  },
  {
    version: 26,
    sql: `
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        calendar_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        start_time TEXT,
        end_time TEXT,
        description TEXT,
        color TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_calendar_events_account
        ON calendar_events(account_id, calendar_id);

      CREATE INDEX IF NOT EXISTS idx_calendar_events_time
        ON calendar_events(start_time, end_time);
    `,
  },
  {
    version: 27,
    sql: `
      CREATE TABLE IF NOT EXISTS writing_style_profiles (
        account_id TEXT PRIMARY KEY,
        style_summary TEXT NOT NULL DEFAULT '',
        sample_phrases TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 28,
    sql: `
      CREATE TABLE IF NOT EXISTS smart_label_rules (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        label_id TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        criteria TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_smart_label_rules_account
        ON smart_label_rules(account_id, enabled);
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
