/**
 * Builds a parameterised SQL query from parsed search operators.
 *
 * Returns a WHERE-clause string and the corresponding bind values array.
 * The query always starts from the `threads` table aliased as `t`.
 * Additional JOINs are appended only when needed.
 */

import type { ParsedSearchQuery } from "./searchParser";
import { hasOperators } from "./searchParser";

export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

export function buildSqlQuery(
  accountId: string,
  parsed: ParsedSearchQuery,
): BuiltQuery {
  const params: unknown[] = [];
  const conditions: string[] = [];
  const joins: string[] = [];

  let paramIdx = 1;
  const addParam = (value: unknown): string => {
    params.push(value);
    return `$${paramIdx++}`;
  };

  // Account filter always applied
  conditions.push(`t.account_id = ${addParam(accountId)}`);

  const needsMessages =
    !!parsed.operators.from?.length ||
    !!parsed.operators.to?.length ||
    !!parsed.operators.subject?.length ||
    !!parsed.operators.hasAttachment ||
    !!parsed.operators.before ||
    !!parsed.operators.after ||
    !!parsed.freeText;

  const needsLabels = !!parsed.operators.label?.length;

  if (needsMessages) {
    joins.push("JOIN messages m ON m.thread_id = t.id AND m.account_id = t.account_id");
  }

  if (needsLabels) {
    joins.push(
      "JOIN thread_labels tl ON tl.thread_id = t.id AND tl.account_id = t.account_id",
    );
    joins.push("JOIN labels l ON l.id = tl.label_id AND l.account_id = t.account_id");
  }

  // --- Operator conditions ---

  // from: (case-insensitive substring match on from_address)
  if (parsed.operators.from?.length) {
    for (const f of parsed.operators.from) {
      conditions.push(`m.from_address LIKE ${addParam(`%${escapeLike(f)}%`)}`);
    }
  }

  // to: (case-insensitive substring match on to_addresses)
  if (parsed.operators.to?.length) {
    for (const t of parsed.operators.to) {
      conditions.push(`m.to_addresses LIKE ${addParam(`%${escapeLike(t)}%`)}`);
    }
  }

  // subject:
  if (parsed.operators.subject?.length) {
    for (const s of parsed.operators.subject) {
      conditions.push(`m.subject LIKE ${addParam(`%${escapeLike(s)}%`)}`);
    }
  }

  // has:attachment
  if (parsed.operators.hasAttachment) {
    conditions.push("m.has_attachments = 1");
  }

  // is:unread / is:read
  if (parsed.operators.isUnread) {
    conditions.push("t.is_read = 0");
  }
  if (parsed.operators.isRead) {
    conditions.push("t.is_read = 1");
  }

  // is:starred
  if (parsed.operators.isStarred) {
    conditions.push("t.is_starred = 1");
  }

  // before: / after: (ISO date strings compared against m.date)
  if (parsed.operators.before) {
    conditions.push(`m.date < ${addParam(parsed.operators.before)}`);
  }
  if (parsed.operators.after) {
    conditions.push(`m.date >= ${addParam(parsed.operators.after)}`);
  }

  // label:
  if (parsed.operators.label?.length) {
    for (const lbl of parsed.operators.label) {
      conditions.push(`LOWER(l.name) = ${addParam(lbl.toLowerCase())}`);
    }
  }

  // Free-text via FTS5
  if (parsed.freeText) {
    const sanitized = escapeFts5(parsed.freeText);
    joins.push("JOIN messages_fts fts ON fts.rowid = m.rowid");
    conditions.push(`fts.messages_fts MATCH ${addParam(`"${sanitized}"`)}`);
  }

  // If no operators and no free text, just return an account-scoped query
  const whereClause = conditions.join("\n       AND ");
  const distinct = needsMessages || needsLabels ? "DISTINCT " : "";

  const sql = `SELECT ${distinct}t.*
     FROM threads t
     ${joins.join("\n     ")}
     WHERE ${whereClause}
     ORDER BY t.last_message_at DESC
     LIMIT 50`;

  return { sql, params };
}

/**
 * Whether this parsed query can be handled purely by the query builder
 * (i.e. it has operators or free text).
 */
export function canBuildQuery(parsed: ParsedSearchQuery): boolean {
  return hasOperators(parsed) || !!parsed.freeText;
}

function escapeLike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Escape a user-supplied string for safe use as an FTS5 MATCH phrase.
 *
 * The result is intended to be wrapped in double quotes by the caller,
 * e.g. `"${escapeFts5(input)}"`. Wrapping in quotes neutralises boolean
 * operators (AND, OR, NOT, NEAR) and column filters, but a few characters
 * must still be stripped because they can break out of the quoted phrase
 * or act as special tokens:
 *
 *   - `"` → `""` (FTS5 escape for a literal quote inside a phrase)
 *   - `*`  wildcard / prefix marker → removed
 *   - `:`  column-filter separator  → removed
 *   - `^`  initial-token marker     → removed
 */
function escapeFts5(value: string): string {
  return value
    .replace(/"/g, '""')
    .replace(/[*:^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
