import type { Message } from "../../types";
import { getDb } from "../db/connection";
import { classifyMessage } from "./smartLabelService";

/**
 * Apply smart label rules to a single message during sync.
 * If a label is matched, inserts a thread_labels row.
 */
export async function applySmartLabels(
  message: Message,
  accountId: string,
): Promise<void> {
  const labelId = await classifyMessage(message, accountId);
  if (!labelId) return;

  const db = await getDb();
  await db.execute(
    `INSERT INTO thread_labels (thread_id, label_id, account_id)
     VALUES ($1, $2, $3)
     ON CONFLICT(thread_id, label_id, account_id) DO NOTHING`,
    [message.thread_id, labelId, accountId],
  );
}

/**
 * Apply smart label rules to a batch of new messages (e.g., after sync).
 * Processes each message sequentially to avoid overwhelming the AI API.
 */
export async function applySmartLabelsToMessages(
  messages: Message[],
  accountId: string,
): Promise<number> {
  let applied = 0;

  for (const message of messages) {
    try {
      const labelId = await classifyMessage(message, accountId);
      if (labelId) {
        const db = await getDb();
        await db.execute(
          `INSERT INTO thread_labels (thread_id, label_id, account_id)
           VALUES ($1, $2, $3)
           ON CONFLICT(thread_id, label_id, account_id) DO NOTHING`,
          [message.thread_id, labelId, accountId],
        );
        applied++;
      }
    } catch {
      // Skip individual message failures
      continue;
    }
  }

  return applied;
}
