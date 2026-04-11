import type { Account, ComposerAttachment } from "../../types";
import { authenticatedFetch } from "./api";

export interface SendEmailOptions {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  threadId?: string | null;
  attachments?: ComposerAttachment[];
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

function generateBoundary(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "----=_Part_";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function buildRfc2822(
  from: string,
  options: SendEmailOptions,
): string {
  const hasAttachments =
    options.attachments != null && options.attachments.length > 0;
  const boundary = hasAttachments ? generateBoundary() : null;

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

  if (options.inReplyTo) {
    lines.push(`In-Reply-To: ${options.inReplyTo}`);
  }
  if (options.references) {
    lines.push(`References: ${options.references}`);
  }

  if (hasAttachments && boundary) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push("");
    // Text body part
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/plain; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(options.body);

    // Attachment parts
    for (const attachment of options.attachments!) {
      lines.push(`--${boundary}`);
      lines.push(
        `Content-Type: ${attachment.mime_type}; name="${attachment.filename}"`,
      );
      lines.push("Content-Transfer-Encoding: base64");
      lines.push(
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
      );
      lines.push("");
      // Break base64 data into 76-character lines per RFC 2045
      const raw = attachment.data;
      for (let i = 0; i < raw.length; i += 76) {
        lines.push(raw.slice(i, i + 76));
      }
    }

    lines.push(`--${boundary}--`);
  } else {
    lines.push("Content-Type: text/plain; charset=UTF-8");
    // Header/body separator
    lines.push("");
    lines.push(options.body);
  }

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
