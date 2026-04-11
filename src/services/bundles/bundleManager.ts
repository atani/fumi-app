import { getDb } from "../db/connection";
import type { Account, BundleRule, Thread } from "../../types";

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all enabled bundle rules for a given account.
 */
export async function getBundleRules(
  accountId: string,
): Promise<BundleRule[]> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      sender_pattern: string;
      bundle_name: string;
      schedule: string;
      enabled: number;
    }[]
  >("SELECT * FROM bundle_rules WHERE account_id = $1 AND enabled = 1", [
    accountId,
  ]);

  return rows.map((r) => ({
    id: r.id,
    account_id: r.account_id,
    sender_pattern: r.sender_pattern,
    bundle_name: r.bundle_name,
    schedule: r.schedule as BundleRule["schedule"],
    enabled: r.enabled === 1,
  }));
}

/**
 * Fetch all bundle rules for a given account (including disabled).
 */
export async function getAllBundleRules(
  accountId: string,
): Promise<BundleRule[]> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      sender_pattern: string;
      bundle_name: string;
      schedule: string;
      enabled: number;
    }[]
  >(
    "SELECT * FROM bundle_rules WHERE account_id = $1 ORDER BY bundle_name",
    [accountId],
  );

  return rows.map((r) => ({
    id: r.id,
    account_id: r.account_id,
    sender_pattern: r.sender_pattern,
    bundle_name: r.bundle_name,
    schedule: r.schedule as BundleRule["schedule"],
    enabled: r.enabled === 1,
  }));
}

