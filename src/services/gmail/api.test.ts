import { describe, it, expect } from "vitest";
import { decodeBase64Url, getHeader, getMessageBody } from "./api";
import type { GmailMessage } from "../../types";

describe("Gmail API utilities", () => {
  describe("decodeBase64Url", () => {
    it("should decode base64url encoded string", () => {
      const encoded = btoa("Hello, World!")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      expect(decodeBase64Url(encoded)).toBe("Hello, World!");
    });
  });

  describe("getHeader", () => {
    it("should find header case-insensitively", () => {
      const message = {
        payload: {
          headers: [
            { name: "Subject", value: "Test Subject" },
            { name: "From", value: "sender@test.com" },
          ],
        },
      } as GmailMessage;

      expect(getHeader(message, "subject")).toBe("Test Subject");
      expect(getHeader(message, "FROM")).toBe("sender@test.com");
      expect(getHeader(message, "nonexistent")).toBeUndefined();
    });
  });

  describe("getMessageBody", () => {
    it("should extract body from payload.body", () => {
      const data = btoa("Hello body")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const message = {
        payload: {
          headers: [],
          mimeType: "text/plain",
          body: { data, size: 10 },
        },
      } as unknown as GmailMessage;

      expect(getMessageBody(message)).toBe("Hello body");
    });

    it("should extract html from multipart", () => {
      const htmlData = btoa("<p>Hello</p>")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const message = {
        payload: {
          headers: [],
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: btoa("plain"), size: 5 } },
            { mimeType: "text/html", body: { data: htmlData, size: 12 } },
          ],
        },
      } as unknown as GmailMessage;

      expect(getMessageBody(message)).toBe("<p>Hello</p>");
    });

    it("should return empty string if no body found", () => {
      const message = {
        payload: {
          headers: [],
          mimeType: "multipart/mixed",
          parts: [],
        },
      } as unknown as GmailMessage;

      expect(getMessageBody(message)).toBe("");
    });
  });
});
