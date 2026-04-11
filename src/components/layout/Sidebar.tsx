import {
  Inbox,
  Star,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  Archive,
} from "lucide-react";
import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";

const LABELS = [
  { id: "INBOX", name: "Inbox", icon: Inbox },
  { id: "STARRED", name: "Starred", icon: Star },
  { id: "SENT", name: "Sent", icon: Send },
  { id: "DRAFT", name: "Drafts", icon: FileText },
  { id: "TRASH", name: "Trash", icon: Trash2 },
  { id: "SPAM", name: "Spam", icon: AlertOctagon },
  { id: "ARCHIVE", name: "All Mail", icon: Archive },
];

export function Sidebar() {
  const { activeLabel, setActiveLabel, loadThreads } = useThreadStore();
  const { getActiveAccount } = useAccountStore();

  const handleLabelClick = async (labelId: string) => {
    setActiveLabel(labelId);
    const account = getActiveAccount();
    if (account) {
      await loadThreads(account.id, labelId);
    }
  };

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r border-border-primary bg-sidebar-bg"
      data-testid="sidebar"
    >
      <div className="flex h-10 items-center px-5 font-bold text-text-primary">
        Fumi
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {LABELS.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleLabelClick(id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              activeLabel === id
                ? "bg-bg-selected text-accent font-medium"
                : "text-sidebar-text hover:bg-bg-hover"
            }`}
            data-testid={`sidebar-label-${id}`}
          >
            <Icon className="h-4 w-4" />
            {name}
          </button>
        ))}
      </nav>
    </aside>
  );
}
