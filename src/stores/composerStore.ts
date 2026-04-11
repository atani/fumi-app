import { create } from "zustand";
import type { Message, ComposerAttachment } from "../types";

export type ComposerMode = "compose" | "reply" | "replyAll" | "forward";

interface ComposerState {
  isOpen: boolean;
  mode: ComposerMode;
  draftId: string | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  replyToMessage: Message | null;
  inReplyTo: string | null;
  references: string | null;
  attachments: ComposerAttachment[];

  openCompose: () => void;
  openReply: (message: Message) => void;
  openReplyAll: (message: Message, selfEmail: string) => void;
  openForward: (message: Message) => void;
  restoreDraft: (draft: {
    id: string;
    mode: ComposerMode;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
    inReplyTo: string | null;
    references: string | null;
  }) => void;
  close: () => void;
  updateField: (field: "to" | "cc" | "bcc" | "subject" | "body", value: string) => void;
  addAttachment: (attachment: ComposerAttachment) => void;
  removeAttachment: (id: string) => void;
}

function buildQuotedBody(message: Message): string {
  const date = message.date
    ? new Date(message.date).toLocaleString()
    : "unknown date";
  const from = message.from_name
    ? `${message.from_name} <${message.from_address}>`
    : (message.from_address ?? "unknown");

  const originalText = message.body_text ?? message.snippet ?? "";

  return `\n\nOn ${date}, ${from} wrote:\n${originalText
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}`;
}

function buildReplySubject(subject: string | null): string {
  if (!subject) return "Re: ";
  if (/^Re:/i.test(subject)) return subject;
  return `Re: ${subject}`;
}

function buildForwardSubject(subject: string | null): string {
  if (!subject) return "Fwd: ";
  if (/^Fwd:/i.test(subject)) return subject;
  return `Fwd: ${subject}`;
}

/** Collect all recipients excluding self, return as comma-separated string. */
function buildReplyAllTo(message: Message, selfEmail: string): { to: string; cc: string } {
  const from = message.from_address ?? "";
  const toAddrs = (message.to_addresses ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const ccAddrs = (message.cc_addresses ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const selfLower = selfEmail.toLowerCase();

  // To: original sender + any To recipients except self
  const toList = [from, ...toAddrs].filter(
    (addr) => addr.toLowerCase() !== selfLower,
  );
  // CC: original CC recipients except self
  const ccList = ccAddrs.filter(
    (addr) => addr.toLowerCase() !== selfLower,
  );

  return {
    to: [...new Set(toList)].join(", "),
    cc: [...new Set(ccList)].join(", "),
  };
}

function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const initialState = {
  isOpen: false,
  mode: "compose" as ComposerMode,
  draftId: null as string | null,
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  replyToMessage: null as Message | null,
  inReplyTo: null as string | null,
  references: null as string | null,
  attachments: [] as ComposerAttachment[],
};

export const useComposerStore = create<ComposerState>((set) => ({
  ...initialState,

  openCompose: () =>
    set({
      ...initialState,
      isOpen: true,
      mode: "compose",
      draftId: generateDraftId(),
    }),

  openReply: (message) =>
    set({
      ...initialState,
      isOpen: true,
      mode: "reply",
      draftId: generateDraftId(),
      to: message.from_address ?? "",
      subject: buildReplySubject(message.subject),
      body: buildQuotedBody(message),
      replyToMessage: message,
      inReplyTo: message.header_message_id,
      references: message.header_message_id,
    }),

  openReplyAll: (message, selfEmail) => {
    const { to, cc } = buildReplyAllTo(message, selfEmail);
    set({
      ...initialState,
      isOpen: true,
      mode: "replyAll",
      draftId: generateDraftId(),
      to,
      cc,
      subject: buildReplySubject(message.subject),
      body: buildQuotedBody(message),
      replyToMessage: message,
      inReplyTo: message.header_message_id,
      references: message.header_message_id,
    });
  },

  openForward: (message) =>
    set({
      ...initialState,
      isOpen: true,
      mode: "forward",
      draftId: generateDraftId(),
      subject: buildForwardSubject(message.subject),
      body: buildQuotedBody(message),
      replyToMessage: message,
      inReplyTo: null,
      references: null,
    }),

  restoreDraft: (draft) =>
    set({
      ...initialState,
      isOpen: true,
      draftId: draft.id,
      mode: draft.mode,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      inReplyTo: draft.inReplyTo,
      references: draft.references,
    }),

  close: () => set(initialState),

  updateField: (field, value) => set({ [field]: value }),

  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...state.attachments, attachment] })),

  removeAttachment: (id) =>
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
    })),
}));
