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

/** Account without sensitive credential fields, safe for UI display. */
export type AccountSummary = Omit<
  Account,
  "access_token" | "refresh_token" | "token_expiry" | "imap_password"
>;

export interface Thread {
  id: string;
  account_id: string;
  snippet: string;
  subject: string;
  last_message_at: string | null;
  message_count: number;
  is_read: boolean;
  is_starred: boolean;
  is_muted: boolean;
  snoozed_until: string | null;
}

export interface NotificationVip {
  email: string;
  account_id: string;
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
  auth_results: string | null;
  list_unsubscribe: string | null;
  list_unsubscribe_post: string | null;
  imap_uid: number | null;
  imap_folder: string | null;
  message_id_header: string | null;
  references_header: string | null;
  in_reply_to_header: string | null;
}

export interface Label {
  id: string;
  account_id: string;
  name: string;
  type: "system" | "user";
  color: string | null;
}

export interface Contact {
  id: number;
  email: string;
  name: string | null;
  frequency: number;
  first_contacted_at: string;
  last_contacted_at: string;
  account_id: string;
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
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; data?: string; size: number };
  parts?: GmailMessagePart[];
}

export interface Attachment {
  id: string;
  message_id: string;
  account_id: string;
  filename: string;
  mime_type: string;
  size: number;
  content_id: string | null;
  cached_at: string | null;
  cache_size: number | null;
}

export interface Template {
  id: string;
  account_id: string | null;
  name: string;
  subject: string | null;
  body: string | null;
  created_at: string;
}

export interface Signature {
  id: string;
  account_id: string | null;
  name: string;
  body: string;
  is_default: number;
  created_at: string;
}

export interface ComposerAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  data: string; // base64-encoded file content
}

export interface FilterCriteria {
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
}

export interface FilterActions {
  applyLabel?: string;
  archive?: boolean;
  trash?: boolean;
  star?: boolean;
  markRead?: boolean;
}

export interface FilterRule {
  id: string;
  account_id: string;
  criteria: FilterCriteria;
  actions: FilterActions;
  enabled: boolean;
  created_at: string;
}

export type PhishingRiskLevel = "safe" | "warning" | "danger";
export type PhishingSensitivity = "low" | "default" | "high";

export interface LinkScanResult {
  id: string;
  message_id: string;
  account_id: string;
  url: string;
  risk_level: PhishingRiskLevel;
  reasons: string;
  scanned_at: string;
}

export interface LinkAnalysis {
  url: string;
  displayText: string | null;
  riskLevel: PhishingRiskLevel;
  reasons: string[];
}

export interface AuthResult {
  spf: "pass" | "fail" | "none" | "unknown";
  dkim: "pass" | "fail" | "none" | "unknown";
  dmarc: "pass" | "fail" | "none" | "unknown";
  verdict: "pass" | "fail" | "warning" | "unknown";
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink?: string;
  colorId?: string;
  status?: string;
  creator?: { email: string; displayName?: string };
  organizer?: { email: string; displayName?: string };
}

export interface BundleRule {
  id: string;
  account_id: string;
  sender_pattern: string;
  bundle_name: string;
  schedule: "instant" | "daily" | "weekly";
  enabled: boolean;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole: string;
}

export type TaskPriority = "high" | "medium" | "low";

export interface Task {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  completed: boolean;
  parent_task_id: string | null;
  source_thread_id: string | null;
  source_message_id: string | null;
  recurrence_rule: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TaskTag {
  id: string;
  name: string;
  color: string | null;
  account_id: string;
}

export interface FollowUpReminder {
  id: string;
  thread_id: string;
  account_id: string;
  remind_after_hours: number;
  created_at: string;
  reminded_at: string | null;
}

export interface ScheduledEmail {
  id: string;
  account_id: string;
  to_addresses: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  body: string;
  attachments: string | null;
  scheduled_at: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  created_at: string;
}

export interface SendAsAlias {
  email: string;
  account_id: string;
  display_name: string;
  is_default: boolean;
  is_primary: boolean;
}

export type QuickStepActionType =
  | "applyLabel"
  | "removeLabel"
  | "archive"
  | "trash"
  | "star"
  | "unstar"
  | "markRead"
  | "markUnread"
  | "forward"
  | "reply"
  | "move"
  | "snooze"
  | "mute"
  | "followUp"
  | "categorize"
  | "addTask"
  | "unsubscribe"
  | "openUrl";

export interface QuickStepAction {
  type: QuickStepActionType;
  params?: Record<string, string>;
}

export interface QuickStep {
  id: string;
  account_id: string;
  name: string;
  icon: string | null;
  actions: QuickStepAction[];
  shortcut: string | null;
  created_at: string;
}

export interface SmartFolder {
  id: string;
  account_id: string;
  name: string;
  query: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface FolderSyncState {
  folder: string;
  account_id: string;
  uidvalidity: number;
  last_uid: number;
  modseq: number | null;
}

export interface WritingStyleProfile {
  account_id: string;
  style_summary: string;
  sample_phrases: string;
  updated_at: string;
}

export interface SmartLabelRule {
  id: string;
  account_id: string;
  label_id: string;
  description: string;
  criteria: string;
  enabled: boolean;
}
