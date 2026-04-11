import { describe, it, expect } from "vitest";
import { matchesCriteria, mergeActions } from "./filterEngine";
import type { Message, FilterCriteria, FilterActions } from "../../types";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    account_id: "acc-1",
    from_address: "alice@example.com",
    from_name: "Alice Smith",
    to_addresses: "bob@example.com",
    cc_addresses: null,
    bcc_addresses: null,
    subject: "Invoice for January",
    snippet: null,
    body_html: null,
    body_text: null,
    date: "2024-01-15T00:00:00Z",
    is_read: false,
    has_attachments: false,
    header_message_id: null,
    auth_results: null,
    ...overrides,
  };
}

describe("matchesCriteria", () => {
  it("matches when all criteria are satisfied", () => {
    const criteria: FilterCriteria = {
      from: "alice",
      subject: "invoice",
    };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(true);
  });

  it("is case-insensitive for from", () => {
    const criteria: FilterCriteria = { from: "ALICE" };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(true);
  });

  it("matches against from_name as well", () => {
    const criteria: FilterCriteria = { from: "Smith" };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(true);
  });

  it("fails when from does not match", () => {
    const criteria: FilterCriteria = { from: "charlie" };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(false);
  });

  it("matches to field with substring", () => {
    const criteria: FilterCriteria = { to: "bob" };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(true);
  });

  it("fails when to does not match", () => {
    const criteria: FilterCriteria = { to: "charlie" };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(false);
  });

  it("matches subject with substring", () => {
    const criteria: FilterCriteria = { subject: "January" };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(true);
  });

  it("fails when subject does not match", () => {
    const criteria: FilterCriteria = { subject: "February" };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(false);
  });

  it("matches hasAttachment when message has attachments", () => {
    const criteria: FilterCriteria = { hasAttachment: true };
    expect(
      matchesCriteria(makeMessage({ has_attachments: true }), criteria),
    ).toBe(true);
  });

  it("fails hasAttachment when message has no attachments", () => {
    const criteria: FilterCriteria = { hasAttachment: true };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(false);
  });

  it("AND logic: fails if any criterion is unmet", () => {
    const criteria: FilterCriteria = {
      from: "alice",
      subject: "February",
    };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(false);
  });

  it("empty criteria matches everything", () => {
    expect(matchesCriteria(makeMessage(), {})).toBe(true);
  });

  it("ignores empty-string criteria fields", () => {
    const criteria: FilterCriteria = { from: "", subject: "" };
    expect(matchesCriteria(makeMessage(), criteria)).toBe(true);
  });

  it("handles null message fields gracefully", () => {
    const msg = makeMessage({
      from_address: null,
      from_name: null,
      to_addresses: null,
      subject: null,
    });
    const criteria: FilterCriteria = { from: "alice" };
    expect(matchesCriteria(msg, criteria)).toBe(false);
  });
});

describe("mergeActions", () => {
  it("merges multiple action sets", () => {
    const a1: FilterActions = { archive: true, markRead: true };
    const a2: FilterActions = { star: true, applyLabel: "IMPORTANT" };
    const merged = mergeActions([a1, a2]);
    expect(merged).toEqual({
      archive: true,
      markRead: true,
      star: true,
      applyLabel: "IMPORTANT",
    });
  });

  it("first applyLabel wins", () => {
    const a1: FilterActions = { applyLabel: "FIRST" };
    const a2: FilterActions = { applyLabel: "SECOND" };
    expect(mergeActions([a1, a2]).applyLabel).toBe("FIRST");
  });

  it("returns empty object for no actions", () => {
    expect(mergeActions([])).toEqual({});
  });

  it("trash takes precedence in merged output", () => {
    const a1: FilterActions = { archive: true };
    const a2: FilterActions = { trash: true };
    const merged = mergeActions([a1, a2]);
    expect(merged.archive).toBe(true);
    expect(merged.trash).toBe(true);
  });
});
