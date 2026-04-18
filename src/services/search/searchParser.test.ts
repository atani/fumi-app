import { describe, it, expect } from "vitest";
import { parseSearchQuery, hasOperators } from "./searchParser";

describe("parseSearchQuery", () => {
  describe("free text", () => {
    it("returns free text only when no operators present", () => {
      const result = parseSearchQuery("hello world");
      expect(result.freeText).toBe("hello world");
      expect(result.operators).toEqual({});
    });

    it("returns empty free text for empty input", () => {
      const result = parseSearchQuery("");
      expect(result.freeText).toBe("");
      expect(result.operators).toEqual({});
    });

    it("collapses whitespace in free text", () => {
      const result = parseSearchQuery("hello    world");
      expect(result.freeText).toBe("hello world");
    });
  });

  describe("from:", () => {
    it("captures single from: value", () => {
      const result = parseSearchQuery("from:alice@example.com");
      expect(result.operators.from).toEqual(["alice@example.com"]);
      expect(result.freeText).toBe("");
    });

    it("captures multiple from: values", () => {
      const result = parseSearchQuery("from:alice from:bob");
      expect(result.operators.from).toEqual(["alice", "bob"]);
    });

    it("supports quoted value with spaces", () => {
      const result = parseSearchQuery('from:"John Doe"');
      expect(result.operators.from).toEqual(["John Doe"]);
    });

    it("supports escaped quote inside quoted value", () => {
      const result = parseSearchQuery('from:"she said \\"hi\\""');
      expect(result.operators.from).toEqual(['she said "hi"']);
    });
  });

  describe("is: and has:", () => {
    it("is:unread sets isUnread true", () => {
      const { operators } = parseSearchQuery("is:unread");
      expect(operators.isUnread).toBe(true);
    });

    it("is:read sets isRead true", () => {
      const { operators } = parseSearchQuery("is:read");
      expect(operators.isRead).toBe(true);
    });

    it("is:starred sets isStarred true", () => {
      const { operators } = parseSearchQuery("is:starred");
      expect(operators.isStarred).toBe(true);
    });

    it("ignores unknown is: values", () => {
      const { operators } = parseSearchQuery("is:whatever");
      expect(operators.isUnread).toBeUndefined();
      expect(operators.isRead).toBeUndefined();
      expect(operators.isStarred).toBeUndefined();
    });

    it("has:attachment sets hasAttachment true", () => {
      const { operators } = parseSearchQuery("has:attachment");
      expect(operators.hasAttachment).toBe(true);
    });

    it("ignores unknown has: values", () => {
      const { operators } = parseSearchQuery("has:nothing");
      expect(operators.hasAttachment).toBeUndefined();
    });
  });

  describe("dates", () => {
    it("before: captures value", () => {
      const { operators } = parseSearchQuery("before:2026-01-01");
      expect(operators.before).toBe("2026-01-01");
    });

    it("after: captures value", () => {
      const { operators } = parseSearchQuery("after:2025-06-01");
      expect(operators.after).toBe("2025-06-01");
    });

    it("latest value wins when before: repeats", () => {
      const { operators } = parseSearchQuery("before:2026-01-01 before:2026-02-01");
      expect(operators.before).toBe("2026-02-01");
    });
  });

  describe("label:", () => {
    it("supports multiple label: tokens", () => {
      const { operators } = parseSearchQuery("label:work label:urgent");
      expect(operators.label).toEqual(["work", "urgent"]);
    });
  });

  describe("mixed", () => {
    it("extracts operators while preserving free text", () => {
      const result = parseSearchQuery(
        'from:alice project update is:unread subject:"Q2 report"',
      );
      expect(result.operators.from).toEqual(["alice"]);
      expect(result.operators.isUnread).toBe(true);
      expect(result.operators.subject).toEqual(["Q2 report"]);
      expect(result.freeText).toBe("project update");
    });

    it("case-insensitive operator names", () => {
      const { operators } = parseSearchQuery("FROM:alice IS:UNREAD");
      expect(operators.from).toEqual(["alice"]);
      expect(operators.isUnread).toBe(true);
    });
  });
});

describe("hasOperators", () => {
  it("returns false when only free text", () => {
    expect(hasOperators(parseSearchQuery("hello"))).toBe(false);
  });

  it("returns true when any operator present", () => {
    expect(hasOperators(parseSearchQuery("from:alice"))).toBe(true);
    expect(hasOperators(parseSearchQuery("is:unread"))).toBe(true);
    expect(hasOperators(parseSearchQuery("label:work"))).toBe(true);
  });

  it("returns false when no operators and no free text", () => {
    expect(hasOperators(parseSearchQuery(""))).toBe(false);
  });
});
