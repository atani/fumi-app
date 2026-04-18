import type { Account, Message, Thread, FolderSyncState } from "../../types";
import type { SyncResult } from "../email/emailProvider";
import {
  imapFetchMessages,
  imapFetchNewUids,
  imapGetFolderStatus,
  imapListFolders,
  type ImapConnectionParams,
  type ImapMessage,
} from "./tauriCommands";
import { mapAllFolders, type FolderMapping } from "./folderMapper";
import { buildThreads, type ThreadGroup } from "../threading/threadBuilder";
import { getDb } from "../db/connection";
import { upsertMessagesBatch } from "../db/messages";
import { upsertThreadsBatch, setThreadLabelsBatch } from "../db/threads";
import { recordContactsFromMessages } from "../contacts/contactService";

const BATCH_SIZE = 50;

/** Build IMAP connection parameters from an Account record. */
export function buildImapParams(account: Account): ImapConnectionParams {
  return {
    host: account.imap_host ?? "",
    port: account.imap_port ?? 993,
    username: account.imap_username ?? account.email,
    password: account.imap_password ?? "",
    security: account.imap_security ?? "ssl",
  };
}

// ── Folder sync state persistence ──────────────────────────────────────

async function getFolderSyncState(
  accountId: string,
  folder: string,
): Promise<FolderSyncState | null> {
  const db = await getDb();
  const rows = await db.select<FolderSyncState[]>(
    "SELECT * FROM folder_sync_state WHERE account_id = $1 AND folder = $2",
    [accountId, folder],
  );
  return rows[0] ?? null;
}

