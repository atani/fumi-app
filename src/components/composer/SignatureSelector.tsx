import { useState, useEffect, useRef, useCallback } from "react";
import { PenLine } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import { useComposerStore } from "../../stores/composerStore";
import { getAllSignatures, getDefaultSignature } from "../../services/db/signatures";
import type { Signature } from "../../types";

export function SignatureSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [activeSignatureId, setActiveSignatureId] = useState<string | null>(null);
  const { getActiveAccount } = useAccountStore();
  const { body, updateField, mode } = useComposerStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Append default signature when composer opens for new message
  useEffect(() => {
    if (initializedRef.current) return;
    if (mode !== "compose") return;

    const account = getActiveAccount();
    if (!account) return;

    initializedRef.current = true;
    getDefaultSignature(account.id).then((sig) => {
      if (sig) {
        setActiveSignatureId(sig.id);
        updateField("body", body + "\n\n-- \n" + sig.body);
      }
    }).catch(console.error);
  }, [mode, getActiveAccount, body, updateField]);

  // Reset ref when component unmounts (composer closes)
  useEffect(() => {
    return () => {
      initializedRef.current = false;
    };
  }, []);

  const loadSignatures = useCallback(() => {
    const account = getActiveAccount();
    if (!account) return;
    getAllSignatures(account.id).then(setSignatures).catch(console.error);
  }, [getActiveAccount]);

  useEffect(() => {
    if (!isOpen) return;
    loadSignatures();
  }, [isOpen, loadSignatures]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSelect = (signature: Signature) => {
    // Remove existing signature block if present
    const sigDivider = "\n\n-- \n";
    const sigIndex = body.lastIndexOf(sigDivider);
    const bodyWithoutSig = sigIndex >= 0 ? body.slice(0, sigIndex) : body;

    updateField("body", bodyWithoutSig + sigDivider + signature.body);
    setActiveSignatureId(signature.id);
    setIsOpen(false);
  };

  const handleRemove = () => {
    const sigDivider = "\n\n-- \n";
    const sigIndex = body.lastIndexOf(sigDivider);
    if (sigIndex >= 0) {
      updateField("body", body.slice(0, sigIndex));
    }
    setActiveSignatureId(null);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        onClick={() => setIsOpen(!isOpen)}
        title="Change signature"
        data-testid="signature-selector-btn"
      >
        <PenLine className="h-3.5 w-3.5" />
        Signature
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-lg border border-border-primary bg-bg-primary shadow-lg">
          {signatures.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-tertiary">
              No signatures. Create one in Settings.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto py-1">
              {signatures.map((s) => (
                <button
                  key={s.id}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg-hover ${
                    activeSignatureId === s.id
                      ? "text-accent"
                      : "text-text-primary"
                  }`}
                  onClick={() => handleSelect(s)}
                  data-testid={`signature-option-${s.id}`}
                >
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.is_default === 1 && (
                    <span className="text-xs text-text-tertiary">default</span>
                  )}
                </button>
              ))}
              {activeSignatureId && (
                <button
                  className="flex w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-bg-hover"
                  onClick={handleRemove}
                  data-testid="signature-remove"
                >
                  Remove signature
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
