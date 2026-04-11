import { getDb } from "../db/connection";
import {
  markAsRead,
  toggleStar,
  archiveThread,
  trashThread,
} from "../emailActions";
import type {
  Account,
  Message,
  FilterRule,
  FilterCriteria,
  FilterActions,
} from "../../types";

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all enabled filter rules for a given account.
 */
export async function getFilterRules(accountId: string): Promise<FilterRule[]> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      criteria: string;
      actions: string;
      enabled: number;
      created_at: string;
    }[]
  >("SELECT * FROM filter_rules WHERE account_id = $1 AND enabled = 1", [
    accountId,
  ]);

  return rows.map((r) => ({
    id: r.id,
    account_id: r.account_id,
    criteria: JSON.parse(r.criteria) as FilterCriteria,
    actions: JSON.parse(r.actions) as FilterActions,
    enabled: r.enabled === 1,
    created_at: r.created_at,
  }));
}

/**
 * Fetch all filter rules for a given account (including disabled).
 */
export async function getAllFilterRules(
  accountId: string,
): Promise<FilterRule[]> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      criteria: string;
      actions: string;
      enabled: number;
      created_at: string;
    }[]
  >("SELECT * FROM filter_rules WHERE account_id = $1 ORDER BY created_at", [
    accountId,
  ]);

  return rows.map((r) => ({
    id: r.id,
    account_id: r.account_id,
    criteria: JSON.parse(r.criteria) as FilterCriteria,
    actions: JSON.parse(r.actions) as FilterActions,
    enabled: r.enabled === 1,
    created_at: r.created_at,
  }));
}

export async function saveFilterRule(rule: FilterRule): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO filter_rules (id, account_id, criteria, actions, enabled)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET
       criteria = excluded.criteria,
       actions = excluded.actions,
       enabled = excluded.enabled`,
    [
      rule.id,
      rule.account_id,
      JSON.stringify(rule.criteria),
      JSON.stringify(rule.actions),
      rule.enabled ? 1 : 0,
    ],
  );
}

export async function deleteFilterRule(ruleId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM filter_rules WHERE id = $1", [ruleId]);
}

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

/**
 * Check whether a message matches the given filter criteria.
 * All specified criteria must match (AND logic). String comparisons are
 * case-insensitive substring matches.
 */
export function matchesCriteria(
  message: Message,
  criteria: FilterCriteria,
): boolean {
  if (criteria.from !== undefined && criteria.from !== "") {
    const from = (message.from_address ?? "").toLowerCase();
    const fromName = (message.from_name ?? "").toLowerCase();
    const needle = criteria.from.toLowerCase();
    if (!from.includes(needle) && !fromName.includes(needle)) {
      return false;
    }
  }

  if (criteria.to !== undefined && criteria.to !== "") {
    const to = (message.to_addresses ?? "").toLowerCase();
    if (!to.includes(criteria.to.toLowerCase())) {
      return false;
    }
  }

  if (criteria.subject !== undefined && criteria.subject !== "") {
    const subject = (message.subject ?? "").toLowerCase();
    if (!subject.includes(criteria.subject.toLowerCase())) {
      return false;
    }
  }

  if (criteria.hasAttachment === true) {
    if (!message.has_attachments) {
      return false;
    }
  }

  return true;
}

/**
 * Merge multiple FilterActions into one. Later values override earlier ones
 * for boolean flags; applyLabel is taken from the first rule that sets it.
 */
export function mergeActions(actionsList: FilterActions[]): FilterActions {
  const merged: FilterActions = {};
  for (const actions of actionsList) {
    if (actions.applyLabel && !merged.applyLabel) {
      merged.applyLabel = actions.applyLabel;
    }
    if (actions.archive) merged.archive = true;
    if (actions.trash) merged.trash = true;
    if (actions.star) merged.star = true;
    if (actions.markRead) merged.markRead = true;
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

/**
 * Execute the merged filter actions on a thread.
 * Uses the existing emailActions helpers for Gmail API + local DB updates.
 */
export async function applyFilterActions(
  account: Account,
  threadId: string,
  actions: FilterActions,
): Promise<void> {
  const promises: Promise<void>[] = [];

  if (actions.applyLabel) {
    // Add label via local DB (the Gmail label association will sync on next pull)
    const db = await getDb();
    promises.push(
      db
        .execute(
          "INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, $2, $3)",
          [threadId, actions.applyLabel, account.id],
        )
        .then(() => undefined),
    );
  }

  if (actions.markRead) {
    promises.push(markAsRead(account, threadId));
  }

  if (actions.star) {
    promises.push(toggleStar(account, threadId, false));
  }

  if (actions.trash) {
    promises.push(trashThread(account, threadId));
  } else if (actions.archive) {
    promises.push(archiveThread(account, threadId));
  }

  await Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Main entry point — run during sync
// ---------------------------------------------------------------------------

/**
 * Process all enabled filter rules against newly synced messages.
 * Groups messages by thread, merges matching actions, and applies them.
 */
export async function processFilters(
  account: Account,
  messages: Message[],
): Promise<void> {
  if (messages.length === 0) return;

  const rules = await getFilterRules(account.id);
  if (rules.length === 0) return;

  // Group matched actions by threadId
  const threadActions = new Map<string, FilterActions[]>();

  for (const message of messages) {
    for (const rule of rules) {
      if (matchesCriteria(message, rule.criteria)) {
        const existing = threadActions.get(message.thread_id) ?? [];
        existing.push(rule.actions);
        threadActions.set(message.thread_id, existing);
      }
    }
  }

  // Apply merged actions per thread
  for (const [threadId, actionsList] of threadActions) {
    const merged = mergeActions(actionsList);
    await applyFilterActions(account, threadId, merged);
  }
}
