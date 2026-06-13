import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Check } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { getUnreadCountsByAccount } from "../../services/notifications/badgeManager";
import { AccountAvatar } from "./AccountAvatar";

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function AccountSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadByAccount, setUnreadByAccount] = useState<Record<string, number>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { accounts, activeAccountId, setActiveAccount, getActiveAccount } =
    useAccountStore();
  const { loadThreads, activeLabel, threads } = useThreadStore();

  const activeAccount = getActiveAccount();

  const refreshUnread = useCallback(async () => {
    try {
      const counts = await getUnreadCountsByAccount();
      setUnreadByAccount(counts);
    } catch {
      // Unread badges are a convenience — ignore fetch failures
    }
  }, []);

  // Refresh when the switcher opens, on mount, and whenever thread state
  // changes (read/unread toggles, new mail arriving).
  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread, threads]);

  useEffect(() => {
    if (isOpen) void refreshUnread();
  }, [isOpen, refreshUnread]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!activeAccount) return null;

  const handleSwitch = async (accountId: string) => {
    if (accountId === activeAccountId) {
      setIsOpen(false);
      return;
    }
    setActiveAccount(accountId);
    await loadThreads(accountId, activeLabel);
    setIsOpen(false);
  };

  const handleAddAccount = () => {
    setIsOpen(false);
    navigate("/login");
  };

  const otherAccountsUnread = accounts
    .filter((a) => a.id !== activeAccountId)
    .reduce((sum, a) => sum + (unreadByAccount[a.id] ?? 0), 0);

  return (
    <div ref={dropdownRef} className="relative px-2 py-2">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-bg-hover"
        data-testid="account-switcher-trigger"
      >
        <AccountAvatar account={activeAccount} size="sm" />
        <span className="flex-1 truncate text-left text-text-primary">
          {activeAccount.email}
        </span>
        {otherAccountsUnread > 0 && (
          <span
            className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
            data-testid="other-accounts-unread-badge"
            aria-label={t("accounts.unreadInOtherAccounts", {
              count: otherAccountsUnread,
            })}
          >
            {formatCount(otherAccountsUnread)}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      </button>

      {isOpen && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-lg">
          <div className="py-1">
            {accounts.map((account) => {
              const unread = unreadByAccount[account.id] ?? 0;
              return (
                <button
                  key={account.id}
                  onClick={() => handleSwitch(account.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-bg-hover"
                  data-testid={`account-option-${account.id}`}
                >
                  <AccountAvatar account={account} size="sm" />
                  <span className="flex-1 truncate text-left text-text-primary">
                    {account.email}
                  </span>
                  {unread > 0 && (
                    <span
                      className="rounded-full bg-accent-light px-1.5 py-0.5 text-[10px] font-medium text-accent"
                      data-testid={`account-unread-${account.id}`}
                      aria-label={t("accounts.unread", { count: unread })}
                    >
                      {formatCount(unread)}
                    </span>
                  )}
                  {account.id === activeAccountId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-border-primary py-1">
            <button
              onClick={handleAddAccount}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
              data-testid="add-account-button"
            >
              <Plus className="h-4 w-4" />
              {t("accounts.addAccount")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
