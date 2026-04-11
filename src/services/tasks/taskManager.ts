import type { Task } from "../../types";
import { insertTask, updateTaskInDb } from "../db/tasks";

export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
}

/**
 * Parse a recurrence rule string like "daily:1", "weekly:2", "monthly:1", "yearly:1".
 */
export function parseRecurrenceRule(rule: string): RecurrenceRule | null {
  const parts = rule.split(":");
  const frequency = parts[0];
  const intervalStr = parts[1];

  if (!frequency || !intervalStr) return null;

  const interval = parseInt(intervalStr, 10);
  if (isNaN(interval) || interval < 1) return null;

  const validFrequencies = ["daily", "weekly", "monthly", "yearly"] as const;
  type Freq = (typeof validFrequencies)[number];

  if (!validFrequencies.includes(frequency as Freq)) return null;

  return { frequency: frequency as Freq, interval };
}

/**
 * Calculate the next occurrence date from a given date based on a recurrence rule.
 */
export function calculateNextOccurrence(
  fromDate: Date,
  rule: RecurrenceRule,
): Date {
  const next = new Date(fromDate);

  switch (rule.frequency) {
    case "daily":
      next.setDate(next.getDate() + rule.interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * rule.interval);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + rule.interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + rule.interval);
      break;
  }

  return next;
}

/**
 * Handle completion of a recurring task: marks the current task complete
 * and creates the next occurrence.
 */
export async function handleRecurringTaskCompletion(
  task: Task,
): Promise<Task | null> {
  if (!task.recurrence_rule) return null;

  const rule = parseRecurrenceRule(task.recurrence_rule);
  if (!rule) return null;

  const now = new Date().toISOString();

  // Mark current task as completed
  await updateTaskInDb(task.id, task.account_id, {
    completed: true,
    completed_at: now,
  });

  // Calculate next due date
  const baseDate = task.due_date ? new Date(task.due_date) : new Date();
  const nextDue = calculateNextOccurrence(baseDate, rule);

  // Create next occurrence
  const nextTask: Task = {
    id: crypto.randomUUID(),
    account_id: task.account_id,
    title: task.title,
    description: task.description,
    due_date: nextDue.toISOString().split("T")[0] ?? nextDue.toISOString(),
    priority: task.priority,
    completed: false,
    parent_task_id: task.parent_task_id,
    source_thread_id: task.source_thread_id,
    source_message_id: task.source_message_id,
    recurrence_rule: task.recurrence_rule,
    created_at: now,
    completed_at: null,
  };

  await insertTask(nextTask);

  return nextTask;
}
