import { type ReactNode, useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { addLabelToThread } from "../../services/gmail/labels";

interface DndProviderProps {
  children: ReactNode;
}

export function DndProvider({ children }: DndProviderProps) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const sensors = useSensors(pointerSensor);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveThreadId(id);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveThreadId(null);
    const { active, over } = event;
    if (!over) return;

    const threadId = String(active.id);
    const labelId = String(over.id);

    const account = useAccountStore.getState().getActiveAccount();
    if (!account) return;

    // Also apply label to all multi-selected threads if the dragged thread is one of them
    const { selectedThreadIds } = useThreadStore.getState();
    const threadIds = selectedThreadIds.has(threadId)
      ? Array.from(selectedThreadIds)
      : [threadId];

    for (const tid of threadIds) {
      void addLabelToThread(account, tid, labelId);
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveThreadId(null);
  }, []);

  const activeThread = activeThreadId
    ? useThreadStore.getState().threads.find((t) => t.id === activeThreadId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeThread ? (
          <div className="w-72 rounded-lg border border-border-primary bg-bg-primary px-4 py-3 shadow-lg">
            <p className="truncate text-sm font-medium text-text-primary">
              {activeThread.subject || "(No subject)"}
            </p>
            <p className="mt-1 truncate text-xs text-text-secondary">
              {activeThread.snippet}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
