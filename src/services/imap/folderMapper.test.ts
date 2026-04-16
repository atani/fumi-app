import { describe, it, expect } from "vitest";
import { mapFolder, mapAllFolders, resolveImapFolders } from "./folderMapper";
import type { ImapFolder } from "./tauriCommands";

function folder(
  name: string,
  flags: string[] = [],
  delimiter = "/",
): ImapFolder {
  return { name, flags, delimiter };
}

describe("mapFolder", () => {
  it("maps \\Inbox special-use flag to INBOX", () => {
    const result = mapFolder(folder("INBOX", ["\\Inbox"]));
    expect(result).toEqual({
      labelId: "INBOX",
      labelName: "Inbox",
      specialUse: "\\Inbox",
      imapFolderPath: "INBOX",
    });
  });

  it("maps \\Sent to SENT regardless of name", () => {
    const result = mapFolder(folder("Gesendet", ["\\Sent"]));
    expect(result.labelId).toBe("SENT");
  });

  it("falls back to well-known English name", () => {
    const result = mapFolder(folder("Drafts"));
    expect(result.labelId).toBe("DRAFT");
    expect(result.specialUse).toBe("\\Drafts");
  });

  it("matches well-known names case-insensitively", () => {
    expect(mapFolder(folder("TRASH")).labelId).toBe("TRASH");
    expect(mapFolder(folder("Deleted Items")).labelId).toBe("TRASH");
  });

  it("uses leaf name when path is nested", () => {
    const result = mapFolder(folder("[Gmail]/Sent", [], "/"));
    expect(result.labelId).toBe("SENT");
  });

  it("returns user label for unknown folder", () => {
    const result = mapFolder(folder("Personal/2024"));
    expect(result).toEqual({
      labelId: "imap-Personal/2024",
      labelName: "2024",
      specialUse: null,
      imapFolderPath: "Personal/2024",
    });
  });

  it("prefers special-use flag over name", () => {
    // Folder named "Inbox" but flagged as Archive — flag wins
    const result = mapFolder(folder("Inbox", ["\\Archive"]));
    expect(result.labelId).toBe("ARCHIVE");
  });
});

describe("mapAllFolders", () => {
  it("skips \\Noselect folders", () => {
    const result = mapAllFolders([
      folder("Containers", ["\\Noselect"]),
      folder("INBOX", ["\\Inbox"]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.labelId).toBe("INBOX");
  });

  it("also skips \\NoSelect (alternate casing)", () => {
    const result = mapAllFolders([
      folder("Holder", ["\\NoSelect"]),
      folder("Inbox"),
    ]);
    expect(result).toHaveLength(1);
  });

  it("deduplicates by labelId — first match wins", () => {
    const result = mapAllFolders([
      folder("INBOX", ["\\Inbox"]),
      folder("Inbox"), // would also map to INBOX
    ]);
    expect(result).toHaveLength(1);
  });

  it("preserves user labels for unknown folders", () => {
    const result = mapAllFolders([
      folder("INBOX", ["\\Inbox"]),
      folder("Projects/Alpha"),
      folder("Projects/Beta"),
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.labelId)).toEqual([
      "INBOX",
      "imap-Projects/Alpha",
      "imap-Projects/Beta",
    ]);
  });
});

describe("resolveImapFolders", () => {
  const mappings = mapAllFolders([
    folder("INBOX", ["\\Inbox"]),
    folder("Sent", ["\\Sent"]),
    folder("Personal"),
  ]);

  it("resolves known label IDs", () => {
    expect(resolveImapFolders(["INBOX", "SENT"], mappings)).toEqual([
      "INBOX",
      "Sent",
    ]);
  });

  it("skips unresolvable label IDs", () => {
    expect(resolveImapFolders(["INBOX", "NOT_THERE"], mappings)).toEqual([
      "INBOX",
    ]);
  });

  it("returns empty array when nothing resolves", () => {
    expect(resolveImapFolders(["NOPE"], mappings)).toEqual([]);
  });
});
