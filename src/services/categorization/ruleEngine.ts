import type { ThreadCategory } from "../ai/aiService";

interface RulePattern {
  category: ThreadCategory;
  fromPatterns?: string[];
  subjectPatterns?: string[];
}

const RULES: RulePattern[] = [
  {
    category: "Newsletters",
    fromPatterns: [
      "noreply@",
      "no-reply@",
      "newsletter@",
      "digest@",
      "weekly@",
      "news@",
      "updates@medium.com",
      "hello@substack.com",
    ],
    subjectPatterns: ["newsletter", "digest", "weekly roundup", "unsubscribe"],
  },
  {
    category: "Social",
    fromPatterns: [
      "@facebookmail.com",
      "@facebook.com",
      "@twitter.com",
      "@x.com",
      "@linkedin.com",
      "@instagram.com",
      "@reddit.com",
      "@tiktok.com",
      "@pinterest.com",
      "@snapchat.com",
      "@discord.com",
      "@mastodon.",
    ],
    subjectPatterns: [
      "mentioned you",
      "sent you a message",
      "wants to connect",
      "accepted your",
      "liked your",
      "commented on your",
      "tagged you",
      "followed you",
      "new follower",
    ],
  },
  {
    category: "Updates",
    fromPatterns: [
      "notification@",
      "notifications@",
      "notify@",
      "alert@",
      "alerts@",
      "noreply@github.com",
      "builds@travis-ci.com",
      "no-reply@accounts.google.com",
      "@accounts.google.com",
      "security@",
      "support@",
      "mailer-daemon@",
    ],
    subjectPatterns: [
      "your order",
      "order confirmation",
      "shipping confirmation",
      "delivery notification",
      "password reset",
      "verify your",
      "confirm your",
      "security alert",
      "sign-in",
      "login attempt",
      "two-factor",
    ],
  },
  {
    category: "Promotions",
    fromPatterns: [
      "deals@",
      "offers@",
      "promo@",
      "promotions@",
      "marketing@",
      "sale@",
      "shop@",
      "store@",
      "info@",
    ],
    subjectPatterns: [
      "% off",
      "sale",
      "discount",
      "limited time",
      "exclusive offer",
      "free shipping",
      "deal of",
      "special offer",
      "coupon",
      "save up to",
      "don't miss",
      "act now",
      "limited offer",
    ],
  },
];

function matchesAny(value: string, patterns: string[]): boolean {
  const lower = value.toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Attempt rule-based categorization by matching sender address and subject
 * against known patterns. Returns null when no rule matches, signaling
 * the caller should fall back to AI (or default to "Primary").
 */
export function categorizeByRules(
  fromAddress: string | null,
  subject: string | null,
): ThreadCategory | null {
  for (const rule of RULES) {
    const fromMatch =
      rule.fromPatterns &&
      fromAddress &&
      matchesAny(fromAddress, rule.fromPatterns);
    const subjectMatch =
      rule.subjectPatterns &&
      subject &&
      matchesAny(subject, rule.subjectPatterns);

    if (fromMatch || subjectMatch) {
      return rule.category;
    }
  }

  return null;
}
