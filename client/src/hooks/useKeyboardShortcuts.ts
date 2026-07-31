import { useEffect, useRef } from "react";

export interface ShortcutDef {
  key: string;
  description: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  { key: "/", description: "Focus search" },
  { key: "n", description: "New worker / employee" },
];

interface Handlers {
  onFocusSearch?: () => void;
  onNew?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

/** Registers the listener once; a ref keeps the latest handlers so callers can pass inline object literals without re-binding on every render. */
export function useKeyboardShortcuts(handlers: Handlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "/") {
        e.preventDefault();
        handlersRef.current.onFocusSearch?.();
      } else if (e.key === "n") {
        e.preventDefault();
        handlersRef.current.onNew?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
