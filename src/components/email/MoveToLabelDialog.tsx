import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Check } from "lucide-react";
import { useLabelStore } from "../../stores/labelStore";
import { useAccountStore } from "../../stores/accountStore";
import {
  addLabelToThread,
  removeLabelFromThread,
} from "../../services/gmail/labels";
import { getThreadLabelIds } from "../../services/db/labels";
import { getDb } from "../../services/db/connection";

interface MoveToLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  /** Single-thread label editor (adds/removes against the thread's labels). */
  threadId?: string;
  /** Bulk mode: adds the chosen labels to every selected thread (add-only). */
  threadIds?: string[];
}

export function MoveToLabelDialog({
  isOpen,
  onClose,
  accountId,
  threadId,
  threadIds,
}: MoveToLabelDialogProps) {
  const { t } = useTranslation();
  const { userLabels } = useLabelStore();
  const getActiveAccount = useAccountStore((s) => s.getActiveAccount);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const bulk = threadIds !== undefined;
  const targetThreadIds = bulk ? threadIds : threadId ? [threadId] : [];

  useEffect(() => {
    if (!isOpen) return;
    // Bulk mode starts with nothing checked — selecting a label adds it to all.
    if (bulk || !threadId) {
      setCheckedIds(new Set());
      setOriginalIds(new Set());
      return;
    }

    void getThreadLabelIds(threadId, accountId).then((ids) => {
      const idSet = new Set(ids);
      setCheckedIds(idSet);
      setOriginalIds(idSet);
    });
  }, [isOpen, threadId, accountId, bulk]);

  const toggleLabel = useCallback((labelId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });
  }, []);

  const handleApply = useCallback(async () => {
    const account = getActiveAccount();
    if (!account || targetThreadIds.length === 0) return;

    setIsSaving(true);
    try {
      const db = await getDb();

      // Bulk mode is add-only (originalIds is empty), so toRemove is naturally [].
      const toAdd = [...checkedIds].filter((id) => !originalIds.has(id));
      const toRemove = [...originalIds].filter((id) => !checkedIds.has(id));

      // Apply changes via Gmail API and local DB across every target thread.
      const apiCalls: Promise<void>[] = [];
      for (const tid of targetThreadIds) {
        for (const labelId of toAdd) {
          apiCalls.push(addLabelToThread(account, tid, labelId));
          apiCalls.push(
            db.execute(
              "INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, $2, $3)",
              [tid, labelId, accountId],
            ).then(() => undefined),
          );
        }
        for (const labelId of toRemove) {
          apiCalls.push(removeLabelFromThread(account, tid, labelId));
          apiCalls.push(
            db.execute(
              "DELETE FROM thread_labels WHERE thread_id = $1 AND label_id = $2 AND account_id = $3",
              [tid, labelId, accountId],
            ).then(() => undefined),
          );
        }
      }

      await Promise.all(apiCalls);
      onClose();
    } catch (err) {
      console.error("Failed to update labels:", err);
    } finally {
      setIsSaving(false);
    }
  }, [checkedIds, originalIds, targetThreadIds, accountId, getActiveAccount, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void handleApply();
      }
    },
    [onClose, handleApply],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="move-to-label-backdrop"
    >
      <div
        className="w-72 rounded-xl border border-border-primary bg-bg-primary p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        data-testid="move-to-label-dialog"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {bulk
              ? t("email.labels.bulkTitle", { count: targetThreadIds.length })
              : t("email.labels.title")}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {userLabels.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-tertiary">
            {t("email.labels.noUserLabels")}
          </p>
        ) : (
          <div className="max-h-60 overflow-y-auto">
            {userLabels.map((label) => {
              const checked = checkedIds.has(label.id);
              return (
                <button
                  key={label.id}
                  onClick={() => toggleLabel(label.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-primary hover:bg-bg-hover"
                  data-testid={`label-option-${label.id}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-accent bg-accent text-white"
                        : "border-border-primary bg-bg-secondary"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  {label.color && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                  )}
                  <span className="truncate">{label.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2 border-t border-border-secondary pt-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
          >
            {t("email.labels.cancel")}
          </button>
          <button
            onClick={() => void handleApply()}
            disabled={isSaving}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
            data-testid="move-to-label-apply"
          >
            {isSaving ? t("email.labels.saving") : t("email.labels.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
