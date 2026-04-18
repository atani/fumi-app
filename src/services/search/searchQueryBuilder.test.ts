import { describe, it, expect } from "vitest";
import { buildSqlQuery, canBuildQuery } from "./searchQueryBuilder";
import { parseSearchQuery } from "./searchParser";

const ACCOUNT = "acct-1";

describe("buildSqlQuery", () => {
  it("returns account-scoped query with no filters when query is empty", () => {
    const parsed = parseSearchQuery("");
    const { sql, params } = buildSqlQuery(ACCOUNT, parsed);
    expect(sql).toMatch(/FROM threads t/);
    expect(sql).toMatch(/t\.account_id = \$1/);
    expect(sql).not.toMatch(/JOIN messages/);
    expect(sql).not.toMatch(/DISTINCT/);
    expect(params).toEqual([ACCOUNT]);
  });

  it("adds messages JOIN only when needed", () => {
    const parsed = parseSearchQuery("is:unread");
    const { sql } = buildSqlQuery(ACCOUNT, parsed);
    expect(sql).not.toMatch(/JOIN messages/);
    expect(sql).toMatch(/t\.is_read = 0/);
  });

  it("joins messages when from: is used", () => {
    const parsed = parseSearchQuery("from:alice");
    const { sql, params } = buildSqlQuery(ACCOUNT, parsed);
    expect(sql).toMatch(/JOIN messages m/);
    expect(sql).toMatch(/m\.from_address LIKE \$2/);
    expect(params).toEqual([ACCOUNT, "%alice%"]);
  });

  it("joins labels when label: is used", () => {
    const parsed = parseSearchQuery("label:work");
    const { sql, params } = buildSqlQuery(ACCOUNT, parsed);
    expect(sql).toMatch(/JOIN thread_labels tl/);
    expect(sql).toMatch(/JOIN labels l/);
    expect(sql).toMatch(/LOWER\(l\.name\) = \$2/);
    expect(params).toEqual([ACCOUNT, "work"]);
  });

  it("uses FTS5 join for free text", () => {
    const parsed = parseSearchQuery("quarterly report");
    const { sql, params } = buildSqlQuery(ACCOUNT, parsed);
    expect(sql).toMatch(/JOIN messages_fts fts/);
    expect(sql).toMatch(/fts\.messages_fts MATCH/);
    expect(params[1]).toBe('"quarterly report"');
  });

  it("escapes LIKE wildcards in from: value", () => {
    const parsed = parseSearchQuery("from:alice_100%");
    const { params } = buildSqlQuery(ACCOUNT, parsed);
    expect(params[1]).toBe("%alice\\_100\\%%");
  });

  it("sanitises FTS5 special characters", () => {
    // Quotes get doubled, *:^ are stripped and collapsed
    const parsed = parseSearchQuery('*hello: world"');
    const { params } = buildSqlQuery(ACCOUNT, parsed);
    expect(params[1]).toBe('"hello world"""');
  });

  it("combines operators and free text in one query", () => {
    const parsed = parseSearchQuery("from:alice project is:unread");
    const { sql, params } = buildSqlQuery(ACCOUNT, parsed);
    expect(sql).toMatch(/JOIN messages m/);
    expect(sql).toMatch(/JOIN messages_fts fts/);
    expect(sql).toMatch(/t\.is_read = 0/);
    expect(params).toContain("%alice%");
    expect(params).toContain('"project"');
  });

  it("before: and after: map to date conditions", () => {
    const parsed = parseSearchQuery("after:2025-01-01 before:2026-01-01");
    const { sql, params } = buildSqlQuery(ACCOUNT, parsed);
    expect(sql).toMatch(/m\.date < \$/);
    expect(sql).toMatch(/m\.date >= \$/);
    expect(params).toContain("2025-01-01");
    expect(params).toContain("2026-01-01");
  });

  it("always orders by last_message_at DESC with LIMIT 50", () => {
    const parsed = parseSearchQuery("is:starred");
    const { sql } = buildSqlQuery(ACCOUNT, parsed);
    expect(sql).toMatch(/ORDER BY t\.last_message_at DESC/);
    expect(sql).toMatch(/LIMIT 50/);
  });
});

describe("canBuildQuery", () => {
  it("false for empty query", () => {
    expect(canBuildQuery(parseSearchQuery(""))).toBe(false);
  });

  it("true when free text present", () => {
    expect(canBuildQuery(parseSearchQuery("hello"))).toBe(true);
  });

  it("true when any operator present", () => {
    expect(canBuildQuery(parseSearchQuery("is:unread"))).toBe(true);
  });
});
