import type { GmailThread, GmailMessage } from "../../types";

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
  return atob(base64);
}

export function getHeader(
  message: GmailMessage,
  name: string,
): string | undefined {
  return message.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )?.value;
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
