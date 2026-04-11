import { useEffect, useRef } from "react";
import { useContextMenuStore } from "../../stores/contextMenuStore";

export function ContextMenu() {
  const { isOpen, position, items, hide } = useContextMenuStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hide();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, hide]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const el = menuRef.current;

    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [isOpen, position]);

  if (!isOpen || items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] rounded-lg border border-border-primary bg-bg-primary py-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
      data-testid="context-menu"
    >
      {items.map((item, index) => (
        <div key={index}>
          {item.separator && index > 0 && (
            <div className="my-1 border-t border-border-secondary" />
          )}
          <button
            onClick={() => {
              item.onClick();
              hide();
            }}
            disabled={item.disabled}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text-primary hover:bg-bg-hover disabled:text-text-tertiary disabled:hover:bg-transparent"
            data-testid={`context-menu-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {item.icon && <item.icon className="h-4 w-4 text-text-secondary" />}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
