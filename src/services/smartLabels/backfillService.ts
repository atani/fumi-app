import type { Message } from "../../types";
import { getDb } from "../db/connection";
import { classifyMessage, getSmartLabelRules } from "./smartLabelService";

/**
 * Batch-apply smart label rules to existing inbox messages that haven't
 * been classified yet. Processes in batches to avoid UI freezing.
 *
 * @param accountId - The account to backfill
 * @param batchSize - Number of messages to process per batch (default 20)
 * @returns Total number of labels applied
 */
export async function backfillSmartLabels(
  accountId: string,
  batchSize = 20,
): Promise<number> {
  const rules = await getSmartLabelRules(accountId);
  if (rules.length === 0) return 0;

  const db = await getDb();

  // Get the label_ids from smart label rules so we can skip already-labeled threads
  const ruleLabels = rules.map((r) => r.label_id);

  // Fetch inbox messages that don't already have any smart label applied.
  // We check by looking for threads in INBOX that lack the rule's labels.
  const placeholders = ruleLabels.map((_, i) => `$${i + 3}`).join(",");
  const messages = await db.select<Message[]>(
    `SELECT m.*
     FROM messages m
     JOIN thread_labels tl ON tl.thread_id = m.thread_id AND tl.account_id = m.account_id
     WHERE m.account_id = $1
       AND tl.label_id = 'INBOX'
       AND m.thread_id NOT IN (
         SELECT tl2.thread_id FROM thread_labels tl2
         WHERE tl2.account_id = $2 AND tl2.label_id IN (${placeholders})
       )
     GROUP BY m.thread_id
     ORDER BY m.date DESC
     LIMIT $${ruleLabels.length + 3}`,
    [accountId, accountId, ...ruleLabels, batchSize],
  );

  let applied = 0;

  for (const message of messages) {
    try {
      const labelId = await classifyMessage(message, accountId);
      if (labelId) {
        await db.execute(
          `INSERT INTO thread_labels (thread_id, label_id, account_id)
           VALUES ($1, $2, $3)
           ON CONFLICT(thread_id, label_id, account_id) DO NOTHING`,
          [message.thread_id, labelId, accountId],
        );
        applied++;
      }
    } catch {
      // Skip individual failures
      continue;
    }
  }

  return applied;
}
