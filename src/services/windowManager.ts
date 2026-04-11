/**
 * Opens a thread in a separate pop-out window using Tauri's WebviewWindow API.
 */
export async function openThreadWindow(
  threadId: string,
  accountId: string,
): Promise<void> {
  // Guard: only run inside Tauri
  if (!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
    console.warn("openThreadWindow called outside Tauri runtime");
    return;
  }

  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

  const label = `thread-${threadId}`;

  // If the window already exists, focus it instead of creating a new one
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const url = `index.html?thread=${encodeURIComponent(threadId)}&account=${encodeURIComponent(accountId)}`;

  new WebviewWindow(label, {
    url,
    title: "Thread",
    width: 800,
    height: 700,
    minWidth: 500,
    minHeight: 400,
  });
}
