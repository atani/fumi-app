export const HISTORY_KEY = "fumi.searchHistory";
export const HISTORY_MAX = 10;

/**
 * Load recent search queries from localStorage.
 * Returns an empty array when storage is unavailable or corrupt.
 */
export function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q): q is string => typeof q === "string")
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

/**
 * Persist history to localStorage. Swallows write errors (private mode,
 * quota exceeded) so search remains usable even if persistence fails.
 */
export function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Quota or privacy mode — silently ignore
  }
}

/**
 * Insert `query` into history, deduplicating and capping at HISTORY_MAX.
 * Returns the updated array — the caller is responsible for persisting it.
 */
export function addToHistory(history: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return history;
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(
    0,
    HISTORY_MAX,
  );
}

export function removeFromHistory(history: string[], query: string): string[] {
  return history.filter((item) => item !== query);
}
