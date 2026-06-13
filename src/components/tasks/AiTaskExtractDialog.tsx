import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Loader2, CheckSquare, Sparkles } from "lucide-react";
import type { Message } from "../../types";
import {
  extractTasksFromThread,
  type ExtractedTask,
} from "../../services/ai/aiService";
import { useTaskStore } from "../../stores/taskStore";

const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
} as const;

interface AiTaskExtractDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  threadId: string;
  accountId: string;
}

export function AiTaskExtractDialog({
  isOpen,
  onClose,
  messages,
  threadId,
  accountId,
}: AiTaskExtractDialogProps) {
  const { t } = useTranslation();
  const { createTask } = useTaskStore();
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExtracted, setHasExtracted] = useState(false);

  const handleExtract = async () => {
    setIsExtracting(true);
    setError(null);
    try {
      const tasks = await extractTasksFromThread(messages, threadId, accountId);
      setExtractedTasks(tasks);
      setSelectedIndices(new Set(tasks.map((_, i) => i)));
      setHasExtracted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("tasks.extract.errorExtract"),
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleToggleTask = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const index of selectedIndices) {
        const task = extractedTasks[index];
        if (!task) continue;
        await createTask(accountId, task.title, {
          description: task.description ?? undefined,
          priority: task.priority,
          due_date: task.due_date ?? undefined,
          source_thread_id: threadId,
        });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("tasks.extract.errorSave"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border-primary bg-bg-primary p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">
              {t("tasks.extract.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!hasExtracted && !isExtracting && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-center text-sm text-text-secondary">
              {t("tasks.extract.intro")}
            </p>
            <button
              onClick={() => void handleExtract()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {t("tasks.extract.action")}
            </button>
          </div>
        )}

        {isExtracting && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span className="text-sm text-text-secondary">
              {t("tasks.extract.analyzing")}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {hasExtracted && !isExtracting && (
          <>
            {extractedTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-secondary">
                {t("tasks.extract.empty")}
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {extractedTasks.map((task, index) => (
                  <label
                    key={index}
                    className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-bg-hover"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIndices.has(index)}
                      onChange={() => handleToggleTask(index)}
                      className="mt-0.5 h-4 w-4 rounded border-border-primary text-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {task.description}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}
                        >
                          {t(`tasks.priority.${task.priority}`)}
                        </span>
                        {task.due_date && (
                          <span className="text-xs text-text-tertiary">
                            {t("tasks.extract.due", {
                              date: new Date(
                                task.due_date,
                              ).toLocaleDateString(),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {extractedTasks.length > 0 && (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
                >
                  {t("tasks.cancel")}
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={selectedIndices.size === 0 || isSaving}
                  className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckSquare className="h-4 w-4" />
                  )}
                  {t("tasks.extract.addCount", {
                    count: selectedIndices.size,
                  })}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
