import type { Account } from "../../types";
import { authenticatedFetch } from "./api";

interface GmailLabel {
  id: string;
  name: string;
  type: string;
  color?: {
    textColor: string;
    backgroundColor: string;
  };
}

/**
 * Create a new user label via the Gmail API.
 */
export async function createGmailLabel(
  account: Account,
  name: string,
  color?: string,
): Promise<GmailLabel> {
  const body: Record<string, unknown> = {
    name,
    labelListVisibility: "labelShow",
    messageListVisibility: "show",
  };

  if (color) {
    body.color = {
      textColor: "#ffffff",
      backgroundColor: color,
    };
  }

  return authenticatedFetch<GmailLabel>(account, "/labels", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Update an existing label's name or color via the Gmail API.
 */
export async function updateGmailLabel(
  account: Account,
  labelId: string,
  name: string,
  color?: string,
): Promise<GmailLabel> {
  const body: Record<string, unknown> = { name };

  if (color) {
    body.color = {
      textColor: "#ffffff",
      backgroundColor: color,
    };
  }

  return authenticatedFetch<GmailLabel>(account, `/labels/${labelId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Delete a user label via the Gmail API.
 */
export async function deleteGmailLabel(
  account: Account,
  labelId: string,
): Promise<void> {
  await authenticatedFetch(account, `/labels/${labelId}`, {
    method: "DELETE",
  });
}

/**
 * Add a label to a thread via the Gmail API modifyThread endpoint.
 */
export async function addLabelToThread(
  account: Account,
  threadId: string,
  labelId: string,
): Promise<void> {
  await authenticatedFetch(account, `/threads/${threadId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds: [labelId],
      removeLabelIds: [],
    }),
  });
}

/**
 * Remove a label from a thread via the Gmail API modifyThread endpoint.
 */
export async function removeLabelFromThread(
  account: Account,
  threadId: string,
  labelId: string,
): Promise<void> {
  await authenticatedFetch(account, `/threads/${threadId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds: [],
      removeLabelIds: [labelId],
    }),
  });
}
