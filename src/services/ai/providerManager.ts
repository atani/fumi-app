import { getDb } from "../db/connection";

export type AIProvider = "claude" | "openai" | "gemini";

interface AIResponse {
  text: string;
}

async function loadAISetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function getAIConfig(): Promise<{
  provider: AIProvider;
  apiKey: string;
} | null> {
  const [provider, apiKey] = await Promise.all([
    loadAISetting("ai_provider"),
    loadAISetting("ai_api_key"),
  ]);

  if (!provider || !apiKey) return null;

  return {
    provider: provider as AIProvider,
    apiKey,
  };
}

export async function callAI(
  provider: AIProvider,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<AIResponse> {
  switch (provider) {
    case "claude":
      return callClaude(apiKey, systemPrompt, userPrompt);
    case "openai":
      return callOpenAI(apiKey, systemPrompt, userPrompt);
    case "gemini":
      return callGemini(apiKey, systemPrompt, userPrompt);
    default:
      throw new Error(`Unsupported AI provider: ${String(provider)}`);
  }
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<AIResponse> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[];
  };
  const textBlock = data.content.find((c) => c.type === "text");
  return { text: textBlock?.text ?? "" };
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<AIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return { text: data.choices[0]?.message.content ?? "" };
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<AIResponse> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return { text: data.candidates[0]?.content.parts[0]?.text ?? "" };
}
