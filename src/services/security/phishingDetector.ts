import type { LinkAnalysis, PhishingRiskLevel, PhishingSensitivity } from "../../types";

// --- Heuristic rule helpers ---

const IP_URL_RE = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i;

const SUSPICIOUS_TLDS = new Set([".tk", ".ml", ".ga", ".cf", ".gq"]);

const URL_SHORTENERS = new Set([
  "bit.ly",
  "t.co",
  "goo.gl",
  "tinyurl.com",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "adf.ly",
  "turl.no",
  "tiny.cc",
]);

const SUSPICIOUS_PATHS = [
  "/login",
  "/verify",
  "/secure",
  "/account",
  "/signin",
  "/update",
  "/confirm",
  "/authenticate",
  "/validation",
  "/suspend",
];

const IMPERSONATED_BRANDS = [
  "paypal",
  "google",
  "apple",
  "microsoft",
  "amazon",
  "netflix",
  "facebook",
  "instagram",
  "twitter",
  "chase",
  "bankofamerica",
  "wellsfargo",
  "dropbox",
];

const DANGEROUS_PROTOCOLS = ["javascript:", "data:", "vbscript:"];

/** Check if a string contains mixed Unicode scripts (homograph attack). */
function hasMixedScripts(domain: string): boolean {
  const hasLatin = /[a-zA-Z]/.test(domain);
  // Detect Cyrillic, Greek, or other non-ASCII letter-like chars commonly used in homographs
  const hasCyrillic = /[\u0400-\u04FF]/.test(domain);
  const hasGreek = /[\u0370-\u03FF]/.test(domain);
  return hasLatin && (hasCyrillic || hasGreek);
}

function getDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getTld(domain: string): string {
  const parts = domain.split(".");
  if (parts.length < 2) return "";
  return "." + parts[parts.length - 1];
}

/**
 * Analyse a single URL against the 10 heuristic rules.
 *
 * @param url - The href from the link
 * @param displayText - The visible text of the link (if it looks like a URL)
 * @param sensitivity - Detection sensitivity
 * @param senderEmail - (Optional) The From address on the message, used for rule 9
 */
