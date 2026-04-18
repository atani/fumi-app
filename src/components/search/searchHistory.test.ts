import { describe, it, expect, beforeEach } from "vitest";
import {
  loadHistory,
  saveHistory,
  addToHistory,
  removeFromHistory,
  HISTORY_KEY,
  HISTORY_MAX,
} from "./searchHistory";

describe("searchHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadHistory", () => {
    it("returns empty array when nothing stored", () => {
      expect(loadHistory()).toEqual([]);
    });

    it("returns stored array", () => {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(["a", "b"]));
      expect(loadHistory()).toEqual(["a", "b"]);
    });

    it("returns empty array for malformed JSON", () => {
      localStorage.setItem(HISTORY_KEY, "{not json");
      expect(loadHistory()).toEqual([]);
    });

    it("filters non-string entries", () => {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(["a", 42, null, "b"]));
      expect(loadHistory()).toEqual(["a", "b"]);
    });

    it("caps to HISTORY_MAX entries", () => {
      const many = Array.from({ length: HISTORY_MAX + 5 }, (_, i) => `q${i}`);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(many));
      expect(loadHistory()).toHaveLength(HISTORY_MAX);
    });
  });

  describe("addToHistory", () => {
    it("prepends a new query", () => {
      expect(addToHistory(["a"], "b")).toEqual(["b", "a"]);
    });

    it("deduplicates — moves existing entry to front", () => {
      expect(addToHistory(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    });

    it("ignores whitespace-only and empty queries", () => {
      expect(addToHistory(["a"], "   ")).toEqual(["a"]);
      expect(addToHistory(["a"], "")).toEqual(["a"]);
    });

    it("trims the inserted query", () => {
      expect(addToHistory([], "  hello  ")).toEqual(["hello"]);
    });

    it(`caps at ${HISTORY_MAX}`, () => {
      const start = Array.from({ length: HISTORY_MAX }, (_, i) => `q${i}`);
      const next = addToHistory(start, "new");
      expect(next).toHaveLength(HISTORY_MAX);
      expect(next[0]).toBe("new");
      expect(next).not.toContain(`q${HISTORY_MAX - 1}`);
    });
  });

  describe("removeFromHistory", () => {
    it("removes matching entry", () => {
      expect(removeFromHistory(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    });

    it("is a no-op when entry is missing", () => {
      expect(removeFromHistory(["a", "c"], "b")).toEqual(["a", "c"]);
    });
  });

  describe("saveHistory", () => {
    it("persists JSON to localStorage", () => {
      saveHistory(["x", "y"]);
      expect(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "")).toEqual([
        "x",
        "y",
      ]);
    });
  });
});
