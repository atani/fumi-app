import { useComposerStore } from "../stores/composerStore";

const DEFAULT_SHORTCUT = "CmdOrCtrl+Shift+M";

let unregisterFn: (() => void) | undefined;

/**
 * Register a system-wide global shortcut to open the compose window.
 * Returns a cleanup function to unregister the shortcut.
 */
export async function initGlobalShortcut(): Promise<() => void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return () => {};
  }

  try {
    const { register, unregister } = await import(
      "@tauri-apps/plugin-global-shortcut"
    );
    const { getCurrentWindow } = await import("@tauri-apps/api/window");

    await register(DEFAULT_SHORTCUT, async () => {
      // Bring the window to front
      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();

      // Open the composer
      useComposerStore.getState().openCompose();
    });

    unregisterFn = () => {
      void unregister(DEFAULT_SHORTCUT);
    };

    return () => {
      unregisterFn?.();
      unregisterFn = undefined;
    };
  } catch (err) {
    console.error("Failed to register global shortcut:", err);
    return () => {};
  }
}
