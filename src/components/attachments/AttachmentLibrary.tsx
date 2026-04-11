import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Grid3X3, List, Paperclip } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccountStore } from "../../stores/accountStore";
import { getAllAttachmentsByAccount } from "../../services/db/attachments";
import { AttachmentGridItem } from "./AttachmentGridItem";
import { AttachmentListItem } from "./AttachmentListItem";
import type { AttachmentWithDate } from "../../services/db/attachments";

type ViewMode = "grid" | "list";
type TypeFilter = "all" | "images" | "documents";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "documents", label: "Documents" },
];

function matchesTypeFilter(mimeType: string, filter: TypeFilter): boolean {
  switch (filter) {
    case "images":
      return mimeType.startsWith("image/");
    case "documents":
      return (
        mimeType.includes("pdf") ||
        mimeType.includes("document") ||
        mimeType.includes("text") ||
        mimeType.includes("spreadsheet") ||
        mimeType.includes("csv") ||
        mimeType.includes("presentation")
      );
    case "all":
    default:
      return true;
  }
}

function groupByDate(
  attachments: AttachmentWithDate[],
): { label: string; items: AttachmentWithDate[] }[] {
  const groups = new Map<string, AttachmentWithDate[]>();

  for (const att of attachments) {
    const dateStr = att.message_date;
    let label: string;

    if (!dateStr) {
      label = "Unknown date";
    } else {
      const d = new Date(dateStr);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const attDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.floor(
        (today.getTime() - attDay.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) {
        label = "Today";
      } else if (diffDays === 1) {
        label = "Yesterday";
      } else if (diffDays < 7) {
        label = "This week";
      } else if (diffDays < 30) {
        label = "This month";
      } else {
        label = d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
        });
      }
    }

    const existing = groups.get(label);
    if (existing) {
      existing.push(att);
    } else {
      groups.set(label, [att]);
    }
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

export function AttachmentLibrary() {
  const navigate = useNavigate();
  const { activeAccountId } = useAccountStore();
  const [attachments, setAttachments] = useState<AttachmentWithDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    if (!activeAccountId) return;
    setLoading(true);
    getAllAttachmentsByAccount(activeAccountId)
      .then(setAttachments)
      .catch((err: unknown) => {
        console.error("Failed to load attachments:", err);
      })
      .finally(() => setLoading(false));
  }, [activeAccountId]);

  const filtered = useMemo(
    () =>
      attachments.filter((a) => matchesTypeFilter(a.mime_type, typeFilter)),
    [attachments, typeFilter],
  );

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* Drag region */}
      <div
        className="h-10 shrink-0 bg-bg-primary"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-primary px-6 pb-4">
        <button
          onClick={() => navigate("/")}
          className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          data-testid="attachment-library-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Paperclip className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold text-text-primary">Attachments</h1>

        <div className="ml-auto flex items-center gap-2">
          {/* Type filter */}
          <div className="flex rounded-lg border border-border-primary bg-bg-secondary p-0.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === f.id
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                data-testid={`filter-${f.id}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-lg border border-border-primary bg-bg-secondary p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Grid view"
              data-testid="view-mode-grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 transition-colors ${
                viewMode === "list"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="List view"
              data-testid="view-mode-list"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-text-secondary">Loading attachments...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Paperclip className="h-12 w-12 text-text-tertiary" />
            <p className="text-text-secondary">No attachments found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.label}>
                <h2 className="mb-3 text-sm font-medium text-text-tertiary">
                  {group.label}
                </h2>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {group.items.map((att) => (
                      <AttachmentGridItem
                        key={att.id}
                        filename={att.filename}
                        mimeType={att.mime_type}
                        size={att.size}
                        date={att.message_date}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {group.items.map((att) => (
                      <AttachmentListItem
                        key={att.id}
                        filename={att.filename}
                        mimeType={att.mime_type}
                        size={att.size}
                        date={att.message_date}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
