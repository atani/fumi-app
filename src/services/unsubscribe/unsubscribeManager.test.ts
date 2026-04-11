import { describe, it, expect } from "vitest";
import { parseUnsubscribeHeaders, getUnsubscribeInfo } from "./unsubscribeManager";
import type { Message } from "../../types";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    account_id: "acc-1",
    from_address: "newsletter@example.com",
    from_name: "Newsletter",
    to_addresses: "user@example.com",
    cc_addresses: null,
    bcc_addresses: null,
    subject: "Weekly digest",
    snippet: null,
    body_html: null,
    body_text: null,
    date: "2024-01-15T00:00:00Z",
    is_read: false,
    has_attachments: false,
    header_message_id: null,
    auth_results: null,
    list_unsubscribe: null,
    list_unsubscribe_post: null,
    imap_uid: null,
    imap_folder: null,
    message_id_header: null,
    references_header: null,
    in_reply_to_header: null,
    ...overrides,
  };
}

describe("parseUnsubscribeHeaders", () => {
  it("returns empty when no List-Unsubscribe header", () => {
    const result = parseUnsubscribeHeaders(makeMessage());
    expect(result).toEqual({ httpUrls: [], mailtoUrls: [], hasOneClick: false });
  });

  it("parses a single HTTPS URL", () => {
    const msg = makeMessage({
      list_unsubscribe: "<https://example.com/unsubscribe?id=123>",
    });
    const result = parseUnsubscribeHeaders(msg);
    expect(result.httpUrls).toEqual(["https://example.com/unsubscribe?id=123"]);
    expect(result.mailtoUrls).toEqual([]);
    expect(result.hasOneClick).toBe(false);
  });

  it("parses a mailto URL", () => {
    const msg = makeMessage({
      list_unsubscribe: "<mailto:unsub@example.com?subject=unsubscribe>",
    });
    const result = parseUnsubscribeHeaders(msg);
    expect(result.httpUrls).toEqual([]);
    expect(result.mailtoUrls).toEqual(["mailto:unsub@example.com?subject=unsubscribe"]);
  });

  it("parses multiple URLs (HTTP + mailto)", () => {
    const msg = makeMessage({
      list_unsubscribe:
        "<https://example.com/unsub>, <mailto:unsub@example.com>",
    });
    const result = parseUnsubscribeHeaders(msg);
    expect(result.httpUrls).toEqual(["https://example.com/unsub"]);
    expect(result.mailtoUrls).toEqual(["mailto:unsub@example.com"]);
  });

  it("detects one-click unsubscribe (RFC 8058)", () => {
    const msg = makeMessage({
      list_unsubscribe: "<https://example.com/unsub>",
      list_unsubscribe_post: "List-Unsubscribe=One-Click",
    });
    const result = parseUnsubscribeHeaders(msg);
    expect(result.hasOneClick).toBe(true);
  });

  it("does not flag one-click without List-Unsubscribe-Post", () => {
    const msg = makeMessage({
      list_unsubscribe: "<https://example.com/unsub>",
      list_unsubscribe_post: null,
    });
    const result = parseUnsubscribeHeaders(msg);
    expect(result.hasOneClick).toBe(false);
  });

  it("handles case-insensitive List-Unsubscribe-Post value", () => {
    const msg = makeMessage({
      list_unsubscribe: "<https://example.com/unsub>",
      list_unsubscribe_post: "list-unsubscribe=one-click",
    });
    const result = parseUnsubscribeHeaders(msg);
    expect(result.hasOneClick).toBe(true);
  });
});

describe("getUnsubscribeInfo", () => {
  it("returns canUnsubscribe: false when no header", () => {
    const info = getUnsubscribeInfo(makeMessage());
    expect(info.canUnsubscribe).toBe(false);
    expect(info.method).toBeNull();
    expect(info.target).toBeNull();
  });

  it("prefers one-click method when available", () => {
    const msg = makeMessage({
      list_unsubscribe: "<https://example.com/unsub>, <mailto:unsub@example.com>",
      list_unsubscribe_post: "List-Unsubscribe=One-Click",
    });
    const info = getUnsubscribeInfo(msg);
    expect(info.canUnsubscribe).toBe(true);
    expect(info.method).toBe("one-click");
    expect(info.target).toBe("https://example.com/unsub");
  });

  it("falls back to mailto when no HTTP URL", () => {
    const msg = makeMessage({
      list_unsubscribe: "<mailto:unsub@example.com>",
    });
    const info = getUnsubscribeInfo(msg);
    expect(info.canUnsubscribe).toBe(true);
    expect(info.method).toBe("mailto");
    expect(info.target).toBe("mailto:unsub@example.com");
  });

  it("falls back to HTTP URL when no one-click support and no mailto", () => {
    const msg = makeMessage({
      list_unsubscribe: "<https://example.com/unsub-page>",
    });
    const info = getUnsubscribeInfo(msg);
    expect(info.canUnsubscribe).toBe(true);
    expect(info.method).toBe("one-click");
    expect(info.target).toBe("https://example.com/unsub-page");
  });

  it("prefers mailto over plain HTTP when no one-click", () => {
    const msg = makeMessage({
      list_unsubscribe: "<https://example.com/unsub>, <mailto:unsub@example.com>",
    });
    const info = getUnsubscribeInfo(msg);
    expect(info.canUnsubscribe).toBe(true);
    // Without List-Unsubscribe-Post, mailto is preferred over HTTP
    expect(info.method).toBe("mailto");
    expect(info.target).toBe("mailto:unsub@example.com");
  });
});
