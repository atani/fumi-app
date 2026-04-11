import type { Account } from "../../types";
import { getDb } from "../db/connection";
import { callAI, getAIConfig } from "./providerManager";

/**
 * Ask a natural language question about the user's inbox.
 * Fetches recent thread summaries from the local DB and sends them
 * along with the question to the configured AI provider.
 */
export async function askInbox(
  account: Account,
  question: string,
): Promise<string> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error("AI is not configured. Set an API key in Settings.");
  }

  const db = await getDb();

  // Fetch recent threads with their latest message snippet for context
  const threads = await db.select<
    {
      id: string;
      subject: string;
      snippet: string;
      last_message_at: string | null;
      is_read: number;
      is_starred: number;
    }[]
  >(
    `SELECT t.id, t.subject, t.snippet, t.last_message_at, t.is_read, t.is_starred
     FROM threads t
     WHERE t.account_id = $1
     ORDER BY t.last_message_at DESC
     LIMIT 50`,
    [account.id],
  );

  if (threads.length === 0) {
    return "Your inbox appears to be empty. There are no threads to analyze.";
  }

  // Build context from recent threads
  const threadContext = threads
    .map((t, i) => {
      const read = t.is_read ? "read" : "unread";
      const starred = t.is_starred ? ", starred" : "";
      const date = t.last_message_at ?? "unknown date";
      return `${i + 1}. [${read}${starred}] "${t.subject || "(no subject)"}" (${date})\n   ${t.snippet || ""}`;
    })
    .join("\n");

  const systemPrompt = `You are an email inbox assistant. The user will ask a question about their inbox. Below is a summary of their recent email threads. Answer the question based on this data. Be concise and helpful. If the answer cannot be determined from the available data, say so.

Recent threads:
${threadContext}`;

  const response = await callAI(
    config.provider,
    config.apiKey,
    systemPrompt,
    question,
  );

  return response.text;
}
