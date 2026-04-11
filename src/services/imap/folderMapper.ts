import type { ImapFolder } from "./tauriCommands";

/**
 * Mapping from IMAP special-use flags and well-known folder names
 * to Gmail-style label IDs.
 */

export interface FolderMapping {
  labelId: string;
  labelName: string;
  specialUse: string | null;
  imapFolderPath: string;
}

/** Special-use flag → Gmail label ID */
const SPECIAL_USE_MAP: Record<string, { labelId: string; labelName: string }> =
  {
    "\\Inbox": { labelId: "INBOX", labelName: "Inbox" },
    "\\Sent": { labelId: "SENT", labelName: "Sent" },
    "\\Drafts": { labelId: "DRAFT", labelName: "Drafts" },
    "\\Trash": { labelId: "TRASH", labelName: "Trash" },
    "\\Junk": { labelId: "SPAM", labelName: "Spam" },
    "\\Flagged": { labelId: "STARRED", labelName: "Starred" },
    "\\Archive": { labelId: "ARCHIVE", labelName: "All Mail" },
    "\\All": { labelId: "ALL_MAIL", labelName: "All Mail" },
  };

/**
 * Well-known folder name patterns (case-insensitive) used as a fallback
 * when the server does not advertise special-use flags.
 */
const WELL_KNOWN_NAMES: Record<
  string,
  { labelId: string; labelName: string; specialUse: string }
> = {
  inbox: { labelId: "INBOX", labelName: "Inbox", specialUse: "\\Inbox" },
  sent: { labelId: "SENT", labelName: "Sent", specialUse: "\\Sent" },
  "sent mail": { labelId: "SENT", labelName: "Sent", specialUse: "\\Sent" },
  "sent items": { labelId: "SENT", labelName: "Sent", specialUse: "\\Sent" },
  drafts: { labelId: "DRAFT", labelName: "Drafts", specialUse: "\\Drafts" },
  draft: { labelId: "DRAFT", labelName: "Drafts", specialUse: "\\Drafts" },
  trash: { labelId: "TRASH", labelName: "Trash", specialUse: "\\Trash" },
  "deleted items": {
    labelId: "TRASH",
    labelName: "Trash",
    specialUse: "\\Trash",
  },
  "deleted messages": {
    labelId: "TRASH",
    labelName: "Trash",
    specialUse: "\\Trash",
  },
  junk: { labelId: "SPAM", labelName: "Spam", specialUse: "\\Junk" },
  spam: { labelId: "SPAM", labelName: "Spam", specialUse: "\\Junk" },
  "junk email": { labelId: "SPAM", labelName: "Spam", specialUse: "\\Junk" },
  archive: {
    labelId: "ARCHIVE",
    labelName: "All Mail",
    specialUse: "\\Archive",
  },
  "all mail": {
    labelId: "ALL_MAIL",
    labelName: "All Mail",
    specialUse: "\\All",
  },
  starred: {
    labelId: "STARRED",
    labelName: "Starred",
    specialUse: "\\Flagged",
  },
  flagged: {
    labelId: "STARRED",
    labelName: "Starred",
    specialUse: "\\Flagged",
  },
};

/**
 * Map a single IMAP folder to a Gmail-style label.
 * Returns the mapping, using special-use flags first, then falling back
 * to well-known name matching. Unknown folders are mapped as user labels.
 */
export function mapFolder(folder: ImapFolder): FolderMapping {
  // Try special-use flags first
  for (const flag of folder.flags) {
    const match = SPECIAL_USE_MAP[flag];
    if (match) {
      return {
        labelId: match.labelId,
        labelName: match.labelName,
        specialUse: flag,
        imapFolderPath: folder.name,
      };
    }
  }

  // Fallback: check well-known names
  const leafName = folder.name.split(folder.delimiter || "/").pop() ?? folder.name;
  const normalized = leafName.toLowerCase().trim();
  const wellKnown = WELL_KNOWN_NAMES[normalized];
  if (wellKnown) {
    return {
      labelId: wellKnown.labelId,
      labelName: wellKnown.labelName,
      specialUse: wellKnown.specialUse,
      imapFolderPath: folder.name,
    };
  }

  // Unknown folder → user label using full folder path as ID
  return {
    labelId: `imap-${folder.name}`,
    labelName: leafName,
    specialUse: null,
    imapFolderPath: folder.name,
  };
}

/**
 * Map all IMAP folders to Gmail-style labels. Deduplicates by labelId,
 * preferring the first match (special-use flag takes priority).
 */
export function mapAllFolders(folders: ImapFolder[]): FolderMapping[] {
  const seen = new Set<string>();
  const mappings: FolderMapping[] = [];

  for (const folder of folders) {
    // Skip \Noselect folders (container-only, no messages)
    if (folder.flags.some((f) => f === "\\Noselect" || f === "\\NoSelect")) {
      continue;
    }

    const mapping = mapFolder(folder);
    if (!seen.has(mapping.labelId)) {
      seen.add(mapping.labelId);
      mappings.push(mapping);
    }
  }

  return mappings;
}

/**
 * Given Gmail-style label IDs, resolve the corresponding IMAP folder paths.
 * Requires the precomputed folder mappings for the account.
 */
export function resolveImapFolders(
  labelIds: string[],
  mappings: FolderMapping[],
): string[] {
  const labelToFolder = new Map<string, string>();
  for (const m of mappings) {
    labelToFolder.set(m.labelId, m.imapFolderPath);
  }

  const result: string[] = [];
  for (const labelId of labelIds) {
    const folder = labelToFolder.get(labelId);
    if (folder !== undefined) {
      result.push(folder);
    }
  }
  return result;
}
