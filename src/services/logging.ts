function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let initialized = false;

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/**
 * Forward `console.warn` / `console.error` to the Tauri log plugin so they
 * persist to the on-disk log file (retrievable for support), in addition to the
 * devtools console. Without this, all `console.*` output is lost in release
 * builds where devtools is closed — so a "my scheduled email never sent" or
 * "activation failed" report has no trace to diagnose.
 *
 * Only warn/error are forwarded to keep the log file signal-heavy. The plugin's
 * log functions call into Rust (not back into console), so there is no recursion.
 */
export async function initLogForwarding(): Promise<void> {
  if (initialized || !isTauri()) return;
  initialized = true;

  try {
    const { warn, error } = await import("@tauri-apps/plugin-log");

    const forward = (sink: (message: string) => Promise<void>, args: unknown[]) => {
      try {
        void sink(args.map(stringifyArg).join(" "));
      } catch {
        // Logging must never break the app.
      }
    };

    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);

    console.warn = (...args: unknown[]) => {
      originalWarn(...args);
      forward(warn, args);
    };
    console.error = (...args: unknown[]) => {
      originalError(...args);
      forward(error, args);
    };
  } catch {
    // plugin-log unavailable — keep the default console.
  }
}
