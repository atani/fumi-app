import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
const mockSelect = vi.fn();

vi.mock("./connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  }),
}));

const { runMigrations } = await import("./migrations");

beforeEach(() => {
  vi.clearAllMocks();
  // No migrations recorded yet → every migration runs.
  mockSelect.mockResolvedValue([]);
});

describe("runMigrations idempotency", () => {
  it("skips 'already exists' errors so a crashed migration completes on re-run", async () => {
    // Simulate a re-run where index-creation statements already ran last time.
    mockExecute.mockImplementation((sql: string) => {
      if (/CREATE INDEX/i.test(sql)) {
        return Promise.reject(new Error("index already exists"));
      }
      return Promise.resolve({ rowsAffected: 0 });
    });

    await expect(runMigrations()).resolves.toBeUndefined();
    // The version rows still get recorded (migration considered applied).
    expect(mockExecute).toHaveBeenCalledWith(
      "INSERT INTO _migrations (version) VALUES ($1)",
      expect.any(Array),
    );
  });

  it("propagates unexpected errors instead of marking the migration applied", async () => {
    mockExecute.mockImplementation((sql: string) => {
      if (/CREATE INDEX/i.test(sql)) {
        return Promise.reject(new Error("disk I/O error"));
      }
      return Promise.resolve({ rowsAffected: 0 });
    });

    await expect(runMigrations()).rejects.toThrow("disk I/O error");
  });
});
