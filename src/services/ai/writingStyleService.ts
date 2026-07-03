import type { Account, Message, WritingStyleProfile } from "../../types";
import { getDb } from "../db/connection";
import { callAI, getAIConfig } from "./providerManager";
import { AiNotConfiguredError } from "./errors";

/**
 * Fetch the cached writing style profile for an account, or null if none exists.
 */
export async function getWritingStyleProfile(
  accountId: string,
): Promise<WritingStyleProfile | null> {
  const db = await getDb();
  const rows = await db.select<WritingStyleProfile[]>(
    "SELECT * FROM writing_style_profiles WHERE account_id = $1",
    [accountId],
  );
  return rows[0] ?? null;
}

/**
 * Analyze the user's writing style from their recent sent messages.
 * Fetches the last 20 sent messages, sends them to AI for style analysis,
 * and caches the result in the writing_style_profiles table.
 */
export async function analyzeWritingStyle(
  account: Account,
): Promise<WritingStyleProfile> {
  const config = await getAIConfig();
  if (!config) {
    throw new AiNotConfiguredError();
  }

  const db = await getDb();

  // Fetch the user's recent sent messages (matched by from_address)
  const sentMessages = await db.select<Message[]>(
    `SELECT * FROM messages
     WHERE account_id = $1 AND from_address = $2
     ORDER BY date DESC
     LIMIT 20`,
    [account.id, account.email],
  );

  if (sentMessages.length === 0) {
    throw new Error(
      "No sent messages found. Send some emails first so the AI can learn your style.",
    );
  }

  const samples = sentMessages
    .map((m, i) => {
      const body = m.body_text ?? m.snippet ?? "";
      return `--- Email ${i + 1} ---\nSubject: ${m.subject ?? "(no subject)"}\n\n${body}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a writing style analyst. Analyze the user's email writing style from their sent messages below. Provide:
1. A concise style summary (tone, formality level, typical greeting/closing patterns, sentence structure preferences, characteristic vocabulary)
2. A list of 5-10 sample phrases or expressions the user frequently uses

Return your response as JSON with two fields:
- "style_summary": a paragraph describing their style
- "sample_phrases": a comma-separated list of characteristic phrases

Return ONLY the JSON, no other text.`;

  const response = await callAI(
    config.provider,
    config.apiKey,
    systemPrompt,
    samples,
  );

  let styleSummary = "";
  let samplePhrases = "";

  try {
    const cleaned = response.text
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      style_summary?: string;
      sample_phrases?: string;
    };
    styleSummary = parsed.style_summary ?? "";
    samplePhrases = parsed.sample_phrases ?? "";
  } catch {
    // If JSON parsing fails, use the raw response as the summary
    styleSummary = response.text;
  }

  // Upsert the profile
  await db.execute(
    `INSERT INTO writing_style_profiles (account_id, style_summary, sample_phrases, updated_at)
     VALUES ($1, $2, $3, datetime('now'))
     ON CONFLICT(account_id) DO UPDATE SET
       style_summary = $2,
       sample_phrases = $3,
       updated_at = datetime('now')`,
    [account.id, styleSummary, samplePhrases],
  );

  return {
    account_id: account.id,
    style_summary: styleSummary,
    sample_phrases: samplePhrases,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Generate an auto-draft reply using the user's writing style profile.
 * Falls back to a generic style if no profile is cached.
 */
export async function generateAutoReply(
  account: Account,
  messages: Message[],
): Promise<string> {
  const config = await getAIConfig();
  if (!config) {
    throw new AiNotConfiguredError();
  }

  // Try to load the writing style profile
  const profile = await getWritingStyleProfile(account.id);

  const styleContext = profile
    ? `The user's writing style: ${profile.style_summary}\nCharacteristic phrases: ${profile.sample_phrases}`
    : "No writing style profile is available. Use a professional, concise tone.";

  const threadContent = messages
    .map((m) => {
      const from = m.from_name
        ? `${m.from_name} <${m.from_address}>`
        : (m.from_address ?? "unknown");
      const date = m.date ?? "unknown date";
      const body = m.body_text ?? m.snippet ?? "";
      return `From: ${from}\nDate: ${date}\nSubject: ${m.subject ?? "(no subject)"}\n\n${body}`;
    })
    .join("\n---\n");

  const systemPrompt = `You are an email drafting assistant. Write a reply to the email thread below, matching the user's personal writing style.

${styleContext}

Guidelines:
- Match the user's tone, formality, and characteristic phrases
- Keep the reply concise and on-topic
- Do not include email headers (From, To, Subject, Date) in the reply
- Do not use markdown formatting
- Write only the reply body text`;

  const response = await callAI(
    config.provider,
    config.apiKey,
    systemPrompt,
    threadContent,
  );

  return response.text;
}
