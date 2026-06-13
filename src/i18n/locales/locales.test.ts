import { describe, it, expect } from "vitest";
import en from "./en.json";
import ja from "./ja.json";

/** Recursively collect dot-joined key paths from a nested translation object. */
function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? keyPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("locale parity", () => {
  const enKeys = keyPaths(en).sort();
  const jaKeys = keyPaths(ja).sort();

  it("Japanese has every key English has", () => {
    const missing = enKeys.filter((k) => !jaKeys.includes(k));
    expect(missing, `Missing in ja.json: ${missing.join(", ")}`).toEqual([]);
  });

  it("Japanese has no extra keys English lacks", () => {
    const extra = jaKeys.filter((k) => !enKeys.includes(k));
    expect(extra, `Extra in ja.json: ${extra.join(", ")}`).toEqual([]);
  });

  it("no translation value is empty", () => {
    const empties = [
      ...keyPaths(en).filter((k) => resolve(en, k).trim() === ""),
      ...keyPaths(ja).filter((k) => resolve(ja, k).trim() === ""),
    ];
    expect(empties, `Empty values: ${empties.join(", ")}`).toEqual([]);
  });
});

function resolve(obj: Record<string, unknown>, path: string): string {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj) as string;
}
