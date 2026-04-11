import {
  Inbox,
  Star,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  Archive,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";
import { useUIStore } from "../../stores/uiStore";
import { AccountSwitcher } from "../accounts/AccountSwitcher";

const LABELS = [
  { id: "INBOX", name: "Inbox", icon: Inbox },
  { id: "STARRED", name: "Starred", icon: Star },
  { id: "SENT", name: "Sent", icon: Send },
  { id: "DRAFT", name: "Drafts", icon: FileText },
  { id: "TRASH", name: "Trash", icon: Trash2 },
  { id: "SPAM", name: "Spam", icon: AlertOctagon },
  { id: "ARCHIVE", name: "All Mail", icon: Archive },
];

const THEME_CYCLE: Record<string, "light" | "dark" | "system"> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const THEME_ICON = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

const THEME_LABEL = {
  system: "System",
  light: "Light",
  dark: "Dark",
} as const;

export function Sidebar() {
  const { activeLabel, setActiveLabel, loadThreads } = useThreadStore();
  const { getActiveAccount } = useAccountStore();
  const { theme, setTheme } = useUIStore();

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
      <div
        className="flex h-10 items-center px-5 pt-1 font-bold text-text-primary"
        data-tauri-drag-region
        style={{ paddingLeft: "76px" }}
      >
        Fumi
      </div>

      <AccountSwitcher />

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

      <div className="border-t border-border-primary px-2 py-2">
        <button
          onClick={() => setTheme(THEME_CYCLE[theme] ?? "system")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text transition-colors hover:bg-bg-hover"
          data-testid="theme-toggle"
          title={`Theme: ${THEME_LABEL[theme]}`}
        >
          {(() => {
            const ThemeIcon = THEME_ICON[theme];
            return <ThemeIcon className="h-4 w-4" />;
          })()}
          {THEME_LABEL[theme]}
        </button>
      </div>
    </aside>
  );
}