export async function saveBundleRule(rule: BundleRule): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO bundle_rules (id, account_id, sender_pattern, bundle_name, schedule, enabled)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(id) DO UPDATE SET
       sender_pattern = excluded.sender_pattern,
       bundle_name = excluded.bundle_name,
       schedule = excluded.schedule,
       enabled = excluded.enabled`,
    [
      rule.id,
      rule.account_id,
      rule.sender_pattern,
      rule.bundle_name,
      rule.schedule,
      rule.enabled ? 1 : 0,
    ],
  );
}

export async function deleteBundleRule(ruleId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM bundled_threads WHERE bundle_rule_id = $1", [
    ruleId,
  ]);
  await db.execute("DELETE FROM bundle_rules WHERE id = $1", [ruleId]);
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

/**
 * Check whether a sender email matches any bundle rule's pattern.
 * Patterns support simple glob-style matching:
 *   - `*@example.com` matches any sender from example.com
 *   - `newsletter@*` matches newsletter@ at any domain
 *   - Plain string does case-insensitive substring match
 */
export function matchSenderToBundle(
  senderEmail: string,
  rules: BundleRule[],
): BundleRule | null {
  const lower = senderEmail.toLowerCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const pattern = rule.sender_pattern.toLowerCase();

    if (pattern.includes("*")) {
      // Convert glob pattern to regex: escape regex chars, replace * with .*
      const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      const re = new RegExp(`^${escaped}$`);
      if (re.test(lower)) return rule;
    } else {
      // Plain substring match
      if (lower.includes(pattern)) return rule;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Bundling operations
// ---------------------------------------------------------------------------

/**
 * Add a thread to a bundle and remove the INBOX label so it's hidden
 * until the bundle is delivered.
 */
export async function bundleThread(
  account: Account,
  threadId: string,
  ruleId: string,
): Promise<void> {
  const db = await getDb();

  // Insert into bundled_threads (ignore if already bundled)
  await db.execute(
    `INSERT OR IGNORE INTO bundled_threads (thread_id, account_id, bundle_rule_id, delivered)
     VALUES ($1, $2, $3, 0)`,
    [threadId, account.id, ruleId],
  );

  // Remove INBOX label so the thread is hidden from the main inbox view
  await db.execute(
    "DELETE FROM thread_labels WHERE thread_id = $1 AND account_id = $2 AND label_id = 'INBOX'",
    [threadId, account.id],
  );

  // Add a BUNDLED label for querying
  await db.execute(
    "INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, $2, $3)",
    [threadId, "BUNDLED", account.id],
  );
}

/**
 * Mark bundled threads as delivered and restore their INBOX label.
 */
export async function deliverBundle(
  account: Account,
  ruleId: string,
): Promise<void> {
  const db = await getDb();

  // Get undelivered threads for this bundle
  const rows = await db.select<{ thread_id: string }[]>(
    `SELECT thread_id FROM bundled_threads
     WHERE account_id = $1 AND bundle_rule_id = $2 AND delivered = 0`,
    [account.id, ruleId],
  );

  for (const row of rows) {
    // Restore INBOX label
    await db.execute(
      "INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, $2, $3)",
      [row.thread_id, "INBOX", account.id],
    );

    // Remove BUNDLED label
    await db.execute(
      "DELETE FROM thread_labels WHERE thread_id = $1 AND account_id = $2 AND label_id = 'BUNDLED'",
      [row.thread_id, account.id],
    );
  }

  // Mark all as delivered
  await db.execute(
    `UPDATE bundled_threads SET delivered = 1
     WHERE account_id = $1 AND bundle_rule_id = $2 AND delivered = 0`,
    [account.id, ruleId],
  );
}

/**
 * Get all threads currently in a bundle (undelivered).
 */
export async function getBundledThreads(
  accountId: string,
  ruleId: string,
): Promise<Thread[]> {
  const db = await getDb();
  return db.select<Thread[]>(
    `SELECT t.* FROM threads t
     JOIN bundled_threads bt ON t.id = bt.thread_id AND t.account_id = bt.account_id
     WHERE bt.account_id = $1 AND bt.bundle_rule_id = $2 AND bt.delivered = 0
     ORDER BY t.last_message_at DESC`,
    [accountId, ruleId],
  );
}

// ---------------------------------------------------------------------------
// Schedule checking
// ---------------------------------------------------------------------------

/**
 * Check whether any bundles are due for delivery based on their schedule.
 * - "instant" bundles are delivered immediately (should not normally accumulate)
 * - "daily" bundles deliver once the oldest undelivered item is >= 24h old
 * - "weekly" bundles deliver once the oldest undelivered item is >= 7 days old
 */
export async function checkBundleSchedules(
  account: Account,
): Promise<void> {
  const rules = await getBundleRules(account.id);

  for (const rule of rules) {
    if (rule.schedule === "instant") {
      // Instant bundles should already have been delivered, but deliver any stragglers
      await deliverBundle(account, rule.id);
      continue;
    }

    const db = await getDb();
    const oldest = await db.select<{ bundled_at: string }[]>(
      `SELECT bundled_at FROM bundled_threads
       WHERE account_id = $1 AND bundle_rule_id = $2 AND delivered = 0
       ORDER BY bundled_at ASC LIMIT 1`,
      [account.id, rule.id],
    );

    if (oldest.length === 0) continue;

    const bundledAt = new Date(oldest[0]!.bundled_at).getTime();
    const now = Date.now();
    const hoursSince = (now - bundledAt) / (1000 * 60 * 60);

    const thresholdHours = rule.schedule === "daily" ? 24 : 24 * 7;

    if (hoursSince >= thresholdHours) {
      await deliverBundle(account, rule.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Sync integration
// ---------------------------------------------------------------------------

/**
 * Process new threads against bundle rules during sync.
 * Threads matching a bundle rule get bundled (removed from inbox).
 * Threads matching an "instant" rule are left in inbox (effectively not bundled).
 */
export async function processBundleRules(
  account: Account,
  newThreads: Thread[],
  messages: { thread_id: string; from_address: string | null }[],
): Promise<void> {
  if (newThreads.length === 0) return;

  const rules = await getBundleRules(account.id);
  if (rules.length === 0) return;

  const newThreadIds = new Set(newThreads.map((t) => t.id));

  for (const msg of messages) {
    if (!newThreadIds.has(msg.thread_id)) continue;
    if (!msg.from_address) continue;

    const matchedRule = matchSenderToBundle(msg.from_address, rules);
    if (!matchedRule) continue;

    if (matchedRule.schedule === "instant") {
      // Instant delivery: leave in inbox, no bundling
      continue;
    }

    await bundleThread(account, msg.thread_id, matchedRule.id);
  }
}

/**
 * Get the count of undelivered threads per bundle rule for sidebar display.
 */
export async function getBundleCounts(
  accountId: string,
): Promise<{ ruleId: string; bundleName: string; count: number }[]> {
  const db = await getDb();
  const rows = await db.select<
    { bundle_rule_id: string; bundle_name: string; cnt: number }[]
  >(
    `SELECT bt.bundle_rule_id, br.bundle_name, COUNT(*) as cnt
     FROM bundled_threads bt
     JOIN bundle_rules br ON bt.bundle_rule_id = br.id
     WHERE bt.account_id = $1 AND bt.delivered = 0 AND br.enabled = 1
     GROUP BY bt.bundle_rule_id`,
    [accountId],
  );

  return rows.map((r) => ({
    ruleId: r.bundle_rule_id,
    bundleName: r.bundle_name,
    count: r.cnt,
  }));
}
