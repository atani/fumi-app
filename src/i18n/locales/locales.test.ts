import { describe, it, expect } from "vitest";
import { enResources, jaResources, deResources } from "../index";

/** Recursively collect dot-joined key paths from a nested translation object. */
function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) return [path];
    return value !== null && typeof value === "object"
      ? keyPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("locale parity (all namespaces)", () => {
  const enKeys = keyPaths(enResources).sort();
  const jaKeys = keyPaths(jaResources).sort();
  const deKeys = keyPaths(deResources).sort();

  it("Japanese has every key English has", () => {
    const missing = enKeys.filter((k) => !jaKeys.includes(k));
    expect(missing, `Missing in Japanese: ${missing.join(", ")}`).toEqual([]);
  });

  it("Japanese has no extra keys English lacks", () => {
    const extra = jaKeys.filter((k) => !enKeys.includes(k));
    expect(extra, `Extra in Japanese: ${extra.join(", ")}`).toEqual([]);
  });

  it("German has every key English has", () => {
    const missing = enKeys.filter((k) => !deKeys.includes(k));
    expect(missing, `Missing in German: ${missing.join(", ")}`).toEqual([]);
  });

  it("German has no extra keys English lacks", () => {
    const extra = deKeys.filter((k) => !enKeys.includes(k));
    expect(extra, `Extra in German: ${extra.join(", ")}`).toEqual([]);
  });

  it("no string value is empty", () => {
    const empties = [
      ...keyPaths(enResources).filter((k) => isEmpty(resolve(enResources, k))),
      ...keyPaths(jaResources).filter((k) => isEmpty(resolve(jaResources, k))),
      ...keyPaths(deResources).filter((k) => isEmpty(resolve(deResources, k))),
    ];
    expect(empties, `Empty values: ${empties.join(", ")}`).toEqual([]);
  });
});

function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "string" && value.trim() === "";
}

function resolve(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj);
}
