import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { ShieldCheck } from "lucide-react";
import { LinkConfirmDialog } from "./LinkConfirmDialog";

/** Open a URL in the user's external browser (or a new tab outside Tauri). */
async function openExternalUrl(url: string): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// Block CSS exfiltration via url() inside inline style attributes.
// DOMPurify hooks are global singletons, so register once at module load.
let stylePurifierRegistered = false;
function ensureStylePurifier(): void {
  if (stylePurifierRegistered) return;
  stylePurifierRegistered = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style" && typeof data.attrValue === "string") {
      // Strip url(...) references (http, data, etc.) to prevent remote asset
      // loads and CSS exfiltration from inline styles.
      data.attrValue = data.attrValue.replace(/url\s*\([^)]*\)/gi, "");
    }
  });
}
ensureStylePurifier();

interface EmailRendererProps {
  html: string | null;
  text: string | null;
  /** When true, remote images are loaded instead of blocked. */
  allowRemoteImages?: boolean;
  /** Called when user clicks "Load images from this sender". */
  onAllowSender?: () => void;
}

/**
 * Sanitise HTML with DOMPurify, block remote images, and render inside
 * a sandboxed iframe that auto-resizes to its content height.
 */
export function EmailRenderer({
  html,
  text,
  allowRemoteImages = false,
  onAllowSender,
}: EmailRendererProps) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasBlockedImages, setHasBlockedImages] = useState(false);
  const [linkPrompt, setLinkPrompt] = useState<{
    url: string;
    text: string | null;
  } | null>(null);

  // Intercept link clicks inside the email so they never navigate the iframe and
  // always go through the anti-phishing confirmation before opening externally.
  const handleIframeClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;

    e.preventDefault();
    if (/^https?:/i.test(href)) {
      // Show destination + display/href domain-mismatch warning before opening.
      setLinkPrompt({ url: href, text: anchor.textContent?.trim() || null });
    } else if (/^mailto:/i.test(href)) {
      void openExternalUrl(href);
    }
    // Other schemes (tel:, javascript:, …) are intentionally ignored.
  }, []);

  const sanitize = useCallback(
    (dirty: string): string => {
      // DOMPurify: strip scripts, on* handlers, and dangerous tags
      const clean = DOMPurify.sanitize(dirty, {
        WHOLE_DOCUMENT: false,
        FORBID_TAGS: [
          "form",
          "input",
          "textarea",
          "select",
          "button",
          "script",
          "style",
          "link",
          "meta",
        ],
        ALLOW_DATA_ATTR: false,
      });

      if (allowRemoteImages) {
        return clean;
      }

      // Block remote images: rewrite src → data-blocked-src
      const parser = new DOMParser();
      const doc = parser.parseFromString(clean, "text/html");

      doc.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src");
        if (src && !src.startsWith("data:") && !src.startsWith("cid:")) {
          img.setAttribute("data-blocked-src", src);
          img.removeAttribute("src");
          img.setAttribute(
            "alt",
            img.getAttribute("alt") ?? t("email.renderer.imageBlocked"),
          );
        }
      });

      return doc.body.innerHTML;
    },
    [allowRemoteImages, t],
  );

  const writeToIframe = useCallback(
    (sanitizedHtml: string) => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const isDark = document.documentElement.classList.contains("dark");

      const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: ${isDark ? "#e2e8f0" : "#1a1a1a"};
    background: ${isDark ? "#0f172a" : "#ffffff"};
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  img { max-width: 100%; height: auto; }
  img[data-blocked-src] {
    border: 1px dashed ${isDark ? "#475569" : "#d1d5db"};
    padding: 8px;
    color: ${isDark ? "#94a3b8" : "#6b7280"};
    font-size: 12px;
  }
  a { color: ${isDark ? "#818cf8" : "#2563eb"}; }
  blockquote {
    margin: 8px 0;
    padding-left: 12px;
    border-left: 3px solid ${isDark ? "#475569" : "#d1d5db"};
    color: ${isDark ? "#94a3b8" : "#6b7280"};
  }
  pre { white-space: pre-wrap; overflow-x: auto; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { padding: 4px 8px; }
</style>
</head>
<body>${sanitizedHtml}</body>
</html>`;

      // Use srcdoc for better isolation — the iframe content is parsed as a
      // fresh document instead of being injected via document.write().
      iframe.srcdoc = content;
    },
    [],
  );

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const body = iframe.contentDocument?.body;
    if (!body) return;
    // Use scrollHeight to auto-size; add a small buffer to avoid scrollbars
    const height = body.scrollHeight;
    iframe.style.height = `${height + 2}px`;
  }, []);

  useEffect(() => {
    if (!html) return;

    let sanitizedHtml = sanitize(html);

    // Detect whether any images were blocked
    const blocked = !allowRemoteImages && sanitizedHtml.includes("data-blocked-src");
    setHasBlockedImages(blocked);

    // If the HTML has no block-level elements, it's likely plain text
    // wrapped in HTML. Convert \n to <br> to preserve line breaks.
    const hasBlockElements = /<(div|p|br|table|ul|ol|li|h[1-6]|blockquote|section|article|header|footer|pre)\b/i.test(sanitizedHtml);
    if (!hasBlockElements) {
      sanitizedHtml = sanitizedHtml.replace(/\n/g, "<br>");
    }

    writeToIframe(sanitizedHtml);

    // Resize after content is written
    // Use a small delay to let the browser finish layout
    const timerId = setTimeout(resizeIframe, 50);

    // Also listen for load events (images, etc.)
    const iframe = iframeRef.current;
    const handleLoad = () => {
      resizeIframe();
      // srcdoc is same-origin, so the parent can intercept in-email link clicks.
      iframe?.contentDocument?.addEventListener("click", handleIframeClick);
    };
    iframe?.addEventListener("load", handleLoad);

    return () => {
      clearTimeout(timerId);
      iframe?.removeEventListener("load", handleLoad);
      iframe?.contentDocument?.removeEventListener("click", handleIframeClick);
    };
  }, [html, sanitize, writeToIframe, resizeIframe, handleIframeClick]);

  // Plain text fallback
  if (!html) {
    return (
      <pre
        className="whitespace-pre-wrap font-sans text-sm text-text-primary"
        data-testid="email-renderer-text"
      >
        {text ?? ""}
      </pre>
    );
  }

  return (
    <div>
      {hasBlockedImages && onAllowSender && (
        <div
          className="mb-2 flex items-center gap-2 rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2 text-xs text-text-secondary"
          data-testid="blocked-images-banner"
        >
          <ShieldCheck className="h-4 w-4 flex-shrink-0 text-text-tertiary" />
          <span>{t("email.renderer.imagesBlocked")}</span>
          <button
            onClick={onAllowSender}
            className="ml-auto whitespace-nowrap rounded px-2 py-1 text-xs font-medium text-accent hover:bg-bg-hover"
            data-testid="allow-sender-images-btn"
          >
            {t("email.renderer.loadImages")}
          </button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        sandbox="allow-same-origin"
        title={t("email.renderer.iframeTitle")}
        data-testid="email-renderer-iframe"
        className="block w-full border-none"
        style={{ minHeight: "50px" }}
      />
      <LinkConfirmDialog
        isOpen={linkPrompt !== null}
        url={linkPrompt?.url ?? ""}
        displayText={linkPrompt?.text ?? null}
        onConfirm={() => {
          if (linkPrompt) void openExternalUrl(linkPrompt.url);
          setLinkPrompt(null);
        }}
        onCancel={() => setLinkPrompt(null)}
      />
    </div>
  );
}
