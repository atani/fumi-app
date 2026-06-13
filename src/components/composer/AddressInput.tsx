import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { searchContacts } from "../../services/contacts/contactService";
import { useAccountStore } from "../../stores/accountStore";
import type { Contact } from "../../types";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Parse a comma-separated address string into individual chip entries,
 * preserving the last (potentially incomplete) entry as the current input.
 */
function parseChips(value: string): { chips: string[]; input: string } {
  if (!value) return { chips: [], input: "" };

  const parts = value.split(",");
  const last = parts.pop() ?? "";
  const chips = parts.map((p) => p.trim()).filter(Boolean);

  return { chips, input: last };
}

export function AddressInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: AddressInputProps) {
  const { t } = useTranslation();
  const { chips, input: currentInput } = parseChips(value);

  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { getActiveAccount } = useAccountStore();

  const fetchSuggestions = useCallback(
    async (query: string) => {
      const account = getActiveAccount();
      if (!account || query.length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const results = await searchContacts(account.id, query);
      // Filter out addresses already added as chips
      const chipsLower = new Set(chips.map((c) => c.toLowerCase()));
      const filtered = results.filter(
        (c) => !chipsLower.has(c.email.toLowerCase()),
      );

      setSuggestions(filtered);
      setSelectedIndex(0);
      setShowSuggestions(filtered.length > 0);
    },
    [getActiveAccount, chips],
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const query = currentInput.trim();
    if (!query) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [currentInput, fetchSuggestions]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const confirmAddress = useCallback(
    (address: string) => {
      const trimmed = address.trim();
      if (!trimmed) return;

      const newChips = [...chips, trimmed];
      onChange(newChips.join(", ") + ", ");
      setSuggestions([]);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [chips, onChange],
  );

  const removeChip = useCallback(
    (index: number) => {
      const newChips = chips.filter((_, i) => i !== index);
      const rest = currentInput.trim();
      if (newChips.length === 0 && !rest) {
        onChange("");
      } else if (newChips.length === 0) {
        onChange(rest);
      } else {
        onChange(newChips.join(", ") + ", " + rest);
      }
    },
    [chips, currentInput, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showSuggestions && suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const selected = suggestions[selectedIndex];
          if (selected) {
            confirmAddress(selected.email);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowSuggestions(false);
          return;
        }
      }

      // Confirm current input on Enter, Tab, or comma
      if (
        (e.key === "Enter" || e.key === "Tab" || e.key === ",") &&
        currentInput.trim()
      ) {
        e.preventDefault();
        confirmAddress(currentInput);
        return;
      }

      // Backspace on empty input removes last chip
      if (e.key === "Backspace" && !currentInput && chips.length > 0) {
        removeChip(chips.length - 1);
      }
    },
    [
      showSuggestions,
      suggestions,
      selectedIndex,
      currentInput,
      chips,
      confirmAddress,
      removeChip,
    ],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      // If user typed a comma at the end, confirm it as a chip
      if (newValue.endsWith(",")) {
        const addr = newValue.slice(0, -1).trim();
        if (addr) {
          confirmAddress(addr);
        }
        return;
      }

      // Rebuild the full value with existing chips + new input
      if (chips.length > 0) {
        onChange(chips.join(", ") + ", " + newValue);
      } else {
        onChange(newValue);
      }
    },
    [chips, onChange, confirmAddress],
  );

  return (
    <div ref={containerRef} className="relative flex flex-1 flex-wrap items-center gap-1">
      {chips.map((chip, index) => (
        <span
          key={`${chip}-${index}`}
          className="flex items-center gap-0.5 rounded bg-accent-light px-1.5 py-0.5 text-xs text-text-primary"
        >
          {chip}
          <button
            type="button"
            className="ml-0.5 rounded-full p-0.5 hover:bg-bg-hover"
            onClick={() => removeChip(index)}
            aria-label={t("composer.removeAddress", { address: chip })}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className="min-w-[120px] flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        placeholder={chips.length === 0 ? placeholder : ""}
        value={currentInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (currentInput.trim() && suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        autoFocus={autoFocus}
      />

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border border-border-primary bg-bg-primary shadow-lg">
          {suggestions.map((contact, index) => (
            <button
              key={contact.id}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                index === selectedIndex
                  ? "bg-bg-selected text-text-primary"
                  : "text-text-secondary hover:bg-bg-hover"
              }`}
              onMouseDown={(e) => {
                // Use mousedown to fire before blur
                e.preventDefault();
                confirmAddress(contact.email);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex flex-col">
                {contact.name && (
                  <span className="text-sm text-text-primary">
                    {contact.name}
                  </span>
                )}
                <span className="text-xs text-text-tertiary">
                  {contact.email}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
