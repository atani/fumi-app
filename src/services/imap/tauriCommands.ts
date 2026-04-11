import { invoke } from "@tauri-apps/api/core";

export interface ImapFolder {
  name: string;
  delimiter: string;
  flags: string[];
}

export interface ImapMessage {
  uid: number;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string | null;
  cc_addresses: string | null;
  date: string | null;
  is_read: boolean;
  has_attachments: boolean;
  snippet: string | null;
  message_id: string | null;
  references: string | null;
  in_reply_to: string | null;
}

export interface ImapMessageBody {
  uid: number;
  body_html: string | null;
  body_text: string | null;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string | null;
  cc_addresses: string | null;
  date: string | null;
  message_id: string | null;
  references: string | null;
  in_reply_to: string | null;
}

export interface ImapConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  security: "ssl" | "starttls" | "none";
}

export interface SmtpConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  security: "ssl" | "starttls" | "none";
}

export interface EmailRecipient {
  address: string;
  name?: string;
}

export async function imapTestConnection(
  params: ImapConnectionParams,
): Promise<boolean> {
  return invoke<boolean>("imap_test_connection", { ...params });
}

export async function imapListFolders(
  params: ImapConnectionParams,
): Promise<ImapFolder[]> {
  return invoke<ImapFolder[]>("imap_list_folders", { ...params });
}

export async function imapFetchMessages(
  params: ImapConnectionParams & { folder: string; count: number },
): Promise<ImapMessage[]> {
  return invoke<ImapMessage[]>("imap_fetch_messages", { ...params });
}

export async function imapFetchMessageBody(
  params: ImapConnectionParams & { folder: string; uid: number },
): Promise<ImapMessageBody> {
  return invoke<ImapMessageBody>("imap_fetch_message_body", { ...params });
}

export async function smtpTestConnection(
  params: SmtpConnectionParams,
): Promise<boolean> {
  return invoke<boolean>("smtp_test_connection", { ...params });
}

export async function smtpSendEmail(
  params: SmtpConnectionParams & {
    from: EmailRecipient;
    to: EmailRecipient[];
    cc: EmailRecipient[];
    bcc: EmailRecipient[];
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
    inReplyTo?: string;
    references?: string;
  },
): Promise<string> {
  return invoke<string>("smtp_send_email", {
    ...params,
    body_text: params.bodyText ?? null,
    body_html: params.bodyHtml ?? null,
    in_reply_to: params.inReplyTo ?? null,
    references: params.references ?? null,
  });
}
