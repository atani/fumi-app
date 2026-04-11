import { create } from "zustand";
import type { Message } from "../types";

export type ComposerMode = "compose" | "reply" | "replyAll" | "forward";

interface ComposerState {
  isOpen: boolean;
  mode: ComposerMode;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  replyToMessage: Message | null;
  inReplyTo: string | null;
  references: string | null;

  openCompose: () => void;
  openReply: (message: Message) => void;
  openReplyAll: (message: Message, selfEmail: string) => void;
  openForward: (message: Message) => void;
  close: () => void;
  updateField: (field: "to" | "cc" | "bcc" | "subject" | "body", value: string) => void;
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

const initialState = {
  isOpen: false,
  mode: "compose" as ComposerMode,
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  replyToMessage: null as Message | null,
  inReplyTo: null as string | null,
  references: null as string | null,
};

export const useComposerStore = create<ComposerState>((set) => ({
  ...initialState,

  openCompose: () =>
    set({
      ...initialState,
      isOpen: true,
      mode: "compose",
    }),

  openReply: (message) =>
    set({
      ...initialState,
      isOpen: true,
      mode: "reply",
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
      subject: buildForwardSubject(message.subject),
      body: buildQuotedBody(message),
      replyToMessage: message,
      inReplyTo: null,
      references: null,
    }),

  close: () => set(initialState),

  updateField: (field, value) => set({ [field]: value }),
}));
