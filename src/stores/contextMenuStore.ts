import { create } from "zustand";

export interface ContextMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  show: (x: number, y: number, items: ContextMenuItem[]) => void;
  hide: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  position: { x: 0, y: 0 },
  items: [],
  show: (x, y, items) => set({ isOpen: true, position: { x, y }, items }),
  hide: () => set({ isOpen: false, items: [] }),
}));
