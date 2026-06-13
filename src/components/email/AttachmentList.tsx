import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Image, FileText, File, Download } from "lucide-react";
import type { Account, Attachment } from "../../types";
import { getAttachmentData } from "../../services/gmail/api";

interface AttachmentListProps {
  attachments: Attachment[];
  account: Account;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  ) {
    return FileText;
  }
  if (mimeType.includes("attachment")) return Paperclip;
  return File;
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

export function AttachmentList({ attachments, account }: AttachmentListProps) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  const handleDownload = async (attachment: Attachment) => {
    setDownloading(attachment.id);
    try {
      const data = await getAttachmentData(
        account,
        attachment.message_id,
        attachment.id,
      );

      const bytes = base64UrlToBytes(data);
      const blob = new Blob([bytes], { type: attachment.mime_type });

      // Check if running inside Tauri
      if (
        typeof window !== "undefined" &&
        "__TAURI_INTERNALS__" in window
      ) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeFile } = await import("@tauri-apps/plugin-fs");
          const filePath = await save({
            defaultPath: attachment.filename,
            filters: [{ name: t("email.allFiles"), extensions: ["*"] }],
          });
          if (filePath) {
            await writeFile(filePath, bytes);
          }
        } catch {
          // Fall back to browser download if Tauri dialog fails
          triggerBrowserDownload(blob, attachment.filename);
        }
      } else {
        triggerBrowserDownload(blob, attachment.filename);
      }
    } catch (err) {
      console.error("Failed to download attachment:", err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid="attachment-list">
      {attachments.map((attachment) => {
        const Icon = getIcon(attachment.mime_type);
        const isDownloading = downloading === attachment.id;

        return (
          <button
            key={attachment.id}
            onClick={() => handleDownload(attachment)}
            disabled={isDownloading}
            className="flex items-center gap-2 rounded-lg border border-border-secondary bg-bg-secondary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            title={t("email.downloadAttachment", { filename: attachment.filename })}
            data-testid={`attachment-${attachment.id}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="max-w-[200px] truncate">
              {attachment.filename}
            </span>
            <span className="shrink-0 text-xs text-text-tertiary">
              {formatFileSize(attachment.size)}
            </span>
            <Download className="h-3 w-3 shrink-0" />
          </button>
        );
      })}
    </div>
  );
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
