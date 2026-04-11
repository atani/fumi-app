import { authenticatedFetch, getHeader, getMessageBody } from "./api";
import { upsertThread, setThreadLabels } from "../db/threads";
import { upsertMessage } from "../db/messages";
import { getDb } from "../db/connection";
import type { Account, Thread, Message, GmailMessage, GmailThread } from "../../types";

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
): Promise<Thread[]> {
  if (!account.access_token && !account.refresh_token) return [];

  const params = new URLSearchParams({
    maxResults: String(maxResults),
    labelIds: "INBOX",
  });

  const { threads: threadList } = await authenticatedFetch<{
    threads: { id: string; snippet: string }[];
    nextPageToken?: string;
  }>(account, `/threads?${params}`);

  if (!threadList?.length) return [];

  const syncedThreads: Thread[] = [];

  for (const item of threadList) {
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
    };

    await upsertThread(thread);
    await setThreadLabels(thread.id, account.id, labelIds);

    for (const gmailMsg of messages) {
      const message = parseGmailMessage(gmailMsg, account.id);
      await upsertMessage(message);
    }

    syncedThreads.push(thread);
  }

  return syncedThreads;
}
