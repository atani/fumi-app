import { categorizeByRules } from "./ruleEngine";
import {
  getUncategorizedInboxThreadIds,
  setThreadCategory,
} from "../db/threads";

/**
 * Find INBOX threads that have no entry in thread_categories and
 * categorize them using the rule engine. Threads that don't match
 * any rule are assigned "Primary" (the safe default) rather than
 * calling the AI API, so backfill can run without an API key.
 */
export async function backfillUncategorizedThreads(
  accountId: string,
): Promise<number> {
  const uncategorized = await getUncategorizedInboxThreadIds(accountId);

  let categorized = 0;

  for (const row of uncategorized) {
    const category =
      categorizeByRules(row.fromAddress, row.subject) ?? "Primary";

    await setThreadCategory(row.threadId, accountId, category);
    categorized++;
  }

  return categorized;
}
