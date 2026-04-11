import { File, Image, FileText, FileSpreadsheet, Film, Music, Download } from "lucide-react";

interface AttachmentListItemProps {
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

export function AttachmentListItem({ filename, mimeType, size, date }: AttachmentListItemProps) {
  const Icon = getFileIcon(mimeType);
  const iconColor = getFileColor(mimeType);

  return (
    <div
      className="group flex items-center gap-4 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 transition-colors hover:bg-bg-hover"
      data-testid="attachment-list-item"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg-primary">
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-text-primary" title={filename}>
          {filename}
        </span>
        <span className="text-xs text-text-tertiary">
          {formatFileSize(size)}
        </span>
      </div>
      {date && (
        <span className="shrink-0 text-xs text-text-tertiary">
          {new Date(date).toLocaleDateString()}
        </span>
      )}
      <button
        className="shrink-0 rounded-md p-2 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}
