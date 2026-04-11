import { useState, useCallback, useRef, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import {
  useShortcutStore,
  SHORTCUT_SECTIONS,
  SHORTCUT_LABELS,
  DEFAULT_KEY_MAP,
  type ShortcutActionId,
} from "../../stores/shortcutStore";

/** Convert a KeyboardEvent into the combo string format used by the store. */
function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && e.key.length > 1) parts.push("Shift");
  parts.push(e.key);
  return parts.join("+");
}

export function ShortcutEditor() {
  const { keyMap, updateKey, resetToDefaults, resetKey } = useShortcutStore();
  const [recordingAction, setRecordingAction] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    actionId: string;
    existingActionId: string;
    combo: string;
  } | null>(null);
  const recordingRef = useRef<string | null>(null);

  // Keep ref in sync for the capture handler.
  recordingRef.current = recordingAction;

  // For g-sequences we capture two keys: first "g", then the second key.
  const pendingGRef = useRef(false);

  useEffect(() => {
    if (!recordingAction) return;

    function handleCapture(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      // Ignore bare modifier presses.
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const currentAction = recordingRef.current;
      if (!currentAction) return;

      // Handle g-sequence capture for go_* actions.
      if (currentAction.startsWith("go_")) {
        if (!pendingGRef.current) {
          if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
            pendingGRef.current = true;
            return; // Wait for second key
          }
          // If they pressed something other than g, treat it as a regular combo.
        }

        if (pendingGRef.current) {
          const combo = `g ${e.key}`;
          pendingGRef.current = false;
          void applyCapture(currentAction, combo);
          return;
        }
      }

      const combo = eventToCombo(e);
      void applyCapture(currentAction, combo);
    }

    async function applyCapture(actionId: string, combo: string) {
      // Check for conflicts.
      const { keyMap: currentMap } = useShortcutStore.getState();
      const conflicting = Object.entries(currentMap).find(
        ([id, c]) => c === combo && id !== actionId,
      );

      if (conflicting) {
        setConflict({
          actionId,
          existingActionId: conflicting[0],
          combo,
        });
        setRecordingAction(null);
        return;
      }

      await updateKey(actionId, combo);
      setRecordingAction(null);
    }

    window.addEventListener("keydown", handleCapture, true);
    return () => {
      window.removeEventListener("keydown", handleCapture, true);
      pendingGRef.current = false;
    };
  }, [recordingAction, updateKey]);

  const startRecording = useCallback((actionId: string) => {
    setConflict(null);
    setRecordingAction(actionId);
  }, []);

  const cancelRecording = useCallback(() => {
    setRecordingAction(null);
    pendingGRef.current = false;
  }, []);

  const resolveConflictSwap = useCallback(
    async (c: { actionId: string; existingActionId: string; combo: string }) => {
      // Swap: give the conflicting action this action's old binding.
      const oldCombo = keyMap[c.actionId];
      if (oldCombo !== undefined) {
        await updateKey(c.existingActionId, oldCombo);
      }
      await updateKey(c.actionId, c.combo);
      setConflict(null);
    },
    [keyMap, updateKey],
  );

  const resolveConflictCancel = useCallback(() => {
    setConflict(null);
  }, []);

  return (
    <div className="space-y-4">
      {SHORTCUT_SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
            {section.title}
          </h3>
          <div className="space-y-1">
            {section.actions.map((actionId) => {
              const label = SHORTCUT_LABELS[actionId];
              const combo = keyMap[actionId];
              const defaultCombo = DEFAULT_KEY_MAP[actionId];
              const isCustomized = combo !== defaultCombo;
              const isRecording = recordingAction === actionId;

              return (
                <div
                  key={actionId}
                  className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-bg-hover"
                  data-testid={`shortcut-row-${actionId}`}
                >
                  <span className="text-sm text-text-primary">{label}</span>
                  <div className="flex items-center gap-2">
                    {isRecording ? (
                      <span className="rounded border border-accent bg-accent/10 px-2 py-1 text-xs text-accent animate-pulse">
                        Press a key...
                      </span>
                    ) : (
                      <button
                        onClick={() => startRecording(actionId)}
                        className={`rounded px-2 py-1 font-mono text-xs transition-colors ${
                          isCustomized
                            ? "bg-accent/10 text-accent border border-accent/30"
                            : "bg-bg-secondary text-text-secondary"
                        } hover:bg-bg-hover`}
                        data-testid={`shortcut-key-${actionId}`}
                        title="Click to rebind"
                      >
                        {combo ?? defaultCombo}
                      </button>
                    )}
                    {isCustomized && !isRecording && (
                      <button
                        onClick={() => void resetKey(actionId)}
                        className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
                        title="Reset to default"
                        data-testid={`shortcut-reset-${actionId}`}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                    {isRecording && (
                      <button
                        onClick={cancelRecording}
                        className="rounded px-1.5 py-0.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Conflict resolution dialog */}
      {conflict && (
        <div className="rounded-lg border border-warning bg-warning/10 p-3">
          <p className="text-sm text-text-primary">
            <kbd className="rounded bg-bg-secondary px-1 py-0.5 font-mono text-xs">
              {conflict.combo}
            </kbd>{" "}
            is already bound to{" "}
            <strong>
              {SHORTCUT_LABELS[conflict.existingActionId as ShortcutActionId] ??
                conflict.existingActionId}
            </strong>
            .
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void resolveConflictSwap(conflict)}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
              data-testid="shortcut-conflict-swap"
            >
              Swap bindings
            </button>
            <button
              onClick={resolveConflictCancel}
              className="rounded-md border border-border-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover"
              data-testid="shortcut-conflict-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reset all */}
      <div className="pt-2">
        <button
          onClick={() => void resetToDefaults()}
          className="flex items-center gap-1.5 rounded-md border border-border-primary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          data-testid="shortcut-reset-all"
        >
          <RotateCcw className="h-3 w-3" />
          Reset all to defaults
        </button>
      </div>
    </div>
  );
}
