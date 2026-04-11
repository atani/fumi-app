import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { useComposerStore } from "../../stores/composerStore";
import type { ComposerAttachment } from "../../types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — extract the base64 part
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function pickFilesViaTauri(): Promise<ComposerAttachment[]> {
  if (
    typeof window === "undefined" ||
    !("__TAURI_INTERNALS__" in window)
  ) {
    return [];
  }

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");

    const selected = await open({
      multiple: true,
      title: "Attach files",
    });

    if (!selected) return [];

    const paths = Array.isArray(selected) ? selected : [selected];
    const attachments: ComposerAttachment[] = [];

    for (const filePath of paths) {
      const bytes = await readFile(filePath);
      // Convert Uint8Array to base64
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);
      const filename = filePath.split(/[/\\]/).pop() ?? "file";
      const mimeType = guessMimeType(filename);

      attachments.push({
        id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        filename,
        mime_type: mimeType,
        size: bytes.length,
        data: base64,
      });
    }

    return attachments;
  } catch {
    return [];
  }
}

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}

export function AttachmentPicker() {
  const { attachments, addAttachment, removeAttachment } = useComposerStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBrowserFilePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const base64 = await fileToBase64(file);
      addAttachment({
        id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size: file.size,
        data: base64,
      });
    }

    // Reset so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = async () => {
    // Try Tauri dialog first
    if (
      typeof window !== "undefined" &&
      "__TAURI_INTERNALS__" in window
    ) {
      const tauriAttachments = await pickFilesViaTauri();
      for (const attachment of tauriAttachments) {
        addAttachment(attachment);
      }
      return;
    }

    // Fall back to browser file input
    fileInputRef.current?.click();
  };

  return (
    <div data-testid="attachment-picker">
      <button
        type="button"
        onClick={handleClick}
        className="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        title="Attach files"
        aria-label="Attach files"
      >
        <Paperclip className="h-4 w-4" />
      </button>

      {/* Hidden file input for browser fallback */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleBrowserFilePick}
        data-testid="attachment-file-input"
      />

      {/* Attached file chips */}
      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" data-testid="attachment-chips">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="flex items-center gap-1 rounded-md bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[150px] truncate">
                {attachment.filename}
              </span>
              <span className="text-text-tertiary">
                {formatFileSize(attachment.size)}
              </span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="ml-0.5 rounded hover:text-danger"
                title={`Remove ${attachment.filename}`}
                aria-label={`Remove ${attachment.filename}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
