export interface Account {
  id: string;
  email: string;
  name: string;
  picture: string;
  provider: "gmail_api" | "imap";
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: number | null;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_security?: "ssl" | "starttls" | "none" | null;
  imap_username?: string | null;
  imap_password?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_security?: "ssl" | "starttls" | "none" | null;
  created_at?: string;
  updated_at?: string;
}

export interface Thread {
  id: string;
  account_id: string;
  snippet: string;
  subject: string;
  last_message_at: string | null;
  message_count: number;
  is_read: boolean;
  is_starred: boolean;
}

export interface Message {
  id: string;
  thread_id: string;
  account_id: string;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string | null;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  subject: string | null;
  snippet: string | null;
  body_html: string | null;
  body_text: string | null;
  date: string | null;
  is_read: boolean;
  has_attachments: boolean;
  header_message_id: string | null;
}

export interface Label {
  id: string;
  account_id: string;
  name: string;
  type: "system" | "user";
  color: string | null;
}

export interface GmailTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface GmailUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface GmailThread {
  id: string;
  snippet: string;
  historyId: string;
  messages?: GmailMessage[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType: string;
    body?: { data?: string; size: number };
    parts?: GmailMessagePart[];
  };
  internalDate: string;
}

export interface GmailMessagePart {
  mimeType: string;
  body?: { data?: string; size: number };
  parts?: GmailMessagePart[];
}
