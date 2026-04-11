import { useEffect } from "react";

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  keys: string[];
  description: string;
}

const SHORTCUT_SECTIONS: { title: string; shortcuts: ShortcutEntry[] }[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["j"], description: "Next thread" },
      { keys: ["k"], description: "Previous thread" },
      { keys: ["o", "Enter"], description: "Open thread" },
      { keys: ["g i"], description: "Go to Inbox" },
      { keys: ["g s"], description: "Go to Starred" },
      { keys: ["g t"], description: "Go to Sent" },
      { keys: ["g d"], description: "Go to Drafts" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["e"], description: "Archive" },
      { keys: ["s"], description: "Toggle star" },
      { keys: ["#"], description: "Trash" },
    ],
  },
  {
    title: "Compose",
    shortcuts: [
      { keys: ["c"], description: "Compose new email" },
      { keys: ["r"], description: "Reply" },
      { keys: ["a"], description: "Reply all" },
      { keys: ["f"], description: "Forward" },
    ],
  },
  {
    title: "Other",
    shortcuts: [
      { keys: ["/", "Ctrl+K"], description: "Search" },
      { keys: ["?"], description: "Keyboard shortcuts" },
      { keys: ["Esc"], description: "Close / Deselect" },
    ],
  },
];

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }

    // Use capture to intercept before the main shortcut handler
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("keydown", handleKey, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="shortcuts-help-overlay"
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-bg-primary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="shortcuts-help-modal"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            Esc
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-sm font-medium text-text-secondary">
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.description}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-text-primary">
                      {shortcut.description}
                    </span>
                    <span className="flex gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-text-secondary"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
