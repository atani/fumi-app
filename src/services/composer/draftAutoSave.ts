import { getDb } from "../db/connection";
import { useComposerStore } from "../../stores/composerStore";
import type { ComposerMode } from "../../stores/composerStore";

export interface LocalDraft {
  id: string;
  account_id: string | null;
  mode: ComposerMode;
  to_addresses: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  reply_to_message_id: string | null;
  in_reply_to: string | null;
  reference_headers: string | null;
  created_at: string;
  updated_at: string;
}

export async function saveDraft(
  draftId: string,
  accountId: string | null,
  state: {
    mode: ComposerMode;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
    replyToMessageId: string | null;
    inReplyTo: string | null;
    references: string | null;
  },
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO local_drafts (id, account_id, mode, to_addresses, cc, bcc, subject, body, reply_to_message_id, in_reply_to, reference_headers, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       account_id = excluded.account_id,
       mode = excluded.mode,
       to_addresses = excluded.to_addresses,
       cc = excluded.cc,
       bcc = excluded.bcc,
       subject = excluded.subject,
       body = excluded.body,
       reply_to_message_id = excluded.reply_to_message_id,
       in_reply_to = excluded.in_reply_to,
       reference_headers = excluded.reference_headers,
       updated_at = datetime('now')`,
    [
      draftId,
      accountId,
      state.mode,
      state.to,
      state.cc,
      state.bcc,
      state.subject,
      state.body,
      state.replyToMessageId,
      state.inReplyTo,
      state.references,
    ],
  );
}

export async function loadDrafts(accountId?: string): Promise<LocalDraft[]> {
  const db = await getDb();
  if (accountId) {
    return db.select<LocalDraft[]>(
      "SELECT * FROM local_drafts WHERE account_id = $1 ORDER BY updated_at DESC",
      [accountId],
    );
  }
  return db.select<LocalDraft[]>(
    "SELECT * FROM local_drafts ORDER BY updated_at DESC",
  );
}

export async function deleteDraft(draftId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM local_drafts WHERE id = $1", [draftId]);
}

let unsubscribe: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const AUTO_SAVE_DEBOUNCE_MS = 3000;

export type AutoSaveCallback = () => void;

export function startAutoSave(
  getAccountId: () => string | null,
  onSaved?: AutoSaveCallback,
): void {
  stopAutoSave();

  let lastSnapshot = "";

  unsubscribe = useComposerStore.subscribe((state) => {
    if (!state.isOpen || !state.draftId) {
      return;
    }

    const snapshot = JSON.stringify({
      to: state.to,
      cc: state.cc,
      bcc: state.bcc,
      subject: state.subject,
      body: state.body,
    });

    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      const current = useComposerStore.getState();
      if (!current.isOpen || !current.draftId) return;

      saveDraft(current.draftId, getAccountId(), {
        mode: current.mode,
        to: current.to,
        cc: current.cc,
        bcc: current.bcc,
        subject: current.subject,
        body: current.body,
        replyToMessageId: current.replyToMessage?.id ?? null,
        inReplyTo: current.inReplyTo,
        references: current.references,
      })
        .then(() => {
          onSaved?.();
        })
        .catch((err: unknown) => {
          console.error("Draft auto-save failed:", err);
        });
    }, AUTO_SAVE_DEBOUNCE_MS);
  });
}

export function stopAutoSave(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
