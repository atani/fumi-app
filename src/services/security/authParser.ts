import type { AuthResult } from "../../types";

type AuthStatus = "pass" | "fail" | "none" | "unknown";

/**
 * Parse an Authentication-Results email header value and extract
 * SPF, DKIM, and DMARC verdicts.
 *
 * Example header value:
 *   mx.google.com; dkim=pass header.d=example.com; spf=pass smtp.mailfrom=example.com; dmarc=pass
 */
export function parseAuthResults(headerValue: string | null | undefined): AuthResult {
  const result: AuthResult = {
    spf: "unknown",
    dkim: "unknown",
    dmarc: "unknown",
    verdict: "unknown",
  };

  if (!headerValue) return result;

  const lower = headerValue.toLowerCase();

  result.spf = extractStatus(lower, "spf");
  result.dkim = extractStatus(lower, "dkim");
  result.dmarc = extractStatus(lower, "dmarc");
  result.verdict = computeVerdict(result);

  return result;
}

function extractStatus(header: string, mechanism: string): AuthStatus {
  // Match patterns like "spf=pass", "dkim=fail", "dmarc=none"
  const regex = new RegExp(`${mechanism}\\s*=\\s*(pass|fail|softfail|neutral|none|temperror|permerror)`, "i");
  const match = regex.exec(header);

  if (!match?.[1]) return "unknown";

  const raw = match[1].toLowerCase();
  if (raw === "pass") return "pass";
  if (raw === "fail" || raw === "softfail" || raw === "permerror") return "fail";
  if (raw === "none") return "none";
  // neutral, temperror → unknown
  return "unknown";
}

function computeVerdict(result: Omit<AuthResult, "verdict">): AuthResult["verdict"] {
  const { spf, dkim, dmarc } = result;

  // If all are unknown, we have no data
  if (spf === "unknown" && dkim === "unknown" && dmarc === "unknown") {
    return "unknown";
  }

  // If DMARC explicitly fails, the message is likely spoofed
  if (dmarc === "fail") return "fail";

  // If DMARC passes, trust it
  if (dmarc === "pass") return "pass";

  // No DMARC: fall back to SPF + DKIM
  if (spf === "fail" && dkim === "fail") return "fail";
  if (spf === "fail" || dkim === "fail") return "warning";
  if (spf === "pass" && dkim === "pass") return "pass";
  if (spf === "pass" || dkim === "pass") return "pass";

  return "warning";
}
