import { useState, useEffect, useCallback } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import type { Account, Attachment } from "../../types";
import { getAttachmentData } from "../../services/gmail/api";

interface InlineAttachmentPreviewProps {
  attachment: Attachment;
  account: Account;
}

function base64UrlToDataUrl(base64url: string, mimeType: string): string {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    base64.length % 4 === 0
      ? base64
      : base64 + "=".repeat(4 - (base64.length % 4));
  return `data:${mimeType};base64,${padded}`;
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    base64.length % 4 === 0
      ? base64
      : base64 + "=".repeat(4 - (base64.length % 4));
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Inline preview for image/* attachments (thumbnail) and PDF (icon).
 * Click triggers download via Tauri dialog or browser fallback.
 */
export function InlineAttachmentPreview({
  attachment,
  account,
}: InlineAttachmentPreviewProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isImage = attachment.mime_type.startsWith("image/");
  const isPdf = attachment.mime_type === "application/pdf";

  // Fetch thumbnail data for image attachments
  useEffect(() => {
    if (!isImage) return;

    let cancelled = false;
    setLoading(true);

    getAttachmentData(account, attachment.message_id, attachment.id)
      .then((data) => {
        if (!cancelled) {
          setThumbnailUrl(base64UrlToDataUrl(data, attachment.mime_type));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load inline preview:", err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [account, attachment.id, attachment.message_id, attachment.mime_type, isImage]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const data = await getAttachmentData(
        account,
        attachment.message_id,
        attachment.id,
      );

      const bytes = base64UrlToBytes(data);
      const blob = new Blob([bytes], { type: attachment.mime_type });

      if (
        typeof window !== "undefined" &&
        "__TAURI_INTERNALS__" in window
      ) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeFile } = await import("@tauri-apps/plugin-fs");
          const filePath = await save({
            defaultPath: attachment.filename,
            filters: [{ name: "All Files", extensions: ["*"] }],
          });
          if (filePath) {
            await writeFile(filePath, bytes);
          }
        } catch {
          triggerBrowserDownload(blob, attachment.filename);
        }
      } else {
        triggerBrowserDownload(blob, attachment.filename);
      }
    } catch (err) {
      console.error("Failed to download attachment:", err);
    } finally {
      setDownloading(false);
    }
  }, [account, attachment]);

  if (isImage) {
    return (
      <div
        className="group relative inline-block cursor-pointer overflow-hidden rounded-lg border border-border-secondary"
        data-testid={`inline-preview-${attachment.id}`}
      >
        {loading ? (
          <div className="flex h-20 w-20 items-center justify-center bg-bg-secondary">
            <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={attachment.filename}
            className="h-20 w-auto max-w-[160px] object-cover"
            onClick={() => void handleDownload()}
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center bg-bg-secondary text-xs text-text-tertiary">
            Failed
          </div>
        )}
        <button
          onClick={() => void handleDownload()}
          disabled={downloading}
          className="absolute bottom-1 right-1 hidden rounded bg-black/60 p-1 text-white group-hover:block"
          title={`Download ${attachment.filename}`}
        >
          <Download className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (isPdf) {
    return (
      <button
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="flex items-center gap-2 rounded-lg border border-border-secondary bg-bg-secondary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50"
        title={`Download ${attachment.filename}`}
        data-testid={`inline-preview-${attachment.id}`}
      >
        <FileText className="h-5 w-5 flex-shrink-0 text-red-500" />
        <span className="max-w-[160px] truncate">{attachment.filename}</span>
        <Download className="h-3 w-3 flex-shrink-0" />
      </button>
    );
  }

  // Non-image, non-PDF: don't render inline preview
  return null;
}
