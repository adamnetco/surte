import { useEffect } from "react";

interface HotkeyHandlers {
  onPay?: () => void;       // F2
  onSearch?: () => void;    // F3
  onEscape?: () => void;    // Esc
}

/**
 * Keyboard shortcuts for the POS workspace.
 * Inspired by Poster POS / Loyverse: F2 cobrar, F3 buscar, Esc cerrar sesión.
 * Ignores key events when the user is typing in an input (except F2/F3, which always fire).
 */
export function usePOSHotkeys({ onPay, onSearch, onEscape }: HotkeyHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (e.key === "F2") {
        e.preventDefault();
        onPay?.();
      } else if (e.key === "F3") {
        e.preventDefault();
        onSearch?.();
      } else if (e.key === "Escape" && !isTyping) {
        onEscape?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPay, onSearch, onEscape]);
}
