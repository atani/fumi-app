import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Plus, Check } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { AccountAvatar } from "./AccountAvatar";

export function AccountSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { accounts, activeAccountId, setActiveAccount, getActiveAccount } =
    useAccountStore();
  const { loadThreads, activeLabel } = useThreadStore();

  const activeAccount = getActiveAccount();

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
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      </button>

      {isOpen && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-lg">
          <div className="py-1">
            {accounts.map((account) => (
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
                {account.id === activeAccountId && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-border-primary py-1">
            <button
              onClick={handleAddAccount}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
              data-testid="add-account-button"
            >
              <Plus className="h-4 w-4" />
              Add account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
