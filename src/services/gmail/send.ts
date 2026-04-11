import type { Account } from "../../types";
import { authenticatedFetch } from "./api";

interface SendEmailOptions {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  threadId?: string | null;
}

function encodeBase64Url(str: string): string {
  const encoded = btoa(
    // Handle multi-byte characters with UTF-8 encoding
    new TextEncoder()
      .encode(str)
      .reduce((acc, byte) => acc + String.fromCharCode(byte), ""),
  );
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRfc2822(
  from: string,
  options: SendEmailOptions,
): string {
  const lines: string[] = [];

  lines.push(`From: ${from}`);
  lines.push(`To: ${options.to}`);
  if (options.cc) {
    lines.push(`Cc: ${options.cc}`);
  }
  if (options.bcc) {
    lines.push(`Bcc: ${options.bcc}`);
  }
  lines.push(`Subject: ${options.subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/plain; charset=UTF-8");

  if (options.inReplyTo) {
    lines.push(`In-Reply-To: ${options.inReplyTo}`);
  }
  if (options.references) {
    lines.push(`References: ${options.references}`);
  }

  // Header/body separator
  lines.push("");
  lines.push(options.body);

  return lines.join("\r\n");
}

export async function sendEmail(
  account: Account,
  options: SendEmailOptions,
): Promise<void> {
  const rawMessage = buildRfc2822(account.email, options);
  const encodedMessage = encodeBase64Url(rawMessage);

  const body: Record<string, string> = { raw: encodedMessage };
  if (options.threadId) {
    body.threadId = options.threadId;
  }

  await authenticatedFetch(account, "/messages/send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
