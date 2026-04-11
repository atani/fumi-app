import { getDb } from "../db/connection";

const PRE_CACHE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5 MB
const LOOKBACK_DAYS = 7;

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch small, uncached attachments from the last 7 days and mark them
 * as cached (sets cached_at and cache_size). In a real implementation
 * the binary data would also be written to a local cache directory via
 * the Tauri fs plugin — this service handles the DB bookkeeping.
 */
async function preCacheAttachments(): Promise<void> {
  const db = await getDb();

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db.select<
    { id: string; message_id: string; account_id: string; size: number }[]
  >(
    `SELECT a.id, a.message_id, a.account_id, a.size
     FROM attachments a
     JOIN messages m ON m.id = a.message_id AND m.account_id = a.account_id
     WHERE a.cached_at IS NULL
       AND a.size > 0
       AND a.size <= $1
       AND m.date >= $2
     ORDER BY m.date DESC
     LIMIT 50`,
    [MAX_CACHE_SIZE, cutoff],
  );

  for (const row of rows) {
    // In production, this is where we'd invoke a Tauri command to download
    // and write the attachment data to the local cache directory. For now
    // we simply record the cache metadata in the DB.
    await db.execute(
      `UPDATE attachments SET cached_at = datetime('now'), cache_size = $1 WHERE id = $2`,
      [row.size, row.id],
    );
  }
}

/**
 * Start the background pre-cache manager. Runs every 15 minutes.
 */
export function startPreCacheManager(): void {
  if (intervalId !== null) return;

  // Run once immediately, then on interval
  void preCacheAttachments();
  intervalId = setInterval(() => {
    void preCacheAttachments();
  }, PRE_CACHE_INTERVAL_MS);
}

/**
 * Stop the background pre-cache manager.
 */
export function stopPreCacheManager(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
