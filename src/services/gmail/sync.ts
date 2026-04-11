import { authenticatedFetch, getHeader, getMessageBody } from "./api";
import { upsertThread, setThreadLabelsBatch } from "../db/threads";
import { upsertMessage } from "../db/messages";
import { getDb } from "../db/connection";
import { recordContactsFromMessages } from "../contacts/contactService";
import { processFilters } from "../filters/filterEngine";
import { processBundleRules } from "../bundles/bundleManager";
import { hasPendingOpsForThread } from "../queue/queueProcessor";
import type { Account, Thread, Message, GmailMessage, GmailThread } from "../../types";

export interface SyncResult {
  threads: Thread[];
  newThreads: Thread[];
}

function parseGmailMessage(
  gmailMsg: GmailMessage,
  accountId: string,
): Message {
  const from = getHeader(gmailMsg, "From") ?? "";
  const fromMatch = from.match(/^(?:"?(.+?)"?\s*)?<?([^>]+)>?$/);

  return {
    id: gmailMsg.id,
    thread_id: gmailMsg.threadId,
    account_id: accountId,
    from_address: fromMatch?.[2] ?? from,
    from_name: fromMatch?.[1] ?? null,
    to_addresses: getHeader(gmailMsg, "To") ?? null,
    cc_addresses: getHeader(gmailMsg, "Cc") ?? null,
    bcc_addresses: getHeader(gmailMsg, "Bcc") ?? null,
    subject: getHeader(gmailMsg, "Subject") ?? null,
    snippet: gmailMsg.snippet,
    body_html: getMessageBody(gmailMsg),
    body_text: null,
    date: new Date(parseInt(gmailMsg.internalDate)).toISOString(),
    is_read: !gmailMsg.labelIds.includes("UNREAD"),
    has_attachments: false,
    header_message_id: getHeader(gmailMsg, "Message-ID") ?? null,
    auth_results: getHeader(gmailMsg, "Authentication-Results") ?? null,
    list_unsubscribe: getHeader(gmailMsg, "List-Unsubscribe") ?? null,
    list_unsubscribe_post: getHeader(gmailMsg, "List-Unsubscribe-Post") ?? null,
    imap_uid: null,
    imap_folder: null,
    message_id_header: null,
    references_header: null,
    in_reply_to_header: null,
  };
}

export async function syncLabels(account: Account): Promise<void> {
  if (!account.access_token && !account.refresh_token) return;

  const { labels } = await authenticatedFetch<{
    labels: { id: string; name: string; type: string }[];
  }>(account, "/labels");
  const db = await getDb();

  for (const label of labels) {
    await db.execute(
      `INSERT INTO labels (id, account_id, name, type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(id, account_id) DO UPDATE SET name = excluded.name`,
      [label.id, account.id, label.name, label.type],
    );
  }
}

export async function syncInbox(
  account: Account,
  maxResults = 50,
): Promise<SyncResult> {
  if (!account.access_token && !account.refresh_token)
    return { threads: [], newThreads: [] };

  const params = new URLSearchParams({
    maxResults: String(maxResults),
    labelIds: "INBOX",
  });

  const { threads: threadList } = await authenticatedFetch<{
    threads: { id: string; snippet: string }[];
    nextPageToken?: string;
  }>(account, `/threads?${params}`);

  if (!threadList?.length) return { threads: [], newThreads: [] };

  // Collect existing thread IDs so we can detect genuinely new threads
  const db = await getDb();
  const existingRows = await db.select<{ id: string }[]>(
    "SELECT id FROM threads WHERE account_id = $1",
    [account.id],
  );
  const existingIds = new Set(existingRows.map((r) => r.id));

  const syncedThreads: Thread[] = [];
  const newThreads: Thread[] = [];
  const allParsedMessages: Message[] = [];
  const pendingThreadLabels: { threadId: string; labelIds: string[] }[] = [];

  for (const item of threadList) {
    // Skip threads with pending local operations to avoid conflicts
    if (await hasPendingOpsForThread(account.id, item.id)) continue;

    const gmailThread = await authenticatedFetch<GmailThread>(
      account,
      `/threads/${item.id}?format=full`,
    );
    if (!gmailThread.messages?.length) continue;

    const messages = gmailThread.messages;
    const lastMessage = messages[messages.length - 1]!;
    const firstMessage = messages[0]!;
    const labelIds = [...new Set(messages.flatMap((m) => m.labelIds))];

    const thread: Thread = {
      id: gmailThread.id,
      account_id: account.id,
      snippet: gmailThread.snippet,
      subject: getHeader(firstMessage, "Subject") ?? "(No subject)",
      last_message_at: new Date(
        parseInt(lastMessage.internalDate),
      ).toISOString(),
      message_count: messages.length,
      is_read: !labelIds.includes("UNREAD"),
      is_starred: labelIds.includes("STARRED"),
      is_muted: false,
      snoozed_until: null,
    };

    const isNew = !existingIds.has(thread.id);

    await upsertThread(thread);
    pendingThreadLabels.push({ threadId: thread.id, labelIds });

    for (const gmailMsg of messages) {
      const message = parseGmailMessage(gmailMsg, account.id);
      await upsertMessage(message);
      allParsedMessages.push(message);
    }

    syncedThreads.push(thread);

    if (isNew && !thread.is_read) {
      newThreads.push(thread);
    }
  }

  // Batch set all thread labels in a single transaction
  await setThreadLabelsBatch(account.id, pendingThreadLabels);

  // Record contacts from all synced messages
  await recordContactsFromMessages(account.id, allParsedMessages);

  // Auto-apply filter rules to messages from new threads
  const newThreadIds = new Set(newThreads.map((t) => t.id));
  const newMessages = allParsedMessages.filter((m) =>
    newThreadIds.has(m.thread_id),
  );
  await processFilters(account, newMessages);

  // Check new threads against bundle rules
  await processBundleRules(account, newThreads, allParsedMessages);

  return { threads: syncedThreads, newThreads };
}
