import type { Account, Message } from "../../types";
import type {
  EmailProvider,
  SyncResult,
  FolderInfo,
  SendEmailParams,
} from "./emailProvider";
import { syncInbox, syncLabels } from "../gmail/sync";
import { authenticatedFetch, getHeader, getMessage } from "../gmail/api";
import { withTokenRefresh } from "../gmail/tokenManager";
import {
  syncImapAccount,
  syncImapLabels,
  buildImapParams,
} from "../imap/imapSync";
import {
  imapListFolders,
  imapFetchMessageBody,
  imapSetFlags,
  imapMoveMessages,
  smtpSendEmail,
  type EmailRecipient,
} from "../imap/tauriCommands";
import { mapAllFolders, resolveImapFolders } from "../imap/folderMapper";
import { getDb } from "../db/connection";

// ── Gmail provider ─────────────────────────────────────────────────────

const gmailProvider: EmailProvider = {
  async sync(account: Account): Promise<SyncResult> {
    return syncInbox(account);
  },

  async syncLabels(account: Account): Promise<void> {
    return syncLabels(account);
  },

  async send(account: Account, params: SendEmailParams): Promise<string> {
    const boundary = `boundary_${Date.now()}`;
    const toHeader = params.to.join(", ");
    const ccHeader = params.cc?.join(", ") ?? "";
    const headers = [
      `To: ${toHeader}`,
      ccHeader ? `Cc: ${ccHeader}` : "",
      `Subject: ${params.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      params.inReplyTo ? `In-Reply-To: ${params.inReplyTo}` : "",
      params.references ? `References: ${params.references}` : "",
    ]
      .filter(Boolean)
      .join("\r\n");

    const textPart = params.bodyText ?? "";
    const htmlPart = params.bodyHtml ?? "";

    const raw = [
      headers,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      textPart,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      htmlPart,
      `--${boundary}--`,
    ].join("\r\n");

    const encoded = btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = await authenticatedFetch<{ id: string }>(
      account,
      "/messages/send",
      {
        method: "POST",
        body: JSON.stringify({ raw: encoded }),
      },
    );
    return result.id;
  },

  async listFolders(account: Account): Promise<FolderInfo[]> {
    const { labels } = await authenticatedFetch<{
      labels: { id: string; name: string; type: string }[];
    }>(account, "/labels");

    return labels.map((l) => ({
      name: l.name,
      delimiter: "/",
      flags: [],
      specialUse: l.type === "system" ? l.id : undefined,
    }));
  },

  async fetchMessage(
    account: Account,
    messageId: string,
  ): Promise<Message | null> {
    try {
      const gmailMsg = await withTokenRefresh(account, (token) =>
        getMessage(token, messageId),
      );

      const from = getHeader(gmailMsg, "From") ?? "";
      const fromMatch = from.match(/^(?:"?(.+?)"?\s*)?<?([^>]+)>?$/);

      return {
        id: gmailMsg.id,
        thread_id: gmailMsg.threadId,
        account_id: account.id,
        from_address: fromMatch?.[2] ?? from,
        from_name: fromMatch?.[1] ?? null,
        to_addresses: getHeader(gmailMsg, "To") ?? null,
        cc_addresses: getHeader(gmailMsg, "Cc") ?? null,
        bcc_addresses: getHeader(gmailMsg, "Bcc") ?? null,
        subject: getHeader(gmailMsg, "Subject") ?? null,
        snippet: gmailMsg.snippet,
        body_html: null,
        body_text: null,
        date: new Date(parseInt(gmailMsg.internalDate)).toISOString(),
        is_read: !gmailMsg.labelIds.includes("UNREAD"),
        has_attachments: false,
        header_message_id: getHeader(gmailMsg, "Message-ID") ?? null,
        auth_results: getHeader(gmailMsg, "Authentication-Results") ?? null,
        list_unsubscribe: getHeader(gmailMsg, "List-Unsubscribe") ?? null,
        list_unsubscribe_post:
          getHeader(gmailMsg, "List-Unsubscribe-Post") ?? null,
        imap_uid: null,
        imap_folder: null,
        message_id_header: null,
        references_header: null,
        in_reply_to_header: null,
      };
    } catch {
      return null;
    }
  },

  async modifyLabels(
    account: Account,
    threadId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    await authenticatedFetch(account, `/threads/${threadId}/modify`, {
      method: "POST",
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    });
  },
};

// ── IMAP/SMTP provider ────────────────────────────────────────────────

const imapProvider: EmailProvider = {
  async sync(account: Account): Promise<SyncResult> {
    return syncImapAccount(account);
  },

  async syncLabels(account: Account): Promise<void> {
    await syncImapLabels(account);
  },

  async send(account: Account, params: SendEmailParams): Promise<string> {
    const toRecipients: EmailRecipient[] = params.to.map((addr) => ({
      address: addr,
    }));
    const ccRecipients: EmailRecipient[] = (params.cc ?? []).map((addr) => ({
      address: addr,
    }));
    const bccRecipients: EmailRecipient[] = (params.bcc ?? []).map((addr) => ({
      address: addr,
    }));

    return smtpSendEmail({
      host: account.smtp_host ?? "",
      port: account.smtp_port ?? 587,
      username: account.imap_username ?? account.email,
      password: account.imap_password ?? "",
      security: account.smtp_security ?? "ssl",
      from: { address: account.email, name: account.name },
      to: toRecipients,
      cc: ccRecipients,
      bcc: bccRecipients,
      subject: params.subject,
      bodyText: params.bodyText,
      bodyHtml: params.bodyHtml,
      inReplyTo: params.inReplyTo,
      references: params.references,
    });
  },

  async listFolders(account: Account): Promise<FolderInfo[]> {
    const params = buildImapParams(account);
    const folders = await imapListFolders(params);
    return folders.map((f) => ({
      name: f.name,
      delimiter: f.delimiter,
      flags: f.flags,
    }));
  },

  async fetchMessage(
    account: Account,
    messageId: string,
  ): Promise<Message | null> {
    // Look up the message from the local DB to get folder and UID
    const db = await getDb();
    const rows = await db.select<
      { imap_uid: number | null; imap_folder: string | null }[]
    >(
      "SELECT imap_uid, imap_folder FROM messages WHERE id = $1 AND account_id = $2",
      [messageId, account.id],
    );
    const row = rows[0];
    if (!row?.imap_uid || !row.imap_folder) {
      // Fall back to full message record
      const fullRows = await db.select<Message[]>(
        "SELECT * FROM messages WHERE id = $1 AND account_id = $2",
        [messageId, account.id],
      );
      return fullRows[0] ?? null;
    }

    const folder = row.imap_folder;
    const uid = row.imap_uid;
    const params = buildImapParams(account);

    const body = await imapFetchMessageBody({ ...params, folder, uid });

    return {
      id: messageId,
      thread_id: "",
      account_id: account.id,
      from_address: body.from_address,
      from_name: body.from_name,
      to_addresses: body.to_addresses,
      cc_addresses: body.cc_addresses,
      bcc_addresses: null,
      subject: body.subject,
      snippet: null,
      body_html: body.body_html,
      body_text: body.body_text,
      date: body.date,
      is_read: true,
      has_attachments: false,
      header_message_id: body.message_id,
      auth_results: null,
      list_unsubscribe: null,
      list_unsubscribe_post: null,
      imap_uid: uid,
      imap_folder: folder,
      message_id_header: body.message_id,
      references_header: body.references,
      in_reply_to_header: body.in_reply_to,
    };
  },

  async modifyLabels(
    account: Account,
    threadId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    const params = buildImapParams(account);

    // Get folder mappings for this account
    const folders = await imapListFolders(params);
    const mappings = mapAllFolders(folders);

    // Get UIDs for this thread
    const db = await getDb();
    const messages = await db.select<
      { imap_uid: number; imap_folder: string }[]
    >(
      "SELECT imap_uid, imap_folder FROM messages WHERE thread_id = $1 AND account_id = $2 AND imap_uid IS NOT NULL",
      [threadId, account.id],
    );

    if (messages.length === 0) return;

    // Resolve Gmail-style label IDs to IMAP folder paths
    const addFolders = resolveImapFolders(addLabelIds, mappings);

    // Handle flag-based labels (STARRED → \Flagged, UNREAD → remove \Seen)
    const flagOps: { uids: number[]; flags: string[]; add: boolean }[] = [];

    if (addLabelIds.includes("STARRED")) {
      const uids = messages.map((m) => m.imap_uid);
      flagOps.push({ uids, flags: ["\\Flagged"], add: true });
    }
    if (removeLabelIds.includes("STARRED")) {
      const uids = messages.map((m) => m.imap_uid);
      flagOps.push({ uids, flags: ["\\Flagged"], add: false });
    }
    if (addLabelIds.includes("UNREAD")) {
      const uids = messages.map((m) => m.imap_uid);
      flagOps.push({ uids, flags: ["\\Seen"], add: false });
    }
    if (removeLabelIds.includes("UNREAD")) {
      const uids = messages.map((m) => m.imap_uid);
      flagOps.push({ uids, flags: ["\\Seen"], add: true });
    }

    // Apply flag changes
    for (const op of flagOps) {
      // Group by folder
      const byFolder = new Map<string, number[]>();
      for (const msg of messages) {
        const existing = byFolder.get(msg.imap_folder) ?? [];
        existing.push(msg.imap_uid);
        byFolder.set(msg.imap_folder, existing);
      }
      for (const [folder, uids] of byFolder) {
        await imapSetFlags({
          ...params,
          folder,
          uids,
          flags: op.flags,
          add: op.add,
        });
      }
    }

    // Handle folder moves (move messages to destination folders)
    if (addFolders.length > 0) {
      const destination = addFolders[0]!;
      const byFolder = new Map<string, number[]>();
      for (const msg of messages) {
        const existing = byFolder.get(msg.imap_folder) ?? [];
        existing.push(msg.imap_uid);
        byFolder.set(msg.imap_folder, existing);
      }
      for (const [folder, uids] of byFolder) {
        if (folder !== destination) {
          await imapMoveMessages({
            ...params,
            folder,
            uids,
            destination,
          });
        }
      }
    }
  },
};

// ── Factory ────────────────────────────────────────────────────────────

/**
 * Return the appropriate EmailProvider for the given account.
 * Gmail API accounts use the Gmail REST API; IMAP accounts use
 * the Rust-backed IMAP/SMTP Tauri commands.
 */
export function getEmailProvider(account: Account): EmailProvider {
  if (account.provider === "imap") {
    return imapProvider;
  }
  return gmailProvider;
}
