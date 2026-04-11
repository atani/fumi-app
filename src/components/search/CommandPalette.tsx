import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { search } from "../../services/search/searchService";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { AskInbox } from "./AskInbox";
import type { Thread } from "../../types";

type PaletteMode = "search" | "ask";

const OPERATOR_HINTS: { operator: string; description: string }[] = [
  { operator: "from:", description: "sender address" },
  { operator: "to:", description: "recipient address" },
  { operator: "subject:", description: "subject line" },
  { operator: "has:attachment", description: "has attachment" },
  { operator: "is:unread", description: "unread threads" },
  { operator: "is:read", description: "read threads" },
  { operator: "is:starred", description: "starred threads" },
  { operator: "before:", description: "before date (YYYY-MM-DD)" },
  { operator: "after:", description: "after date (YYYY-MM-DD)" },
  { operator: "label:", description: "label name" },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Thread[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<PaletteMode>("search");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { getActiveAccount } = useAccountStore();
  const { selectThread } = useThreadStore();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setMode("search");
      // Small delay to let the DOM render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Debounced search
  const doSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!q.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        const account = getActiveAccount();
        if (!account) {
          setIsSearching(false);
          return;
        }

        try {
          const found = await search(account, q);
          setResults(found);
          setSelectedIndex(0);
        } catch {
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [getActiveAccount],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Compute matching operator hints based on the last word being typed
  const matchingHints = useMemo(() => {
    if (!query) return [];
    // Grab the last whitespace-delimited token
    const lastToken = query.split(/\s+/).pop() ?? "";
    if (!lastToken) return [];
    const lower = lastToken.toLowerCase();
    // Show hints when the token looks like the start of an operator
    return OPERATOR_HINTS.filter(
      (h) => h.operator.startsWith(lower) && h.operator !== lower,
    );
  }, [query]);

  const handleApplyHint = (operator: string) => {
    // Replace the partial token with the full operator
    const tokens = query.split(/\s+/);
    tokens[tokens.length - 1] = operator;
    const next = tokens.join(" ");
    setQuery(next);
    doSearch(next);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (mode === "search") {
      doSearch(value);
    }
  };

  const handleSelectThread = (thread: Thread) => {
    selectThread(thread.id, activeAccountId ?? undefined);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Tab":
        e.preventDefault();
        setMode((prev) => (prev === "search" ? "ask" : "search"));
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (mode === "search") {
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (mode === "search") {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
        break;
      case "Enter":
        e.preventDefault();
        if (mode === "search" && results[selectedIndex]) {
          handleSelectThread(results[selectedIndex]);
        }
        break;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      data-testid="command-palette-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl rounded-xl border border-border-primary bg-bg-primary shadow-2xl"
        data-testid="command-palette"
      >
        {/* Mode tabs */}
        <div className="flex border-b border-border-primary" data-testid="palette-mode-tabs">
          <button
            onClick={() => setMode("search")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
              mode === "search"
                ? "border-b-2 border-accent text-accent"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
            data-testid="palette-mode-search"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
          <button
            onClick={() => setMode("ask")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors ${
              mode === "ask"
                ? "border-b-2 border-accent text-accent"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
            data-testid="palette-mode-ask"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI
          </button>
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border-primary px-4 py-3">
          {mode === "search" ? (
            <Search className="h-5 w-5 shrink-0 text-text-tertiary" />
          ) : (
            <Sparkles className="h-5 w-5 shrink-0 text-accent" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder={mode === "search" ? "Search emails..." : "Ask about your inbox..."}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
            data-testid="command-palette-input"
          />
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Operator hints */}
        {matchingHints.length > 0 && (
          <div
            className="flex flex-wrap gap-2 border-b border-border-primary px-4 py-2"
            data-testid="operator-hints"
          >
            {matchingHints.map((hint) => (
              <button
                key={hint.operator}
                type="button"
                onClick={() => handleApplyHint(hint.operator)}
                className="rounded-md bg-bg-secondary px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              >
                <span className="font-mono font-semibold">{hint.operator}</span>{" "}
                <span className="text-text-tertiary">{hint.description}</span>
              </button>
            ))}
          </div>
        )}

        {/* Results (search mode) */}
        {mode === "search" && (
          <div className="max-h-80 overflow-y-auto">
            {isSearching && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                Searching...
              </div>
            )}

            {!isSearching && query.trim() && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                No results found
              </div>
            )}

            {!isSearching &&
              results.map((thread, index) => (
                <button
                  key={thread.id}
                  onClick={() => handleSelectThread(thread)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-bg-selected"
                      : "hover:bg-bg-hover"
                  }`}
                  data-testid={`search-result-${thread.id}`}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`truncate text-sm ${
                        !thread.is_read
                          ? "font-semibold text-text-primary"
                          : "text-text-primary"
                      }`}
                    >
                      {thread.subject || "(No subject)"}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-text-tertiary">
                      {formatDate(thread.last_message_at)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-text-secondary">
                    {thread.snippet}
                  </p>
                </button>
              ))}

            {!query.trim() && !isSearching && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                Type to search your emails
              </div>
            )}
          </div>
        )}

        {/* Ask AI mode */}
        {mode === "ask" && <AskInbox query={query} />}

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-border-primary px-4 py-2 text-xs text-text-tertiary">
          <span>
            <kbd className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono">
              Tab
            </kbd>{" "}
            {mode === "search" ? "ask AI" : "search"}
          </span>
          {mode === "search" && (
            <>
              <span>
                <kbd className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono">
                  ↑↓
                </kbd>{" "}
                navigate
              </span>
              <span>
                <kbd className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono">
                  ↵
                </kbd>{" "}
                open
              </span>
            </>
          )}
          <span>
            <kbd className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono">
              esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
