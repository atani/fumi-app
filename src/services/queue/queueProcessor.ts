import { getDb } from "../db/connection";
import { authenticatedFetch } from "../gmail/api";
import type { Account } from "../../types";
import { useAccountStore } from "../../stores/accountStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingOperation {
  id: string;
  account_id: string;
  operation: string;
  payload: string;
  status: string;
  retry_count: number;
  next_retry_at: string | null;
  error: string | null;
  created_at: string;
}

// Backoff schedule in seconds: 60s, 300s (5min), 900s (15min), 3600s (1hr)
const BACKOFF_SCHEDULE = [60, 300, 900, 3600];
const MAX_RETRIES = BACKOFF_SCHEDULE.length;

let processorInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

export async function enqueueOperation(
  accountId: string,
  operation: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO pending_operations (id, account_id, operation, payload, status, retry_count, created_at)
     VALUES ($1, $2, $3, $4, 'pending', 0, datetime('now'))`,
    [id, accountId, operation, JSON.stringify(payload)],
  );
  return id;
}

// ---------------------------------------------------------------------------
// Compact — merge redundant ops on the same thread
// ---------------------------------------------------------------------------

export async function compactQueue(accountId: string): Promise<void> {
  const db = await getDb();
  const ops = await db.select<PendingOperation[]>(
    `SELECT * FROM pending_operations
     WHERE account_id = $1 AND status = 'pending'
     ORDER BY created_at ASC`,
    [accountId],
  );

  // Group by operation + thread_id
  const groups = new Map<string, PendingOperation[]>();
  for (const op of ops) {
    let threadId: string | undefined;
    try {
      const parsed = JSON.parse(op.payload) as Record<string, unknown>;
      threadId = parsed["threadId"] as string | undefined;
    } catch {
      continue;
    }
    if (!threadId) continue;

    const key = `${op.operation}:${threadId}`;
    const group = groups.get(key);
    if (group) {
      group.push(op);
    } else {
      groups.set(key, [op]);
    }
  }

  // For each group with more than one op, keep only the latest and delete the rest
  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    // Keep the last (most recent) op
    const toDelete = group.slice(0, -1);
    for (const op of toDelete) {
      await db.execute("DELETE FROM pending_operations WHERE id = $1", [op.id]);
    }
  }
}

// ---------------------------------------------------------------------------
// Execute a single operation
// ---------------------------------------------------------------------------

async function executeOperation(
  op: PendingOperation,
  account: Account,
): Promise<void> {
  const payload = JSON.parse(op.payload) as Record<string, unknown>;

  switch (op.operation) {
    case "modifyLabels": {
      const threadId = payload["threadId"] as string;
      const addLabelIds = (payload["addLabelIds"] as string[] | undefined) ?? [];
      const removeLabelIds = (payload["removeLabelIds"] as string[] | undefined) ?? [];
      await authenticatedFetch(account, `/threads/${threadId}/modify`, {
        method: "POST",
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      });
      break;
    }
    default:
      throw new Error(`Unknown operation: ${op.operation}`);
  }
}

// ---------------------------------------------------------------------------
// Process queue
// ---------------------------------------------------------------------------

export async function processQueue(accountId?: string): Promise<void> {
  const db = await getDb();

  const now = new Date().toISOString();

  let ops: PendingOperation[];
  if (accountId) {
    await compactQueue(accountId);
    ops = await db.select<PendingOperation[]>(
      `SELECT * FROM pending_operations
       WHERE account_id = $1 AND status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= $2)
       ORDER BY created_at ASC`,
      [accountId, now],
    );
  } else {
    // Process all accounts
    const accountIds = await db.select<{ account_id: string }[]>(
      "SELECT DISTINCT account_id FROM pending_operations WHERE status = 'pending'",
    );
    for (const row of accountIds) {
      await compactQueue(row.account_id);
    }
    ops = await db.select<PendingOperation[]>(
      `SELECT * FROM pending_operations
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= $1)
       ORDER BY created_at ASC`,
      [now],
    );
  }

  for (const op of ops) {
    const account = useAccountStore.getState().accounts.find(
      (a) => a.id === op.account_id,
    );
    if (!account) continue;

    try {
      await executeOperation(op, account);
      await db.execute(
        "UPDATE pending_operations SET status = 'completed' WHERE id = $1",
        [op.id],
      );
    } catch (err) {
      const newRetryCount = op.retry_count + 1;
      if (newRetryCount >= MAX_RETRIES) {
        await db.execute(
          `UPDATE pending_operations
           SET status = 'failed', retry_count = $1, error = $2
           WHERE id = $3`,
          [newRetryCount, err instanceof Error ? err.message : String(err), op.id],
        );
      } else {
        const backoffIndex = Math.min(newRetryCount - 1, BACKOFF_SCHEDULE.length - 1);
        const backoffSeconds = BACKOFF_SCHEDULE[backoffIndex] ?? 60;
        const nextRetry = new Date(
          Date.now() + backoffSeconds * 1000,
        ).toISOString();
        await db.execute(
          `UPDATE pending_operations
           SET retry_count = $1, next_retry_at = $2, error = $3
           WHERE id = $4`,
          [
            newRetryCount,
            nextRetry,
            err instanceof Error ? err.message : String(err),
            op.id,
          ],
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Get pending operations for a thread (used by delta sync conflict detection)
// ---------------------------------------------------------------------------

export async function hasPendingOpsForThread(
  accountId: string,
  threadId: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM pending_operations
     WHERE account_id = $1 AND status = 'pending'
       AND payload LIKE $2`,
    [accountId, `%"threadId":"${threadId}"%`],
  );
  const first = rows[0];
  return first !== undefined && first.cnt > 0;
}

// ---------------------------------------------------------------------------
// Start / Stop
// ---------------------------------------------------------------------------

export function startQueueProcessor(): void {
  if (processorInterval) return;
  processorInterval = setInterval(() => {
    void processQueue();
  }, 30_000);
}

export function stopQueueProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
  }
}
