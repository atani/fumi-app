import type { Message } from "../../types";
import { getDb } from "../db/connection";
import { callAI, getAIConfig } from "./providerManager";

export type ThreadCategory =
  | "Primary"
  | "Updates"
  | "Promotions"
  | "Social"
  | "Newsletters";

function formatMessagesForPrompt(messages: Message[]): string {
  return messages
    .map((m) => {
      const from = m.from_name
        ? `${m.from_name} <${m.from_address}>`
        : (m.from_address ?? "unknown");
      const date = m.date ?? "unknown date";
      const body = m.body_text ?? m.snippet ?? "";
      return `From: ${from}\nDate: ${date}\nSubject: ${m.subject ?? "(no subject)"}\n\n${body}`;
    })
    .join("\n---\n");
}

async function getCachedResult(
  threadId: string,
  accountId: string,
  type: string,
): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ result: string }[]>(
    "SELECT result FROM ai_cache WHERE thread_id = $1 AND account_id = $2 AND type = $3",
    [threadId, accountId, type],
  );
  return rows[0]?.result ?? null;
}

async function setCachedResult(
  threadId: string,
  accountId: string,
  type: string,
  result: string,
): Promise<void> {
  const db = await getDb();
  const id = `${type}-${threadId}-${accountId}`;
  await db.execute(
    "INSERT INTO ai_cache (id, thread_id, account_id, type, result) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET result = $5, created_at = datetime('now')",
    [id, threadId, accountId, type, result],
  );
}

export async function summarizeThread(
  messages: Message[],
  threadId: string,
  accountId: string,
): Promise<string> {
  const cached = await getCachedResult(threadId, accountId, "summary");
  if (cached) return cached;

  const config = await getAIConfig();
  if (!config) throw new Error("AI is not configured. Set an API key in Settings.");

  const systemPrompt =
    "You are an email assistant. Summarize the email thread in 2-3 concise sentences. Focus on the key points and any action items. Do not use markdown formatting.";
  const userPrompt = formatMessagesForPrompt(messages);

  const response = await callAI(
    config.provider,
    config.apiKey,
    systemPrompt,
    userPrompt,
  );

  await setCachedResult(threadId, accountId, "summary", response.text);
  return response.text;
}

export async function suggestReplies(
  messages: Message[],
  threadId: string,
  accountId: string,
): Promise<string[]> {
  const cached = await getCachedResult(threadId, accountId, "replies");
  if (cached) {
    try {
      return JSON.parse(cached) as string[];
    } catch {
      // Cached value is corrupt, regenerate
    }
  }

  const config = await getAIConfig();
  if (!config) throw new Error("AI is not configured. Set an API key in Settings.");

  const systemPrompt =
    "You are an email assistant. Based on the email thread, suggest 3 short reply options. Each reply should be 1-2 sentences. Return ONLY a JSON array of 3 strings, no other text.";
  const userPrompt = formatMessagesForPrompt(messages);

  const response = await callAI(
    config.provider,
    config.apiKey,
    systemPrompt,
    userPrompt,
  );

  let replies: string[];
  try {
    // Handle case where response might have markdown code fences
    const cleaned = response.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    replies = JSON.parse(cleaned) as string[];
  } catch {
    // Fallback: split by newlines if JSON parsing fails
    replies = response.text
      .split("\n")
      .map((line) => line.replace(/^\d+\.\s*/, "").replace(/^["']|["']$/g, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 3);
  }

  await setCachedResult(threadId, accountId, "replies", JSON.stringify(replies));
  return replies;
}

export async function categorizeThread(
  messages: Message[],
  threadId: string,
  accountId: string,
): Promise<ThreadCategory> {
  const cached = await getCachedResult(threadId, accountId, "category");
  if (cached) return cached as ThreadCategory;

  const config = await getAIConfig();
  if (!config) throw new Error("AI is not configured. Set an API key in Settings.");

  const systemPrompt =
    "You are an email categorizer. Classify the email thread into exactly one of these categories: Primary, Updates, Promotions, Social, Newsletters. Return ONLY the category name, nothing else.";
  const userPrompt = formatMessagesForPrompt(messages);

  const response = await callAI(
    config.provider,
    config.apiKey,
    systemPrompt,
    userPrompt,
  );

  const category = response.text.trim() as ThreadCategory;
  const validCategories: ThreadCategory[] = [
    "Primary",
    "Updates",
    "Promotions",
    "Social",
    "Newsletters",
  ];

  const result = validCategories.includes(category) ? category : "Primary";

  // Store in both cache and thread_categories table
  await setCachedResult(threadId, accountId, "category", result);
  const db = await getDb();
  await db.execute(
    "INSERT INTO thread_categories (thread_id, account_id, category) VALUES ($1, $2, $3) ON CONFLICT(thread_id, account_id) DO UPDATE SET category = $3",
    [threadId, accountId, result],
  );

  return result;
}
