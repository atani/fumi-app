import { getDb } from "../db/connection";
import {
  markAsRead,
  markAsUnread,
  archiveThread,
  trashThread,
  toggleStar,
  muteThread,
} from "../emailActions";
import type { Account, QuickStep, QuickStepAction } from "../../types";

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

export async function getAllQuickSteps(
  accountId: string,
): Promise<QuickStep[]> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      name: string;
      icon: string | null;
      actions: string;
      shortcut: string | null;
      created_at: string;
    }[]
  >("SELECT * FROM quick_steps WHERE account_id = $1 ORDER BY created_at", [
    accountId,
  ]);

  return rows.map((r) => ({
    id: r.id,
    account_id: r.account_id,
    name: r.name,
    icon: r.icon,
    actions: JSON.parse(r.actions) as QuickStepAction[],
    shortcut: r.shortcut,
    created_at: r.created_at,
  }));
}

export async function saveQuickStep(qs: QuickStep): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO quick_steps (id, account_id, name, icon, actions, shortcut)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       icon = excluded.icon,
       actions = excluded.actions,
       shortcut = excluded.shortcut`,
    [
      qs.id,
      qs.account_id,
      qs.name,
      qs.icon,
      JSON.stringify(qs.actions),
      qs.shortcut,
    ],
  );
}

export async function deleteQuickStep(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM quick_steps WHERE id = $1", [id]);
}

// ---------------------------------------------------------------------------
// Executor — runs a quick step's action chain sequentially
// ---------------------------------------------------------------------------

export async function executeQuickStep(
  account: Account,
  threadId: string,
  quickStep: QuickStep,
): Promise<void> {
  for (const action of quickStep.actions) {
    await executeAction(account, threadId, action);
  }
}

async function executeAction(
  account: Account,
  threadId: string,
  action: QuickStepAction,
): Promise<void> {
  switch (action.type) {
    case "markRead":
      await markAsRead(account, threadId);
      break;
    case "markUnread":
      await markAsUnread(account, threadId);
      break;
    case "archive":
      await archiveThread(account, threadId);
      break;
    case "trash":
      await trashThread(account, threadId);
      break;
    case "star":
      await toggleStar(account, threadId, false);
      break;
    case "unstar":
      await toggleStar(account, threadId, true);
      break;
    case "mute":
      await muteThread(account, threadId);
      break;
    case "applyLabel":
    case "removeLabel":
    case "forward":
    case "reply":
    case "move":
    case "snooze":
    case "followUp":
    case "categorize":
    case "addTask":
    case "unsubscribe":
    case "openUrl":
      console.warn(
        `Quick step action "${action.type}" is not yet implemented`,
      );
      break;
  }
}
