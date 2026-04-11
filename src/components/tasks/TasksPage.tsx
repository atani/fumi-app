import { useEffect, useMemo } from "react";
import { ArrowLeft, CheckSquare, ListFilter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccountStore } from "../../stores/accountStore";
import { useTaskStore } from "../../stores/taskStore";
import { TaskItem } from "./TaskItem";
import { TaskQuickAdd } from "./TaskQuickAdd";
import type { Task } from "../../types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
] as const;

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isFuture(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

function filterTasks(
  tasks: Task[],
  filter: "all" | "today" | "upcoming" | "completed",
): Task[] {
  switch (filter) {
    case "today":
      return tasks.filter(
        (t) => !t.completed && t.due_date && isToday(t.due_date),
      );
    case "upcoming":
      return tasks.filter(
        (t) => !t.completed && t.due_date && isFuture(t.due_date),
      );
    case "completed":
      return tasks.filter((t) => t.completed);
    default:
      return tasks;
  }
}

export function TasksPage() {
  const navigate = useNavigate();
  const { getActiveAccount } = useAccountStore();
  const { tasks, isLoading, filter, subtaskCounts, setFilter, loadTasks } =
    useTaskStore();
  const account = getActiveAccount();

  useEffect(() => {
    if (account) {
      void loadTasks(account.id);
    }
  }, [account, loadTasks]);

  // Only show top-level tasks (no parent)
  const topLevelTasks = useMemo(
    () => tasks.filter((t) => !t.parent_task_id),
    [tasks],
  );
  const filteredTasks = useMemo(
    () => filterTasks(topLevelTasks, filter),
    [topLevelTasks, filter],
  );

  const completedCount = topLevelTasks.filter((t) => t.completed).length;
  const totalCount = topLevelTasks.length;

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* Title bar drag region */}
      <div
        className="h-10 shrink-0"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-primary px-6 pb-4">
        <button
          onClick={() => navigate("/")}
          className="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          aria-label="Back to mail"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <CheckSquare className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold text-text-primary">Tasks</h1>
        {totalCount > 0 && (
          <span className="text-sm text-text-tertiary">
            {completedCount}/{totalCount} completed
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border-primary px-6 py-2">
        <ListFilter className="mr-1 h-4 w-4 text-text-tertiary" />
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              filter === id
                ? "bg-accent/10 font-medium text-accent"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
            data-testid={`task-filter-${id}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {account && <TaskQuickAdd accountId={account.id} />}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-text-secondary">
              Loading tasks...
            </span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CheckSquare className="mb-3 h-12 w-12 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              {filter === "all"
                ? "No tasks yet. Add one above."
                : `No ${filter} tasks.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-primary">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                accountId={account?.id ?? ""}
                subtaskCount={subtaskCounts[task.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