async function upsertFolderSyncState(state: FolderSyncState): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO folder_sync_state (folder, account_id, uidvalidity, last_uid, modseq)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(folder, account_id) DO UPDATE SET
       uidvalidity = excluded.uidvalidity,
       last_uid = excluded.last_uid,
       modseq = excluded.modseq`,
    [state.folder, state.account_id, state.uidvalidity, state.last_uid, state.modseq ?? null],
  );
}

async function clearFolderSyncState(
  accountId: string,
  folder: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM folder_sync_state WHERE account_id = $1 AND folder = $2",
    [accountId, folder],
  );
}

async function clearFolderMessages(
  accountId: string,
  folder: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM messages WHERE account_id = $1 AND imap_folder = $2",
    [accountId, folder],
  );
}

// ── Message conversion ─────────────────────────────────────────────────

function imapMessageToMessage(
  imapMsg: ImapMessage,
  accountId: string,
  folder: string,
  threadId: string,
): Message {
  return {
    id: `imap-${accountId}-${folder}-${imapMsg.uid}`,
    thread_id: threadId,
    account_id: accountId,
    from_address: imapMsg.from_address,
    from_name: imapMsg.from_name,
    to_addresses: imapMsg.to_addresses,
    cc_addresses: imapMsg.cc_addresses,
    bcc_addresses: null,
    subject: imapMsg.subject,
    snippet: imapMsg.snippet,
    body_html: null,
    body_text: null,
    date: imapMsg.date,
    is_read: imapMsg.is_read,
    has_attachments: imapMsg.has_attachments,
    header_message_id: imapMsg.message_id,
    auth_results: null,
    list_unsubscribe: null,
    list_unsubscribe_post: null,
    imap_uid: imapMsg.uid,
    imap_folder: folder,
    message_id_header: imapMsg.message_id,
    references_header: imapMsg.references,
    in_reply_to_header: imapMsg.in_reply_to,
  };
}

// ── Thread building from IMAP messages ─────────────────────────────────

function threadGroupToThread(
  group: ThreadGroup,
  accountId: string,
): Thread {
  const lastMsg = group.messages[group.messages.length - 1];
  const firstMsg = group.messages[0];
  const hasUnread = group.messages.some((m) => !m.is_read);

  return {
    id: group.threadId,
    account_id: accountId,
    snippet: lastMsg?.snippet ?? "",
    subject: group.subject || firstMsg?.subject || "(No subject)",
    last_message_at: lastMsg?.date ?? null,
    message_count: group.messages.length,
    is_read: !hasUnread,
    is_starred: false,
    is_muted: false,
    snoozed_until: null,
  };
}

// ── Sync labels from IMAP folders ──────────────────────────────────────

export async function syncImapLabels(account: Account): Promise<FolderMapping[]> {
  const params = buildImapParams(account);
  const folders = await imapListFolders(params);
  const mappings = mapAllFolders(folders);

  const db = await getDb();
  for (const mapping of mappings) {
    await db.execute(
      `INSERT INTO labels (id, account_id, name, type, imap_folder_path, imap_special_use)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id, account_id) DO UPDATE SET
         name = excluded.name,
         imap_folder_path = excluded.imap_folder_path,
         imap_special_use = excluded.imap_special_use`,
      [
        mapping.labelId,
        account.id,
        mapping.labelName,
        mapping.specialUse ? "system" : "user",
        mapping.imapFolderPath,
        mapping.specialUse,
      ],
    );
  }

  return mappings;
}

// ── Initial sync ───────────────────────────────────────────────────────

/**
 * Perform an initial sync for a single IMAP folder.
 * Fetches messages in batches of BATCH_SIZE and groups them into threads.
 */
export async function initialSyncFolder(
  account: Account,
  folder: string,
  mappings: FolderMapping[],
): Promise<SyncResult> {
  const params = buildImapParams(account);

  // Get folder status for UIDVALIDITY
  const status = await imapGetFolderStatus({ ...params, folder });

  // Fetch messages in batch
  const imapMessages = await imapFetchMessages({
    ...params,
    folder,
    count: BATCH_SIZE,
  });

  if (imapMessages.length === 0) {
    // Store sync state even if empty
    await upsertFolderSyncState({
      folder,
      account_id: account.id,
      uidvalidity: status.uidvalidity,
      last_uid: 0,
      modseq: null,
    });
    return { threads: [], newThreads: [] };
  }

  // Convert to Message objects with temporary thread IDs
  const messages: Message[] = imapMessages.map((m) =>
    imapMessageToMessage(m, account.id, folder, `temp-${m.uid}`),
  );

  // Build threads via JWZ algorithm
  const threadGroups = buildThreads(messages);

  // Determine label for this folder
  const folderMapping = mappings.find((m) => m.imapFolderPath === folder);
  const labelId = folderMapping?.labelId ?? `imap-${folder}`;

  // Persist threads and messages
  const db = await getDb();
  const existingRows = await db.select<{ id: string }[]>(
    "SELECT id FROM threads WHERE account_id = $1",
    [account.id],
  );
  const existingIds = new Set(existingRows.map((r) => r.id));

  const syncedThreads: Thread[] = [];
  const newThreads: Thread[] = [];
  const allMessages: Message[] = [];
  const pendingThreads: Thread[] = [];
  const pendingThreadLabels: { threadId: string; labelIds: string[] }[] = [];

  for (const group of threadGroups) {
    const thread = threadGroupToThread(group, account.id);

    // Re-point messages to the canonical thread ID
    for (const msg of group.messages) {
      allMessages.push({ ...msg, thread_id: thread.id });
    }

    const isNew = !existingIds.has(thread.id);
    pendingThreads.push(thread);
    pendingThreadLabels.push({ threadId: thread.id, labelIds: [labelId] });

    syncedThreads.push(thread);
    if (isNew && !thread.is_read) {
      newThreads.push(thread);
    }
  }

  // Batch-persist everything to avoid N+1 round-trips
  await upsertMessagesBatch(allMessages);
  await upsertThreadsBatch(pendingThreads);
  await setThreadLabelsBatch(account.id, pendingThreadLabels);

  // Record contacts
  await recordContactsFromMessages(account.id, allMessages);

  // Track highest UID for delta sync
  const maxUid = Math.max(...imapMessages.map((m) => m.uid));
  await upsertFolderSyncState({
    folder,
    account_id: account.id,
    uidvalidity: status.uidvalidity,
    last_uid: maxUid,
    modseq: null,
  });

  return { threads: syncedThreads, newThreads };
}

// ── Delta sync ─────────────────────────────────────────────────────────

/**
 * Perform a delta sync for a single IMAP folder.
 * Fetches only messages with UIDs greater than the last synced UID.
 * If UIDVALIDITY has changed, triggers a full resync of the folder.
 */
export async function deltaSyncFolder(
  account: Account,
  folder: string,
  mappings: FolderMapping[],
): Promise<SyncResult> {
  const params = buildImapParams(account);

  const syncState = await getFolderSyncState(account.id, folder);
  if (!syncState) {
    // No prior sync — do initial sync
    return initialSyncFolder(account, folder, mappings);
  }

  // Check UIDVALIDITY
  const status = await imapGetFolderStatus({ ...params, folder });
  if (status.uidvalidity !== syncState.uidvalidity) {
    // UIDVALIDITY changed — all cached UIDs are invalid, full resync needed
    await clearFolderMessages(account.id, folder);
    await clearFolderSyncState(account.id, folder);
    return initialSyncFolder(account, folder, mappings);
  }

  // No new messages
  if (status.uidnext <= syncState.last_uid + 1) {
    return { threads: [], newThreads: [] };
  }

  // Fetch only new messages
  const newImapMessages = await imapFetchNewUids({
    ...params,
    folder,
    lastUid: syncState.last_uid,
  });

  if (newImapMessages.length === 0) {
    return { threads: [], newThreads: [] };
  }

  const messages: Message[] = newImapMessages.map((m) =>
    imapMessageToMessage(m, account.id, folder, `temp-${m.uid}`),
  );

  // Fetch existing messages from DB for this folder to build complete threads
  const db = await getDb();
  const existingMessages = await db.select<Message[]>(
    "SELECT * FROM messages WHERE account_id = $1 AND imap_folder = $2",
    [account.id, folder],
  );

  const allMessages = [...existingMessages, ...messages];
  const threadGroups = buildThreads(allMessages);

  const folderMapping = mappings.find((m) => m.imapFolderPath === folder);
  const labelId = folderMapping?.labelId ?? `imap-${folder}`;

  const existingThreadRows = await db.select<{ id: string }[]>(
    "SELECT id FROM threads WHERE account_id = $1",
    [account.id],
  );
  const existingThreadIds = new Set(existingThreadRows.map((r) => r.id));

  const syncedThreads: Thread[] = [];
  const newThreads: Thread[] = [];
  const persistedMessages: Message[] = [];
  const pendingThreads: Thread[] = [];
  const pendingThreadLabels: { threadId: string; labelIds: string[] }[] = [];

  // O(1) lookup replaces the prior O(n²) double-loop
  const newMsgIdSet = new Set(messages.map((m) => m.id));

  for (const group of threadGroups) {
    const hasNewMessage = group.messages.some((m) => newMsgIdSet.has(m.id));
    if (!hasNewMessage) continue;

    const thread = threadGroupToThread(group, account.id);

    for (const msg of group.messages) {
      persistedMessages.push({ ...msg, thread_id: thread.id });
    }

    const isNew = !existingThreadIds.has(thread.id);
    pendingThreads.push(thread);
    pendingThreadLabels.push({ threadId: thread.id, labelIds: [labelId] });

    syncedThreads.push(thread);
    if (isNew && !thread.is_read) {
      newThreads.push(thread);
    }
  }

  // Batch-persist everything to avoid N+1 round-trips
  await upsertMessagesBatch(persistedMessages);
  await upsertThreadsBatch(pendingThreads);
  await setThreadLabelsBatch(account.id, pendingThreadLabels);

  // Record contacts from new messages only
  const contactMessages = persistedMessages.filter((m) => newMsgIdSet.has(m.id));
  await recordContactsFromMessages(account.id, contactMessages);

  // Update sync state
  const maxUid = Math.max(...newImapMessages.map((m) => m.uid));
  await upsertFolderSyncState({
    folder,
    account_id: account.id,
    uidvalidity: status.uidvalidity,
    last_uid: maxUid,
    modseq: null,
  });

  return { threads: syncedThreads, newThreads };
}

// ── High-level sync orchestration ──────────────────────────────────────

/**
 * Sync all folders for an IMAP account.
 * Performs delta sync on folders that have been previously synced,
 * and initial sync on new folders.
 */
export async function syncImapAccount(account: Account): Promise<SyncResult> {
  const mappings = await syncImapLabels(account);

  // Always sync INBOX; other folders can be synced on demand
  const inboxMapping = mappings.find(
    (m) => m.labelId === "INBOX",
  );
  const inboxFolder = inboxMapping?.imapFolderPath ?? "INBOX";

  return deltaSyncFolder(account, inboxFolder, mappings);
}
