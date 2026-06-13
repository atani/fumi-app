import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckSquare,
  Square,
  Trash2,
  Pencil,
  ChevronRight,
  Repeat,
} from "lucide-react";
import type { Task } from "../../types";
import { useTaskStore } from "../../stores/taskStore";

const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
} as const;

interface TaskItemProps {
  task: Task;
  accountId: string;
  subtaskCount?: number;
}

export function TaskItem({ task, accountId, subtaskCount }: TaskItemProps) {
  const { t } = useTranslation();
  const { toggleComplete, deleteTask, updateTask } = useTaskStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  const handleToggle = () => {
    void toggleComplete(task.id, accountId);
  };

  const handleDelete = () => {
    void deleteTask(task.id, accountId);
  };

  const handleSaveEdit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      void updateTask(task.id, accountId, { title: trimmed });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditTitle(task.title);
      setIsEditing(false);
    }
  };

  const formattedDue = task.due_date
    ? new Date(task.due_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  const isOverdue =
    task.due_date && !task.completed && new Date(task.due_date) < new Date();

  return (
    <div
      className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-bg-hover"
      data-testid={`task-item-${task.id}`}
    >
      <button
        onClick={handleToggle}
        className="shrink-0 text-text-secondary hover:text-accent"
        aria-label={
          task.completed
            ? t("tasks.markIncomplete")
            : t("tasks.markComplete")
        }
      >
        {task.completed ? (
          <CheckSquare className="h-5 w-5 text-accent" />
        ) : (
          <Square className="h-5 w-5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
            autoFocus
          />
        ) : (
          <span
            className={`text-sm ${
              task.completed
                ? "text-text-tertiary line-through"
                : "text-text-primary"
            }`}
          >
            {task.title}
          </span>
        )}

        <div className="mt-0.5 flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}
          >
            {t(`tasks.priority.${task.priority}`)}
          </span>

          {formattedDue && (
            <span
              className={`text-xs ${
                isOverdue ? "font-medium text-red-500" : "text-text-tertiary"
              }`}
            >
              {formattedDue}
            </span>
          )}

          {task.recurrence_rule && (
            <Repeat className="h-3 w-3 text-text-tertiary" />
          )}

          {subtaskCount != null && subtaskCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-text-tertiary">
              <ChevronRight className="h-3 w-3" />
              {t("tasks.subtaskCount", { count: subtaskCount })}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => {
            setEditTitle(task.title);
            setIsEditing(true);
          }}
          className="rounded p-1 text-text-tertiary hover:bg-bg-secondary hover:text-text-primary"
          aria-label={t("tasks.editTask")}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDelete}
          className="rounded p-1 text-text-tertiary hover:bg-bg-secondary hover:text-danger"
          aria-label={t("tasks.deleteTask")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
