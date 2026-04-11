import { useState } from "react";
import { Plus } from "lucide-react";
import type { TaskPriority } from "../../types";
import { useTaskStore } from "../../stores/taskStore";

interface TaskQuickAddProps {
  accountId: string;
}

export function TaskQuickAdd({ accountId }: TaskQuickAddProps) {
  const { createTask } = useTaskStore();
  const [title, setTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    void createTask(accountId, trimmed, {
      priority,
      due_date: dueDate || undefined,
    });

    setTitle("");
    setPriority("medium");
    setDueDate("");
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setTitle("");
      setIsExpanded(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-b border-border-primary p-3">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 shrink-0 text-text-tertiary" />
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!isExpanded && e.target.value) setIsExpanded(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Add a task..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-tertiary outline-none"
          data-testid="task-quick-add-input"
        />
      </div>

      {isExpanded && (
        <div className="mt-2 flex items-center gap-2 pl-6">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-xs text-text-primary"
            data-testid="task-quick-add-priority"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-xs text-text-primary"
            data-testid="task-quick-add-due"
          />

          <button
            type="submit"
            disabled={!title.trim()}
            className="ml-auto rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            data-testid="task-quick-add-submit"
          >
            Add
          </button>
        </div>
      )}
    </form>
  );
}
