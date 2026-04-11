import { describe, it, expect } from "vitest";
import { parseAuthResults } from "./authParser";

describe("parseAuthResults", () => {
  it("parses a full pass result", () => {
    const header =
      "mx.google.com; dkim=pass header.d=example.com; spf=pass smtp.mailfrom=example.com; dmarc=pass";
    const result = parseAuthResults(header);
    expect(result.spf).toBe("pass");
    expect(result.dkim).toBe("pass");
    expect(result.dmarc).toBe("pass");
    expect(result.verdict).toBe("pass");
  });

  it("parses a full fail result", () => {
    const header = "mx.google.com; dkim=fail; spf=fail; dmarc=fail";
    const result = parseAuthResults(header);
    expect(result.spf).toBe("fail");
    expect(result.dkim).toBe("fail");
    expect(result.dmarc).toBe("fail");
    expect(result.verdict).toBe("fail");
  });

  it("handles softfail as fail", () => {
    const header = "mx.google.com; spf=softfail; dkim=pass; dmarc=none";
    const result = parseAuthResults(header);
    expect(result.spf).toBe("fail");
    expect(result.dkim).toBe("pass");
    expect(result.dmarc).toBe("none");
    expect(result.verdict).toBe("warning");
  });

  it("returns unknown for null input", () => {
    const result = parseAuthResults(null);
    expect(result.verdict).toBe("unknown");
    expect(result.spf).toBe("unknown");
    expect(result.dkim).toBe("unknown");
    expect(result.dmarc).toBe("unknown");
  });

  it("returns unknown for empty string", () => {
    const result = parseAuthResults("");
    expect(result.verdict).toBe("unknown");
  });

  it("handles partial results", () => {
    const header = "mx.google.com; spf=pass";
    const result = parseAuthResults(header);
    expect(result.spf).toBe("pass");
    expect(result.dkim).toBe("unknown");
    expect(result.dmarc).toBe("unknown");
    expect(result.verdict).toBe("pass");
  });

  it("verdict is warning when SPF fails but DKIM passes and no DMARC", () => {
    const header = "mx.google.com; spf=fail; dkim=pass";
    const result = parseAuthResults(header);
    expect(result.verdict).toBe("warning");
  });

  it("DMARC fail overrides individual passes for verdict", () => {
    const header = "mx.google.com; spf=pass; dkim=pass; dmarc=fail";
    const result = parseAuthResults(header);
    expect(result.verdict).toBe("fail");
  });
});
