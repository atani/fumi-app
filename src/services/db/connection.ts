let db: import("@tauri-apps/plugin-sql").default | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

// In-memory fallback for browser-only mode (testing, dev without Tauri)
class MemoryDb {
  async execute(_query: string, _bindValues?: unknown[]): Promise<{ rowsAffected: number }> {
    return { rowsAffected: 0 };
  }

  async select<T>(_query: string, _bindValues?: unknown[]): Promise<T> {
    return [] as T;
  }
}

export async function getDb() {
  if (!isTauri()) {
    if (!db) {
      db = new MemoryDb() as unknown as import("@tauri-apps/plugin-sql").default;
    }
    return db;
  }

  if (!db) {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    db = await Database.load("sqlite:fumi.db");
  }
  return db;
}
