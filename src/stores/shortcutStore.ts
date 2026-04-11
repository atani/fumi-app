import { create } from "zustand";
import { getDb } from "../services/db/connection";

// ---------------------------------------------------------------------------
// Action IDs — every customizable keyboard shortcut has a unique ID.
// ---------------------------------------------------------------------------

export type ShortcutActionId =
  // Navigation
  | "navigate_next"
  | "navigate_prev"
  | "open_thread"
  // Actions
  | "archive"
  | "toggle_star"
  | "trash"
  | "mute"
  | "unsubscribe"
  | "move_to_folder"
  // Compose / reply
  | "compose"
  | "reply"
  | "reply_all"
  | "forward"
  // Tasks
  | "extract_tasks"
  // Search / help
  | "search"
  | "search_ctrl"
  | "shortcuts_help"
  // g-prefix navigation sequences (only the second key is customizable)
  | "go_inbox"
  | "go_starred"
  | "go_sent"
  | "go_drafts"
  | "go_tasks"
  | "go_attachments";

// ---------------------------------------------------------------------------
// Default key map — source of truth for built-in bindings.
// Format: simple key ("j"), modifier ("Ctrl+k"), g-sequence second key ("g i").
// ---------------------------------------------------------------------------

export const DEFAULT_KEY_MAP: Record<ShortcutActionId, string> = {
  navigate_next: "j",
  navigate_prev: "k",
  open_thread: "o",
  archive: "e",
  toggle_star: "s",
  trash: "#",
  mute: "m",
  unsubscribe: "u",
  move_to_folder: "v",
  compose: "c",
  reply: "r",
  reply_all: "a",
  forward: "f",
  extract_tasks: "t",
  search: "/",
  search_ctrl: "Ctrl+k",
  shortcuts_help: "?",
  go_inbox: "g i",
  go_starred: "g s",
  go_sent: "g t",
  go_drafts: "g d",
  go_tasks: "g k",
  go_attachments: "g a",
};

// Descriptive labels shown in the UI.
export const SHORTCUT_LABELS: Record<ShortcutActionId, string> = {
  navigate_next: "Next thread",
  navigate_prev: "Previous thread",
  open_thread: "Open thread",
  archive: "Archive",
  toggle_star: "Toggle star",
  trash: "Trash",
  mute: "Mute / unmute",
  unsubscribe: "Unsubscribe",
  move_to_folder: "Move to folder",
  compose: "Compose new email",
  reply: "Reply",
  reply_all: "Reply all",
  forward: "Forward",
  extract_tasks: "Extract tasks",
  search: "Search",
  search_ctrl: "Search (Ctrl)",
  shortcuts_help: "Keyboard shortcuts",
  go_inbox: "Go to Inbox",
  go_starred: "Go to Starred",
  go_sent: "Go to Sent",
  go_drafts: "Go to Drafts",
  go_tasks: "Go to Tasks",
  go_attachments: "Go to Attachments",
};

// Grouping for the UI display.
export const SHORTCUT_SECTIONS: {
  title: string;
  actions: ShortcutActionId[];
}[] = [
  {
    title: "Navigation",
    actions: [
      "navigate_next",
      "navigate_prev",
      "open_thread",
      "go_inbox",
      "go_starred",
      "go_sent",
      "go_drafts",
      "go_tasks",
      "go_attachments",
    ],
  },
  {
    title: "Actions",
    actions: ["archive", "toggle_star", "trash", "mute", "unsubscribe", "move_to_folder"],
  },
  {
    title: "Compose",
    actions: ["compose", "reply", "reply_all", "forward"],
  },
  {
    title: "Other",
    actions: ["search", "search_ctrl", "shortcuts_help", "extract_tasks"],
  },
];

// ---------------------------------------------------------------------------
// Reverse lookup: keyCombo -> actionId (for fast matching in the handler).
// ---------------------------------------------------------------------------

export function buildReverseMap(
  keyMap: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [actionId, combo] of Object.entries(keyMap)) {
    map.set(combo, actionId);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Settings persistence helpers (same pattern as SettingsPage).
// ---------------------------------------------------------------------------

const SETTINGS_KEY = "custom_keyboard_shortcuts";

async function loadShortcutSettings(): Promise<Record<string, string> | null> {
  try {
    const db = await getDb();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = $1",
      [SETTINGS_KEY],
    );
    const raw = rows[0]?.value;
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

async function saveShortcutSettings(
  keyMap: Record<string, string>,
): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
      [SETTINGS_KEY, JSON.stringify(keyMap)],
    );
  } catch {
    // Silently fail
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ShortcutState {
  keyMap: Record<string, string>;
  reverseMap: Map<string, string>;

  /** Load persisted overrides from SQLite settings table. */
  loadKeyMap: () => Promise<void>;

  /** Update a single shortcut binding and persist. */
  updateKey: (actionId: string, newKey: string) => Promise<void>;

  /** Reset all shortcuts to defaults and persist. */
  resetToDefaults: () => Promise<void>;

  /** Reset a single shortcut to its default and persist. */
  resetKey: (actionId: string) => Promise<void>;
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  keyMap: { ...DEFAULT_KEY_MAP },
  reverseMap: buildReverseMap(DEFAULT_KEY_MAP),

  loadKeyMap: async () => {
    const saved = await loadShortcutSettings();
    if (saved) {
      // Merge: defaults as base, saved overrides on top. This ensures new
      // actions added in future updates still get a default binding.
      const merged = { ...DEFAULT_KEY_MAP, ...saved };
      set({ keyMap: merged, reverseMap: buildReverseMap(merged) });
    }
  },

  updateKey: async (actionId: string, newKey: string) => {
    const current = get().keyMap;
    const updated = { ...current, [actionId]: newKey };
    set({ keyMap: updated, reverseMap: buildReverseMap(updated) });
    await saveShortcutSettings(updated);
  },

  resetToDefaults: async () => {
    const defaults = { ...DEFAULT_KEY_MAP };
    set({ keyMap: defaults, reverseMap: buildReverseMap(defaults) });
    await saveShortcutSettings(defaults);
  },

  resetKey: async (actionId: string) => {
    const defaultCombo = DEFAULT_KEY_MAP[actionId as ShortcutActionId];
    if (defaultCombo === undefined) return;
    const current = get().keyMap;
    const updated = { ...current, [actionId]: defaultCombo };
    set({ keyMap: updated, reverseMap: buildReverseMap(updated) });
    await saveShortcutSettings(updated);
  },
}));
