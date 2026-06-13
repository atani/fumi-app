import { File, Image, FileText, FileSpreadsheet, Film, Music, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AttachmentGridItemProps {
  filename: string;
  mimeType: string;
  size: number;
  date: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Film;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv")) return FileSpreadsheet;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) return FileText;
  return File;
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "text-blue-500";
  if (mimeType.startsWith("video/")) return "text-purple-500";
  if (mimeType.startsWith("audio/")) return "text-pink-500";
  if (mimeType.includes("pdf")) return "text-red-500";
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv")) return "text-green-500";
  if (mimeType.includes("document") || mimeType.includes("text")) return "text-orange-500";
  return "text-text-tertiary";
}

export function AttachmentGridItem({ filename, mimeType, size, date }: AttachmentGridItemProps) {
  const { t } = useTranslation();
  const Icon = getFileIcon(mimeType);
  const iconColor = getFileColor(mimeType);

  return (
    <div
      className="group flex flex-col rounded-lg border border-border-primary bg-bg-secondary p-4 transition-colors hover:bg-bg-hover"
      data-testid="attachment-grid-item"
    >
      <div className="mb-3 flex h-20 items-center justify-center rounded-md bg-bg-primary">
        <Icon className={`h-10 w-10 ${iconColor}`} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-text-primary" title={filename}>
          {filename}
        </span>
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>{formatFileSize(size)}</span>
          {date && (
            <span>{new Date(date).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      <button
        className="mt-2 flex items-center justify-center gap-1 rounded-md bg-bg-primary px-2 py-1.5 text-xs text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
        title={t("attachments.download")}
      >
        <Download className="h-3.5 w-3.5" />
        {t("attachments.download")}
      </button>
    </div>
  );
}
