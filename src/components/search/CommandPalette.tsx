import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Search, Sparkles, X } from "lucide-react";
import { search } from "../../services/search/searchService";
import { parseSearchQuery } from "../../services/search/searchParser";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { AskInbox } from "./AskInbox";
import {
  loadHistory,
  saveHistory,
  addToHistory,
  removeFromHistory,
} from "./searchHistory";
import type { Thread } from "../../types";

type PaletteMode = "search" | "ask";

const OPERATOR_HINTS: { operator: string; descriptionKey: string }[] = [
  { operator: "from:", descriptionKey: "search.operatorFrom" },
  { operator: "to:", descriptionKey: "search.operatorTo" },
  { operator: "subject:", descriptionKey: "search.operatorSubject" },
  { operator: "has:attachment", descriptionKey: "search.operatorHasAttachment" },
  { operator: "is:unread", descriptionKey: "search.operatorIsUnread" },
  { operator: "is:read", descriptionKey: "search.operatorIsRead" },
  { operator: "is:starred", descriptionKey: "search.operatorIsStarred" },
  { operator: "before:", descriptionKey: "search.operatorBefore" },
  { operator: "after:", descriptionKey: "search.operatorAfter" },
  { operator: "label:", descriptionKey: "search.operatorLabel" },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split `text` on the highlightable tokens and return React nodes with
 * matching segments wrapped in <mark>. Matching is case-insensitive and
 * ignores overlapping/duplicate tokens.
 */
function highlightText(text: string, tokens: string[]): React.ReactNode {
  if (!text || tokens.length === 0) return text;
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return text;
  const pattern = new RegExp(`(${unique.map(escapeRegex).join("|")})`, "ig");
  // With a capturing group, split produces ["before", "match", "between", ...]
  // so odd indices are always match segments.
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded bg-accent-light px-0.5 text-accent"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Thread[]>([]);
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<PaletteMode>("search");
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { getActiveAccount } = useAccountStore();
  const { selectThread } = useThreadStore();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  // Focus input and reload history when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setMode("search");
      setHistory(loadHistory());
      setLastSearchedQuery("");
      // Small delay to let the DOM render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const recordHistory = useCallback((q: string) => {
    setHistory((prev) => {
      const next = addToHistory(prev, q);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeHistoryItem = useCallback((q: string) => {
    setHistory((prev) => {
      const next = removeFromHistory(prev, q);
      saveHistory(next);
      return next;
    });
  }, []);

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
          setLastSearchedQuery(q);
          recordHistory(q);
        } catch {
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [getActiveAccount, recordHistory],
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

  const handleSelectHistory = (q: string) => {
    setQuery(q);
    doSearch(q);
    inputRef.current?.focus();
  };

  const highlightTokens = useMemo(() => {
    if (!lastSearchedQuery) return [];
    const parsed = parseSearchQuery(lastSearchedQuery);
    const tokens: string[] = [];
    if (parsed.freeText) {
      tokens.push(...parsed.freeText.split(/\s+/).filter(Boolean));
    }
    if (parsed.operators.from) tokens.push(...parsed.operators.from);
    if (parsed.operators.to) tokens.push(...parsed.operators.to);
    if (parsed.operators.subject) tokens.push(...parsed.operators.subject);
    return tokens;
  }, [lastSearchedQuery]);

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
            {t("search.modeSearch")}
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
            {t("search.modeAsk")}
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
            placeholder={
              mode === "search"
                ? t("search.searchPlaceholder")
                : t("search.askPlaceholder")
            }
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
            data-testid="command-palette-input"
          />
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("search.closeSearch")}
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
                <span className="text-text-tertiary">{t(hint.descriptionKey)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Results (search mode) */}
        {mode === "search" && (
          <div className="max-h-80 overflow-y-auto">
            {isSearching && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                {t("search.searching")}
              </div>
            )}

            {!isSearching && query.trim() && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                {t("search.noResults")}
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
                      {highlightText(
                        thread.subject || t("search.noSubject"),
                        highlightTokens,
                      )}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-text-tertiary">
                      {formatDate(thread.last_message_at)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-text-secondary">
                    {highlightText(thread.snippet ?? "", highlightTokens)}
                  </p>
                </button>
              ))}

            {!query.trim() && !isSearching && history.length > 0 && (
              <div data-testid="search-history">
                <div className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">
                  {t("search.recentSearches")}
                </div>
                {history.map((item) => (
                  <div
                    key={item}
                    className="group flex items-center gap-2 px-4 py-2 hover:bg-bg-hover"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    <button
                      type="button"
                      onClick={() => handleSelectHistory(item)}
                      className="flex-1 truncate text-left text-sm text-text-secondary hover:text-text-primary"
                      data-testid="search-history-item"
                    >
                      {item}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeHistoryItem(item);
                      }}
                      className="shrink-0 rounded p-1 text-text-tertiary opacity-0 hover:bg-bg-primary hover:text-text-primary group-hover:opacity-100"
                      aria-label={t("search.removeFromHistory", { query: item })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!query.trim() && !isSearching && history.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                {t("search.emptyPrompt")}
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
            {mode === "search" ? t("search.footerAskAi") : t("search.footerSearch")}
          </span>
          {mode === "search" && (
            <>
              <span>
                <kbd className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono">
                  ↑↓
                </kbd>{" "}
                {t("search.footerNavigate")}
              </span>
              <span>
                <kbd className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono">
                  ↵
                </kbd>{" "}
                {t("search.footerOpen")}
              </span>
            </>
          )}
          <span>
            <kbd className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono">
              esc
            </kbd>{" "}
            {t("search.footerClose")}
          </span>
        </div>
      </div>
    </div>
  );
}
