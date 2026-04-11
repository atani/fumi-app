import type { Account, Message, Thread } from "../../types";

export interface SyncResult {
  threads: Thread[];
  newThreads: Thread[];
}

export interface FolderInfo {
  name: string;
  delimiter: string;
  flags: string[];
  specialUse?: string;
}

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string;
}

export interface EmailProvider {
  /**
   * Synchronize inbox and return synced/new threads.
   * For Gmail this uses the History API; for IMAP it uses UID-based delta sync.
   */
  sync(account: Account): Promise<SyncResult>;

  /**
   * Sync label/folder metadata for the account.
   */
  syncLabels(account: Account): Promise<void>;

  /**
   * Send an email through this provider.
   */
  send(account: Account, params: SendEmailParams): Promise<string>;

  /**
   * List available folders/labels.
   */
  listFolders(account: Account): Promise<FolderInfo[]>;

  /**
   * Fetch a single message body by ID.
   */
  fetchMessage(
    account: Account,
    messageId: string,
  ): Promise<Message | null>;

  /**
   * Modify labels/flags on a thread.
   */
  modifyLabels(
    account: Account,
    threadId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void>;
}
