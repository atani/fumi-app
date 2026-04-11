import { getDb } from "./connection";
import type { Task, TaskPriority } from "../../types";

interface TaskRow {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  completed: number;
  parent_task_id: string | null;
  source_thread_id: string | null;
  source_message_id: string | null;
  recurrence_rule: string | null;
  created_at: string;
  completed_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    ...row,
    priority: row.priority as TaskPriority,
    completed: row.completed === 1,
  };
}

export async function getAllTasks(accountId: string): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    "SELECT * FROM tasks WHERE account_id = $1 ORDER BY completed ASC, due_date ASC, created_at DESC",
    [accountId],
  );
  return rows.map(rowToTask);
}

export async function getTaskById(
  taskId: string,
  accountId: string,
): Promise<Task | null> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    "SELECT * FROM tasks WHERE id = $1 AND account_id = $2",
    [taskId, accountId],
  );
  const row = rows[0];
  return row ? rowToTask(row) : null;
}

export async function getSubtasks(
  parentTaskId: string,
  accountId: string,
): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    "SELECT * FROM tasks WHERE parent_task_id = $1 AND account_id = $2 ORDER BY created_at ASC",
    [parentTaskId, accountId],
  );
  return rows.map(rowToTask);
}

export async function getSubtaskCount(
  parentTaskId: string,
  accountId: string,
): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = $1 AND account_id = $2",
    [parentTaskId, accountId],
  );
  return rows[0]?.count ?? 0;
}

export async function insertTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO tasks (id, account_id, title, description, due_date, priority, completed, parent_task_id, source_thread_id, source_message_id, recurrence_rule, created_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      task.id,
      task.account_id,
      task.title,
      task.description,
      task.due_date,
      task.priority,
      task.completed ? 1 : 0,
      task.parent_task_id,
      task.source_thread_id,
      task.source_message_id,
      task.recurrence_rule,
      task.created_at,
      task.completed_at,
    ],
  );
}

export async function updateTaskInDb(
  taskId: string,
  accountId: string,
  updates: Partial<Omit<Task, "id" | "account_id" | "created_at">>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    fields.push(`title = $${String(paramIndex++)}`);
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${String(paramIndex++)}`);
    values.push(updates.description);
  }
  if (updates.due_date !== undefined) {
    fields.push(`due_date = $${String(paramIndex++)}`);
    values.push(updates.due_date);
  }
  if (updates.priority !== undefined) {
    fields.push(`priority = $${String(paramIndex++)}`);
    values.push(updates.priority);
  }
  if (updates.completed !== undefined) {
    fields.push(`completed = $${String(paramIndex++)}`);
    values.push(updates.completed ? 1 : 0);
  }
  if (updates.completed_at !== undefined) {
    fields.push(`completed_at = $${String(paramIndex++)}`);
    values.push(updates.completed_at);
  }
  if (updates.parent_task_id !== undefined) {
    fields.push(`parent_task_id = $${String(paramIndex++)}`);
    values.push(updates.parent_task_id);
  }
  if (updates.recurrence_rule !== undefined) {
    fields.push(`recurrence_rule = $${String(paramIndex++)}`);
    values.push(updates.recurrence_rule);
  }

  if (fields.length === 0) return;

  values.push(taskId);
  values.push(accountId);

  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${String(paramIndex++)} AND account_id = $${String(paramIndex)}`,
    values,
  );
}

export async function deleteTaskFromDb(
  taskId: string,
  accountId: string,
): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1 AND account_id = $2", [
    taskId,
    accountId,
  ]);
}
