import { useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";

interface EmailRendererProps {
  html: string | null;
  text: string | null;
  /** When true, remote images are loaded instead of blocked. */
  allowRemoteImages?: boolean;
}

/**
 * Sanitise HTML with DOMPurify, block remote images, and render inside
 * a sandboxed iframe that auto-resizes to its content height.
 */
export function EmailRenderer({
  html,
  text,
  allowRemoteImages = false,
}: EmailRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sanitize = useCallback(
    (dirty: string): string => {
      // DOMPurify: strip scripts, on* handlers, and dangerous tags
      const clean = DOMPurify.sanitize(dirty, {
        WHOLE_DOCUMENT: false,
        FORBID_TAGS: ["form", "input", "textarea", "select", "button", "script"],
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
            img.getAttribute("alt") ?? "[Image blocked]",
          );
        }
      });

      return doc.body.innerHTML;
    },
    [allowRemoteImages],
  );

  const writeToIframe = useCallback(
    (sanitizedHtml: string) => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const doc = iframe.contentDocument;
      if (!doc) return;

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

      doc.open();
      doc.write(content);
      doc.close();
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
    const handleLoad = () => resizeIframe();
    iframe?.addEventListener("load", handleLoad);

    return () => {
      clearTimeout(timerId);
      iframe?.removeEventListener("load", handleLoad);
    };
  }, [html, sanitize, writeToIframe, resizeIframe]);

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
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      title="Email content"
      data-testid="email-renderer-iframe"
      className="block w-full border-none"
      style={{ minHeight: "50px" }}
    />
  );
}
