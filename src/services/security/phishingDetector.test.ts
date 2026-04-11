import { describe, it, expect } from "vitest";
import { analyzeUrl, scanLinks, analyzeMessage, getOverallRisk } from "./phishingDetector";

describe("analyzeUrl", () => {
  it("flags IP addresses in URLs", () => {
    const result = analyzeUrl("http://192.168.1.1/login");
    expect(result.riskLevel).not.toBe("safe");
    expect(result.reasons).toContain("URL contains an IP address instead of a domain name");
  });

  it("flags suspicious TLDs", () => {
    const result = analyzeUrl("https://example.tk/page");
    expect(result.reasons.some((r) => r.includes(".tk"))).toBe(true);
  });

  it("flags URL shorteners", () => {
    const result = analyzeUrl("https://bit.ly/abc123");
    expect(result.reasons.some((r) => r.includes("URL shortener"))).toBe(true);
  });

  it("flags display text vs href mismatch", () => {
    const result = analyzeUrl("https://evil.com/login", "https://paypal.com/login");
    expect(result.reasons.some((r) => r.includes("actually goes to"))).toBe(true);
  });

  it("does not flag matching display text and href", () => {
    const result = analyzeUrl("https://paypal.com/account", "https://paypal.com/account");
    expect(result.reasons.some((r) => r.includes("actually goes to"))).toBe(false);
  });

  it("flags suspicious path patterns at default sensitivity", () => {
    const result = analyzeUrl("https://example.com/login/verify");
    expect(result.reasons.some((r) => r.includes("/login"))).toBe(true);
  });

  it("skips suspicious path patterns at low sensitivity", () => {
    const result = analyzeUrl("https://example.com/login", null, "low");
    expect(result.reasons.some((r) => r.includes("/login"))).toBe(false);
  });

  it("flags brand impersonation in subdomains", () => {
    const result = analyzeUrl("https://paypal.secure.example.com/account");
    expect(result.reasons.some((r) => r.includes("impersonating"))).toBe(true);
  });

  it("flags dangerous protocols", () => {
    const jsResult = analyzeUrl("javascript:alert(1)");
    expect(jsResult.reasons.some((r) => r.includes("dangerous protocol"))).toBe(true);

    const dataResult = analyzeUrl("data:text/html,<script>alert(1)</script>");
    expect(dataResult.reasons.some((r) => r.includes("dangerous protocol"))).toBe(true);
  });

  it("flags excessive subdomains", () => {
    const result = analyzeUrl("https://a.b.c.example.com/page");
    expect(result.reasons.some((r) => r.includes("subdomains"))).toBe(true);
  });

  it("flags free email impersonating company", () => {
    const result = analyzeUrl(
      "https://paypal.com/verify",
      null,
      "default",
      "scammer@gmail.com",
    );
    expect(result.reasons.some((r) => r.includes("free email provider"))).toBe(true);
  });

  it("returns safe for normal links", () => {
    const result = analyzeUrl("https://google.com/search?q=test");
    expect(result.riskLevel).toBe("safe");
    expect(result.reasons).toHaveLength(0);
  });

  it("returns danger when multiple issues at default sensitivity", () => {
    const result = analyzeUrl("http://192.168.1.1/login/verify", "https://paypal.com");
    expect(result.riskLevel).toBe("danger");
  });

  it("returns danger for single issue at high sensitivity", () => {
    const result = analyzeUrl("https://bit.ly/abc", null, "high");
    expect(result.riskLevel).toBe("danger");
  });
});

describe("scanLinks", () => {
  it("extracts links from HTML", () => {
    const html = '<a href="https://example.com">Click here</a> and <a href="https://other.com"><b>Bold link</b></a>';
    const links = scanLinks(html);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ href: "https://example.com", displayText: "Click here" });
    expect(links[1]).toEqual({ href: "https://other.com", displayText: "Bold link" });
  });

  it("returns empty array for no links", () => {
    expect(scanLinks("<p>No links here</p>")).toHaveLength(0);
  });
});

describe("analyzeMessage", () => {
  it("analyzes all links in HTML body", () => {
    const html = '<a href="http://192.168.1.1/login">Click</a> <a href="https://google.com">Google</a>';
    const results = analyzeMessage(html);
    expect(results).toHaveLength(2);
    expect(results[0]?.riskLevel).not.toBe("safe");
    expect(results[1]?.riskLevel).toBe("safe");
  });
});

describe("getOverallRisk", () => {
  it("returns danger if any link is danger", () => {
    expect(
      getOverallRisk([
        { url: "a", displayText: null, riskLevel: "safe", reasons: [] },
        { url: "b", displayText: null, riskLevel: "danger", reasons: ["x"] },
      ]),
    ).toBe("danger");
  });

  it("returns warning if any link is warning and none danger", () => {
    expect(
      getOverallRisk([
        { url: "a", displayText: null, riskLevel: "safe", reasons: [] },
        { url: "b", displayText: null, riskLevel: "warning", reasons: ["x"] },
      ]),
    ).toBe("warning");
  });

  it("returns safe when all links are safe", () => {
    expect(
      getOverallRisk([
        { url: "a", displayText: null, riskLevel: "safe", reasons: [] },
      ]),
    ).toBe("safe");
  });
});
