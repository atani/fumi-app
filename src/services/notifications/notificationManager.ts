import type { Thread } from "../../types";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let permissionGranted = false;

export async function initNotifications(): Promise<void> {
  if (!isTauri()) return;

  const { isPermissionGranted, requestPermission } = await import(
    "@tauri-apps/plugin-notification"
  );

  permissionGranted = await isPermissionGranted();

  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }
}

function isWindowFocused(): boolean {
  return typeof document !== "undefined" && document.hasFocus();
}

export async function notifyFollowUp(subject: string): Promise<void> {
  if (!isTauri() || !permissionGranted) return;

  const { sendNotification } = await import("@tauri-apps/plugin-notification");

  sendNotification({
    title: "Follow-up reminder",
    body: `No reply yet: ${subject}`,
  });
}

export async function notifyNewMessages(newThreads: Thread[]): Promise<void> {
  if (!isTauri() || !permissionGranted) return;
  if (newThreads.length === 0) return;
  if (isWindowFocused()) return;

  const { sendNotification } = await import("@tauri-apps/plugin-notification");

  if (newThreads.length === 1) {
    const thread = newThreads[0]!;
    sendNotification({
      title: thread.subject || "(No subject)",
      body: thread.snippet || "",
    });
  } else {
    sendNotification({
      title: `${newThreads.length} new messages`,
      body: newThreads
        .slice(0, 3)
        .map((t) => t.subject || "(No subject)")
        .join(", "),
    });
  }
}
