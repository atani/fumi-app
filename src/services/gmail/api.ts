import type { Account, GmailThread, GmailMessage, GmailMessagePart, Attachment } from "../../types";
import { withTokenRefresh } from "./tokenManager";

const BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Makes an authenticated Gmail API request for the given account.
 * Automatically refreshes the access token if expired or on 401.
 */
export async function authenticatedFetch<T>(
  account: Account,
  path: string,
  options?: RequestInit,
): Promise<T> {
  return withTokenRefresh(account, (token) =>
    gmailFetch<T>(token, path, options),
  );
}

export async function listThreads(
  accessToken: string,
  labelIds: string[] = ["INBOX"],
  maxResults = 50,
  pageToken?: string,
): Promise<{ threads: { id: string; snippet: string }[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  for (const label of labelIds) {
    params.append("labelIds", label);
  }
  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  return gmailFetch(accessToken, `/threads?${params}`);
}

export async function getThread(
  accessToken: string,
  threadId: string,
  format: "full" | "metadata" | "minimal" = "full",
): Promise<GmailThread> {
  return gmailFetch(accessToken, `/threads/${threadId}?format=${format}`);
}

export async function getMessage(
  accessToken: string,
  messageId: string,
  format: "full" | "metadata" | "minimal" = "full",
): Promise<GmailMessage> {
  return gmailFetch(accessToken, `/messages/${messageId}?format=${format}`);
}

export async function modifyThread(
  accessToken: string,
  threadId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  await gmailFetch(accessToken, `/threads/${threadId}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

export async function listLabels(
  accessToken: string,
): Promise<{ labels: { id: string; name: string; type: string }[] }> {
  return gmailFetch(accessToken, "/labels");
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export function getHeader(
  message: GmailMessage,
  name: string,
): string | undefined {
  return message.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )?.value;
}

/**
 * Fetch the raw bytes of a Gmail attachment as a base64url-encoded string.
 */
export async function getAttachmentData(
  account: Account,
  messageId: string,
  attachmentId: string,
): Promise<string> {
  const result = await authenticatedFetch<{ data: string }>(
    account,
    `/messages/${messageId}/attachments/${attachmentId}`,
  );
  return result.data;
}

/**
 * Extract attachment metadata from a Gmail message's payload parts.
 */
export function extractAttachments(
  message: GmailMessage,
  accountId: string,
): Attachment[] {
  const attachments: Attachment[] = [];

  function walk(parts: GmailMessagePart[] | undefined): void {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body) {
        const contentIdHeader = part.headers?.find(
          (h) => h.name.toLowerCase() === "content-id",
        );
        attachments.push({
          id: part.body.attachmentId ?? `${message.id}-${part.partId ?? "0"}`,
          message_id: message.id,
          account_id: accountId,
          filename: part.filename,
          mime_type: part.mimeType,
          size: part.body.size,
          content_id: contentIdHeader?.value ?? null,
          cached_at: null,
          cache_size: null,
        });
      }
      if (part.parts) {
        walk(part.parts);
      }
    }
  }

  // Check top-level parts
  walk(message.payload.parts);

  return attachments;
}

export function getMessageBody(message: GmailMessage): string {
  const findBody = (
    parts: GmailMessage["payload"]["parts"],
    mimeType: string,
  ): string | null => {
    if (!parts) return null;
    for (const part of parts) {
      if (part.mimeType === mimeType && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        const found = findBody(part.parts, mimeType);
        if (found) return found;
      }
    }
    return null;
  };

  if (message.payload.body?.data) {
    return decodeBase64Url(message.payload.body.data);
  }

  return (
    findBody(message.payload.parts, "text/html") ??
    findBody(message.payload.parts, "text/plain") ??
    ""
  );
}