export function analyzeUrl(
  url: string,
  displayText: string | null = null,
  sensitivity: PhishingSensitivity = "default",
  senderEmail: string | null = null,
): LinkAnalysis {
  const reasons: string[] = [];
  const domain = getDomainFromUrl(url);

  // Rule 1: IP address in URL
  if (IP_URL_RE.test(url)) {
    reasons.push("URL contains an IP address instead of a domain name");
  }

  if (domain) {
    // Rule 2: Homograph attack
    if (hasMixedScripts(domain)) {
      reasons.push("Domain uses mixed character scripts (possible homograph attack)");
    }

    // Rule 3: Suspicious TLDs
    const tld = getTld(domain);
    if (SUSPICIOUS_TLDS.has(tld)) {
      reasons.push(`Suspicious top-level domain: ${tld}`);
    }

    // Rule 4: URL shorteners
    if (URL_SHORTENERS.has(domain)) {
      reasons.push("Link uses a URL shortener, hiding the real destination");
    }

    // Rule 7: Brand impersonation in subdomain
    const domainParts = domain.split(".");
    // Only check subdomains, not the main domain itself
    if (domainParts.length > 2) {
      const subdomains = domainParts.slice(0, -2).join(".");
      for (const brand of IMPERSONATED_BRANDS) {
        if (subdomains.includes(brand) && !domain.endsWith(`.${brand}.com`) && !domain.endsWith(`.${brand}.net`)) {
          reasons.push(`Domain may be impersonating ${brand}`);
          break;
        }
      }
    }

    // Rule 10: Excessive subdomains
    if (domainParts.length >= 4) {
      reasons.push(`Unusually many subdomains in URL (${domainParts.length} levels)`);
    }
  }

  // Rule 5: Display text vs href mismatch
  if (displayText) {
    const trimmed = displayText.trim();
    // Only flag when display text itself looks like a URL
    const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed) || /\.[a-z]{2,}$/i.test(trimmed);
    if (looksLikeUrl) {
      const displayDomain = getDomainFromUrl(
        trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
      );
      if (displayDomain && domain && displayDomain !== domain) {
        reasons.push(
          `Link text shows "${displayDomain}" but actually goes to "${domain}"`,
        );
      }
    }
  }

  // Rule 6: Suspicious path patterns
  try {
    const parsed = new URL(url);
    const lowerPath = parsed.pathname.toLowerCase();
    for (const pattern of SUSPICIOUS_PATHS) {
      if (lowerPath.includes(pattern)) {
        // Only flag at default/high sensitivity
        if (sensitivity !== "low") {
          reasons.push(`URL path contains suspicious pattern: ${pattern}`);
        }
        break;
      }
    }
  } catch {
    // ignore malformed URLs for path check
  }

  // Rule 8: Dangerous protocols
  const lowerUrl = url.toLowerCase().trim();
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (lowerUrl.startsWith(proto)) {
      reasons.push(`Link uses dangerous protocol: ${proto}`);
      break;
    }
  }

  // Rule 9: Free email impersonating company
  if (senderEmail) {
    const emailLower = senderEmail.toLowerCase();
    const freeProviders = ["@gmail.com", "@yahoo.com", "@hotmail.com", "@outlook.com"];
    const isFreeEmail = freeProviders.some((p) => emailLower.endsWith(p));
    if (isFreeEmail && domain) {
      for (const brand of IMPERSONATED_BRANDS) {
        if (domain.includes(brand) && !emailLower.includes(brand)) {
          reasons.push(
            `Sender uses a free email provider but links to ${brand}`,
          );
          break;
        }
      }
    }
  }

  // Determine risk level based on sensitivity
  let riskLevel: PhishingRiskLevel = "safe";
  if (reasons.length > 0) {
    if (sensitivity === "high") {
      riskLevel = reasons.length >= 1 ? "danger" : "warning";
    } else if (sensitivity === "low") {
      riskLevel = reasons.length >= 3 ? "danger" : reasons.length >= 1 ? "warning" : "safe";
    } else {
      // default
      riskLevel = reasons.length >= 2 ? "danger" : "warning";
    }
  }

  return {
    url,
    displayText,
    riskLevel,
    reasons,
  };
}

/** Extract all <a> links from an HTML body and return their href + display text pairs. */
export function scanLinks(
  htmlBody: string,
): Array<{ href: string; displayText: string }> {
  const results: Array<{ href: string; displayText: string }> = [];

  // Use a regex approach to avoid requiring a full DOM parser in service context
  const linkRegex = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(htmlBody)) !== null) {
    const href = match[1];
    // Strip HTML tags from display text
    const displayText = (match[2] ?? "").replace(/<[^>]*>/g, "").trim();
    if (href) {
      results.push({ href, displayText });
    }
  }

  return results;
}

/**
 * Scan all links in an HTML body and return analysis results.
 *
 * @param allowedEntries - Set of lowercased URLs or senders that have been
 *   added to the phishing allowlist. When the sender or a link href matches,
 *   the analysis is skipped and the link is treated as safe.
 */
export function analyzeMessage(
  htmlBody: string,
  sensitivity: PhishingSensitivity = "default",
  senderEmail: string | null = null,
  allowedEntries: ReadonlySet<string> = new Set(),
): LinkAnalysis[] {
  // If the sender itself is in the allowlist, skip all analysis
  if (senderEmail && allowedEntries.has(senderEmail.toLowerCase())) {
    return [];
  }

  const links = scanLinks(htmlBody);
  return links.map(({ href, displayText }) => {
    // Skip analysis for individually allowed URLs
    if (allowedEntries.has(href.toLowerCase())) {
      return { url: href, displayText, riskLevel: "safe" as const, reasons: [] };
    }
    return analyzeUrl(href, displayText, sensitivity, senderEmail);
  });
}

/**
 * Get the overall risk level from multiple link analyses.
 */
export function getOverallRisk(analyses: LinkAnalysis[]): PhishingRiskLevel {
  if (analyses.some((a) => a.riskLevel === "danger")) return "danger";
  if (analyses.some((a) => a.riskLevel === "warning")) return "warning";
  return "safe";
}
