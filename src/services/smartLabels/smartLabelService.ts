import type { Message, SmartLabelRule } from "../../types";
import { getDb } from "../db/connection";
import { callAI, getAIConfig } from "../ai/providerManager";

export interface SmartLabelCriteria {
  senderPattern?: string;
  subjectPattern?: string;
}

/**
 * Parse the criteria JSON from a smart label rule.
 */
function parseCriteria(criteriaJson: string): SmartLabelCriteria {
  try {
    return JSON.parse(criteriaJson) as SmartLabelCriteria;
  } catch {
    return {};
  }
}

/**
 * Fast path: check if a message matches a rule's criteria via pattern matching.
 * Returns true if all non-empty criteria match.
 */
function matchesCriteria(
  message: Message,
  criteria: SmartLabelCriteria,
): boolean {
  const hasCriteria =
    Boolean(criteria.senderPattern) || Boolean(criteria.subjectPattern);
  if (!hasCriteria) return false;

  if (criteria.senderPattern) {
    const sender = (message.from_address ?? "").toLowerCase();
    const pattern = criteria.senderPattern.toLowerCase();
    if (!sender.includes(pattern)) return false;
  }

  if (criteria.subjectPattern) {
    const subject = (message.subject ?? "").toLowerCase();
    const pattern = criteria.subjectPattern.toLowerCase();
    if (!subject.includes(pattern)) return false;
  }

  return true;
}

/**
 * Get all enabled smart label rules for an account.
 */
export async function getSmartLabelRules(
  accountId: string,
): Promise<SmartLabelRule[]> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      label_id: string;
      description: string;
      criteria: string;
      enabled: number;
    }[]
  >(
    "SELECT * FROM smart_label_rules WHERE account_id = $1 AND enabled = 1",
    [accountId],
  );
  return rows.map((r) => ({
    ...r,
    enabled: r.enabled === 1,
  }));
}

/**
 * Get all smart label rules (including disabled) for an account.
 */
export async function getAllSmartLabelRules(
  accountId: string,
): Promise<SmartLabelRule[]> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      label_id: string;
      description: string;
      criteria: string;
      enabled: number;
    }[]
  >(
    "SELECT * FROM smart_label_rules WHERE account_id = $1",
    [accountId],
  );
  return rows.map((r) => ({
    ...r,
    enabled: r.enabled === 1,
  }));
}

/**
 * Save (insert or update) a smart label rule.
 */
export async function saveSmartLabelRule(
  rule: SmartLabelRule,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO smart_label_rules (id, account_id, label_id, description, criteria, enabled)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(id) DO UPDATE SET
       label_id = $3,
       description = $4,
       criteria = $5,
       enabled = $6`,
    [
      rule.id,
      rule.account_id,
      rule.label_id,
      rule.description,
      rule.criteria,
      rule.enabled ? 1 : 0,
    ],
  );
}

/**
 * Delete a smart label rule.
 */
export async function deleteSmartLabelRule(ruleId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM smart_label_rules WHERE id = $1", [ruleId]);
}

/**
 * Two-phase classification: first try criteria fast path, then fall back to AI.
 * Returns the label_id to apply, or null if no rule matches.
 */
export async function classifyMessage(
  message: Message,
  accountId: string,
): Promise<string | null> {
  const rules = await getSmartLabelRules(accountId);
  if (rules.length === 0) return null;

  // Phase 1: Criteria fast path
  for (const rule of rules) {
    const criteria = parseCriteria(rule.criteria);
    if (matchesCriteria(message, criteria)) {
      return rule.label_id;
    }
  }

  // Phase 2: AI classification fallback
  const config = await getAIConfig();
  if (!config) return null;

  const ruleDescriptions = rules
    .map((r) => `- Label "${r.label_id}": ${r.description}`)
    .join("\n");

  const messageContext = [
    `From: ${message.from_address ?? "unknown"}`,
    `Subject: ${message.subject ?? "(no subject)"}`,
    `Snippet: ${message.snippet ?? message.body_text?.slice(0, 200) ?? ""}`,
  ].join("\n");

  const systemPrompt = `You are an email classifier. Given the email details and the label rules below, determine which label (if any) should be applied. Return ONLY the label_id if a match is found, or "none" if no rule applies.

Rules:
${ruleDescriptions}`;

  try {
    const response = await callAI(
      config.provider,
      config.apiKey,
      systemPrompt,
      messageContext,
    );

    const result = response.text.trim();
    if (result === "none") return null;

    // Verify the returned label_id is actually one of our rules
    const matchingRule = rules.find((r) => r.label_id === result);
    return matchingRule ? result : null;
  } catch {
    // AI call failed, skip classification
    return null;
  }
}
