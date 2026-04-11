import type { Account, SmartFolder, Thread } from "../../types";
import { searchLocal } from "./searchService";

/**
 * Replace dynamic tokens in a smart folder query with actual date values.
 *
 * Supported tokens:
 * - __TODAY__        → today's date (YYYY-MM-DD)
 * - __LAST_7_DAYS__  → date 7 days ago (YYYY-MM-DD)
 * - __LAST_30_DAYS__ → date 30 days ago (YYYY-MM-DD)
 */
export function expandDynamicTokens(query: string): string {
  const now = new Date();

  const today = formatDate(now);

  const last7 = new Date(now);
  last7.setDate(last7.getDate() - 7);

  const last30 = new Date(now);
  last30.setDate(last30.getDate() - 30);

  return query
    .replace(/__TODAY__/g, today)
    .replace(/__LAST_7_DAYS__/g, formatDate(last7))
    .replace(/__LAST_30_DAYS__/g, formatDate(last30));
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

/**
 * Execute a smart folder's query: expand tokens, then search locally.
 */
export async function executeSmartFolder(
  account: Account,
  folder: SmartFolder,
): Promise<Thread[]> {
  const expandedQuery = expandDynamicTokens(folder.query);
  return searchLocal(account.id, expandedQuery);
}
