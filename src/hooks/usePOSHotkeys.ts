import { useEffect } from "react";

interface HotkeyHandlers {
  onHelp?: () => void;      // F1
  onPay?: () => void;       // F2
  onSearch?: () => void;    // F3
  onCycleMode?: () => void; // F4
  onInvoice?: () => void;   // F6
  onQuote?: () => void;     // F7
  onPark?: () => void;      // F8
  onClear?: () => void;     // F9 (con confirm)
  onEscape?: () => void;    // Esc
}

/**
 * Atajos de teclado del POS workspace.
 * Inspirado en Poster POS / Loyverse / Vendty.
 * F2/F3 siempre disparan; el resto se ignora si el usuario está tecleando.
 */
export function usePOSHotkeys(handlers: HotkeyHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      const key = e.key;
      const alwaysActive = key === "F2" || key === "F3" || key === "F12";

      if (!alwaysActive && isTyping) return;

      switch (key) {
        case "F1":
          e.preventDefault();
          handlers.onHelp?.();
          break;
        case "F2":
        case "F12":
          e.preventDefault();
          handlers.onPay?.();
          break;
        case "F3":
          e.preventDefault();
          handlers.onSearch?.();
          break;
        case "F4":
          e.preventDefault();
          handlers.onCycleMode?.();
          break;
        case "F6":
          e.preventDefault();
          handlers.onInvoice?.();
          break;
        case "F7":
          e.preventDefault();
          handlers.onQuote?.();
          break;
        case "F8":
          e.preventDefault();
          handlers.onPark?.();
          break;
        case "F9":
          e.preventDefault();
          handlers.onClear?.();
          break;
        case "Escape":
          handlers.onEscape?.();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlers]);
}
