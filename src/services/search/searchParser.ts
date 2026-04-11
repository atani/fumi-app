/**
 * Gmail-style search query parser.
 *
 * Supported operators:
 *   from:, to:, subject:, has:attachment, is:unread, is:read, is:starred,
 *   before:YYYY-MM-DD, after:YYYY-MM-DD, label:
 *
 * Operators may use quoted values: from:"John Doe"
 * Multiple instances of the same operator are combined with AND semantics.
 * Anything that is not an operator becomes free-text search.
 */

export interface ParsedOperators {
  from?: string[];
  to?: string[];
  subject?: string[];
  hasAttachment?: boolean;
  isUnread?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  before?: string;
  after?: string;
  label?: string[];
}

export interface ParsedSearchQuery {
  operators: ParsedOperators;
  freeText: string;
}

// Regex: operator_name: then either "quoted value" or non-space token
const OPERATOR_RE =
  /\b(from|to|subject|has|is|before|after|label):("(?:[^"\\]|\\.)*"|[^\s]+)/gi;

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const operators: ParsedOperators = {};
  const freeTextParts: string[] = [];

  // Track which parts of the string are consumed by operators
  let lastIndex = 0;
  const matches: { start: number; end: number }[] = [];

  let match: RegExpExecArray | null;
  // Reset lastIndex since we use 'g' flag
  OPERATOR_RE.lastIndex = 0;

  while ((match = OPERATOR_RE.exec(query)) !== null) {
    const key = (match[1] ?? "").toLowerCase();
    let value = match[2] ?? "";

    // Strip surrounding quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }

    matches.push({ start: match.index, end: match.index + match[0].length });

    switch (key) {
      case "from":
        operators.from = operators.from ?? [];
        operators.from.push(value);
        break;
      case "to":
        operators.to = operators.to ?? [];
        operators.to.push(value);
        break;
      case "subject":
        operators.subject = operators.subject ?? [];
        operators.subject.push(value);
        break;
      case "has":
        if (value.toLowerCase() === "attachment") {
          operators.hasAttachment = true;
        }
        break;
      case "is":
        switch (value.toLowerCase()) {
          case "unread":
            operators.isUnread = true;
            break;
          case "read":
            operators.isRead = true;
            break;
          case "starred":
            operators.isStarred = true;
            break;
        }
        break;
      case "before":
        operators.before = value;
        break;
      case "after":
        operators.after = value;
        break;
      case "label":
        operators.label = operators.label ?? [];
        operators.label.push(value);
        break;
    }
  }

  // Build free text from the parts not consumed by operators
  for (const m of matches) {
    if (m.start > lastIndex) {
      freeTextParts.push(query.slice(lastIndex, m.start));
    }
    lastIndex = m.end;
  }
  if (lastIndex < query.length) {
    freeTextParts.push(query.slice(lastIndex));
  }

  const freeText = freeTextParts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return { operators, freeText };
}

/**
 * Returns true when the parsed query contains at least one operator.
 */
export function hasOperators(parsed: ParsedSearchQuery): boolean {
  const o = parsed.operators;
  return !!(
    o.from?.length ||
    o.to?.length ||
    o.subject?.length ||
    o.hasAttachment ||
    o.isUnread ||
    o.isRead ||
    o.isStarred ||
    o.before ||
    o.after ||
    o.label?.length
  );
}
