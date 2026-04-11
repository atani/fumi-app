import { useState, useEffect, useRef, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Inbox,
  Star,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  Archive,
  Clock,
  Calendar,
  Sun,
  Moon,
  Monitor,
  Settings,
  PenSquare,
  Plus,
  Tag,
  PackageOpen,
  CheckSquare,
  FolderSearch,
  HelpCircle,
  Paperclip,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";
import { useUIStore } from "../../stores/uiStore";
import { useComposerStore } from "../../stores/composerStore";
import { useLabelStore } from "../../stores/labelStore";
import { useSmartFolderStore } from "../../stores/smartFolderStore";
import { AccountSwitcher } from "../accounts/AccountSwitcher";
import { LabelForm } from "../labels/LabelForm";
import { getBundleCounts } from "../../services/bundles/bundleManager";
import { executeSmartFolder } from "../../services/search/smartFolderService";
import type { LucideIcon } from "lucide-react";

interface DroppableLabelButtonProps {
  labelId: string;
  isActive: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  testId: string;
}

function DroppableLabelButton({
  labelId,
  isActive,
  onClick,
  onContextMenu,
  children,
  testId,
}: DroppableLabelButtonProps) {
  const { isOver, setNodeRef } = useDroppable({ id: labelId });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        isOver
          ? "bg-accent/20 ring-2 ring-accent ring-inset"
          : isActive
            ? "bg-bg-selected text-accent font-medium"
            : "text-sidebar-text hover:bg-bg-hover"
      }`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

const LABELS: { id: string; name: string; icon: LucideIcon }[] = [
  { id: "INBOX", name: "Inbox", icon: Inbox },
  { id: "STARRED", name: "Starred", icon: Star },
  { id: "SNOOZED", name: "Snoozed", icon: Clock },
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
  const { getActiveAccount, activeAccountId } = useAccountStore();
  const { theme, setTheme } = useUIStore();
  const { userLabels, loadLabels, createLabel, updateLabel, deleteLabel } =
    useLabelStore();
  const { folders: smartFolders, loadFolders: loadSmartFolders, activeSmartFolderId, setActiveSmartFolderId } =
    useSmartFolderStore();
  const navigate = useNavigate();

  // Bundles state
  const [bundles, setBundles] = useState<
    { ruleId: string; bundleName: string; count: number }[]
  >([]);

  // Label form state
  const [isLabelFormOpen, setIsLabelFormOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<{
    id: string;
    name: string;
    color: string | null;
  } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    labelId: string;
    labelName: string;
    labelColor: string | null;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Load user labels and bundle counts when account changes
  useEffect(() => {
    if (activeAccountId) {
      void loadLabels(activeAccountId);
      void loadSmartFolders(activeAccountId);
      void getBundleCounts(activeAccountId).then(setBundles);
    }
  }, [activeAccountId, loadLabels, loadSmartFolders]);

  // Refresh bundle counts periodically
  useEffect(() => {
    if (!activeAccountId) return;
    const interval = setInterval(() => {
      void getBundleCounts(activeAccountId).then(setBundles);
    }, 60_000);
    return () => clearInterval(interval);
  }, [activeAccountId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  const handleLabelClick = useCallback(
    async (labelId: string) => {
      setActiveSmartFolderId(null);
      setActiveLabel(labelId);
      const account = getActiveAccount();
      if (account) {
        await loadThreads(account.id, labelId);
      }
    },
    [setActiveLabel, setActiveSmartFolderId, getActiveAccount, loadThreads],
  );

  const handleSmartFolderClick = useCallback(
    async (folderId: string) => {
      const account = getActiveAccount();
      if (!account) return;
      const folder = smartFolders.find((f) => f.id === folderId);
      if (!folder) return;
      setActiveSmartFolderId(folderId);
      const threads = await executeSmartFolder(account, folder);
      useThreadStore.getState().setThreads(threads);
    },
    [getActiveAccount, smartFolders, setActiveSmartFolderId],
  );

  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent,
      labelId: string,
      labelName: string,
      labelColor: string | null,
    ) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, labelId, labelName, labelColor });
    },
    [],
  );

  const handleCreateLabel = useCallback(
    async (name: string, color: string | null) => {
      const account = getActiveAccount();
      if (!account) return;
      await createLabel(account, name, color);
    },
    [getActiveAccount, createLabel],
  );

  const handleUpdateLabel = useCallback(
    async (name: string, color: string | null) => {
      const account = getActiveAccount();
      if (!account || !editingLabel) return;
      await updateLabel(account, editingLabel.id, name, color);
      setEditingLabel(null);
    },
    [getActiveAccount, editingLabel, updateLabel],
  );

  const handleDeleteLabel = useCallback(
    async (labelId: string) => {
      const account = getActiveAccount();
      if (!account) return;
      await deleteLabel(account, labelId);
      setContextMenu(null);
    },
    [getActiveAccount, deleteLabel],
  );

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r border-border-primary bg-sidebar-bg"
      data-testid="sidebar"
    >
      <div
        className="flex h-10 items-center px-5 pt-1 font-bold text-text-primary"
        data-tauri-drag-region
        style={{ paddingLeft: "76px", WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        Fumi
      </div>

      <AccountSwitcher />

      <div className="px-3 py-2">
        <button
          onClick={() => useComposerStore.getState().openCompose()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          data-testid="compose-button"
        >
          <PenSquare className="h-4 w-4" />
          Compose
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {LABELS.map(({ id, name, icon: Icon }) => (
          <DroppableLabelButton
            key={id}
            labelId={id}
            isActive={activeLabel === id}
            onClick={() => void handleLabelClick(id)}
            testId={`sidebar-label-${id}`}
          >
            <Icon className="h-4 w-4" />
            {name}
          </DroppableLabelButton>
        ))}

        {/* User labels section */}
        {userLabels.length > 0 && (
          <>
            <div className="mt-3 mb-1 flex items-center justify-between px-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                Labels
              </span>
              <button
                onClick={() => setIsLabelFormOpen(true)}
                className="rounded p-0.5 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
                title="Create label"
                data-testid="create-label-btn"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {userLabels.map((label) => (
              <DroppableLabelButton
                key={label.id}
                labelId={label.id}
                isActive={activeLabel === label.id}
                onClick={() => void handleLabelClick(label.id)}
                onContextMenu={(e) =>
                  handleContextMenu(e, label.id, label.name, label.color)
                }
                testId={`sidebar-label-${label.id}`}
              >
                {label.color ? (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                ) : (
                  <Tag className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{label.name}</span>
              </DroppableLabelButton>
            ))}
          </>
        )}

        {userLabels.length === 0 && (
          <div className="mt-3 px-3">
            <button
              onClick={() => setIsLabelFormOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text hover:bg-bg-hover"
              data-testid="create-label-btn"
            >
              <Plus className="h-4 w-4" />
              Create label
            </button>
          </div>
        )}

        {/* Bundles section */}
        {bundles.length > 0 && (
          <>
            <div className="mt-3 mb-1 px-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                Bundles
              </span>
            </div>
            {bundles.map((bundle) => (
              <button
                key={bundle.ruleId}
                onClick={() => void handleLabelClick("BUNDLED")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeLabel === "BUNDLED"
                    ? "bg-bg-selected text-accent font-medium"
                    : "text-sidebar-text hover:bg-bg-hover"
                }`}
                data-testid={`sidebar-bundle-${bundle.ruleId}`}
              >
                <PackageOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">{bundle.bundleName}</span>
                <span className="ml-auto shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">
                  {bundle.count}
                </span>
              </button>
            ))}
          </>
        )}

        {/* Smart folders section */}
        {smartFolders.length > 0 && (
          <>
            <div className="mt-3 mb-1 px-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                Smart Folders
              </span>
            </div>
            {smartFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => void handleSmartFolderClick(folder.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeSmartFolderId === folder.id
                    ? "bg-bg-selected text-accent font-medium"
                    : "text-sidebar-text hover:bg-bg-hover"
                }`}
                data-testid={`sidebar-smart-folder-${folder.id}`}
              >
                <FolderSearch className="h-4 w-4 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-border-primary px-2 py-2">
        <button
          onClick={() => navigate("/tasks")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text transition-colors hover:bg-bg-hover"
          data-testid="sidebar-tasks"
        >
          <CheckSquare className="h-4 w-4" />
          Tasks
        </button>
        <button
          onClick={() => navigate("/attachments")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text transition-colors hover:bg-bg-hover"
          data-testid="sidebar-attachments"
        >
          <Paperclip className="h-4 w-4" />
          Attachments
        </button>
        <button
          onClick={() => navigate("/calendar")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text transition-colors hover:bg-bg-hover"
          data-testid="sidebar-calendar"
        >
          <Calendar className="h-4 w-4" />
          Calendar
        </button>
        <button
          onClick={() => navigate("/help")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text transition-colors hover:bg-bg-hover"
          data-testid="sidebar-help"
        >
          <HelpCircle className="h-4 w-4" />
          Help
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text transition-colors hover:bg-bg-hover"
          data-testid="sidebar-settings"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
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

      {/* Context menu for user labels */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-32 rounded-lg border border-border-primary bg-bg-primary py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-testid="label-context-menu"
        >
          <button
            onClick={() => {
              setEditingLabel({
                id: contextMenu.labelId,
                name: contextMenu.labelName,
                color: contextMenu.labelColor,
              });
              setContextMenu(null);
            }}
            className="flex w-full items-center px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover"
          >
            Edit
          </button>
          <button
            onClick={() => void handleDeleteLabel(contextMenu.labelId)}
            className="flex w-full items-center px-3 py-1.5 text-sm text-danger hover:bg-bg-hover"
          >
            Delete
          </button>
        </div>
      )}

      {/* Create label form */}
      <LabelForm
        isOpen={isLabelFormOpen}
        onClose={() => setIsLabelFormOpen(false)}
        onSave={(name, color) => void handleCreateLabel(name, color)}
        title="Create label"
      />

      {/* Edit label form */}
      <LabelForm
        isOpen={editingLabel !== null}
        onClose={() => setEditingLabel(null)}
        onSave={(name, color) => void handleUpdateLabel(name, color)}
        initialName={editingLabel?.name}
        initialColor={editingLabel?.color}
        title="Edit label"
      />
    </aside>
  );
}
