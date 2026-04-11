import { create } from "zustand";
import type { Task, TaskPriority } from "../types";
import {
  getAllTasks,
  insertTask,
  updateTaskInDb,
  deleteTaskFromDb,
  getSubtaskCount,
} from "../services/db/tasks";
import { handleRecurringTaskCompletion } from "../services/tasks/taskManager";

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  filter: "all" | "today" | "upcoming" | "completed";
  subtaskCounts: Record<string, number>;
  setFilter: (filter: TaskState["filter"]) => void;
  loadTasks: (accountId: string) => Promise<void>;
  createTask: (
    accountId: string,
    title: string,
    opts?: {
      description?: string;
      due_date?: string;
      priority?: TaskPriority;
      parent_task_id?: string;
      source_thread_id?: string;
      source_message_id?: string;
      recurrence_rule?: string;
    },
  ) => Promise<Task>;
  updateTask: (
    taskId: string,
    accountId: string,
    updates: Partial<Omit<Task, "id" | "account_id" | "created_at">>,
  ) => Promise<void>;
  deleteTask: (taskId: string, accountId: string) => Promise<void>;
  toggleComplete: (taskId: string, accountId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  filter: "all",
  subtaskCounts: {},

  setFilter: (filter) => set({ filter }),

  loadTasks: async (accountId) => {
    set({ isLoading: true });
    const tasks = await getAllTasks(accountId);

    // Build subtask counts for parent tasks
    const parentIds = [
      ...new Set(
        tasks
          .map((t) => t.parent_task_id)
          .filter((id): id is string => id !== null),
      ),
    ];
    const counts: Record<string, number> = {};
    for (const pid of parentIds) {
      counts[pid] = await getSubtaskCount(pid, accountId);
    }

    set({ tasks, isLoading: false, subtaskCounts: counts });
  },

  createTask: async (accountId, title, opts) => {
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      account_id: accountId,
      title,
      description: opts?.description ?? null,
      due_date: opts?.due_date ?? null,
      priority: opts?.priority ?? "medium",
      completed: false,
      parent_task_id: opts?.parent_task_id ?? null,
      source_thread_id: opts?.source_thread_id ?? null,
      source_message_id: opts?.source_message_id ?? null,
      recurrence_rule: opts?.recurrence_rule ?? null,
      created_at: now,
      completed_at: null,
    };

    await insertTask(task);
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: async (taskId, accountId, updates) => {
    await updateTaskInDb(taskId, accountId, updates);
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t,
      ),
    }));
  },

  deleteTask: async (taskId, accountId) => {
    await deleteTaskFromDb(taskId, accountId);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }));
  },

  toggleComplete: async (taskId, accountId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const nowCompleted = !task.completed;
    const now = new Date().toISOString();

    if (nowCompleted && task.recurrence_rule) {
      // Handle recurring task: complete current and create next
      const nextTask = await handleRecurringTaskCompletion(task);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, completed: true, completed_at: now }
            : t,
        ).concat(nextTask ? [nextTask] : []),
      }));
    } else {
      await updateTaskInDb(taskId, accountId, {
        completed: nowCompleted,
        completed_at: nowCompleted ? now : null,
      });
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, completed: nowCompleted, completed_at: nowCompleted ? now : null }
            : t,
        ),
      }));
    }
  },
}));
