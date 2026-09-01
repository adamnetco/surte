import { useCallback, useRef } from "react";

/**
 * useGridKeyboardNav — Navegación 100% teclado sobre grillas/listas densas,
 * estilo FoxPro/AdmonSis: ↑ ↓ ← → Home End PageUp PageDown mueven el foco,
 * Enter/Space activan el elemento (los `<button>` nativos ya lo hacen).
 *
 * Capa `presentation/` pura. El contenedor debe marcar cada celda enfocable
 * con `data-kbd-item`.
 *
 * Uso:
 *   const { containerRef, onKeyDown } = useGridKeyboardNav();
 *   <div ref={containerRef} onKeyDown={onKeyDown}>
 *     {items.map(i => <button key={i.id} data-kbd-item>…</button>)}
 *   </div>
 *
 * Las columnas se infieren del layout real (offsetTop), así funciona igual
 * con 2, 3 o 6 columnas responsivas sin configuración.
 */

export interface UseGridKeyboardNavOptions {
  disabled?: boolean;
  /** Foco cíclico al llegar al borde (default: false). */
  loop?: boolean;
}

export function useGridKeyboardNav<T extends HTMLElement = HTMLDivElement>({
  disabled,
  loop = false,
}: UseGridKeyboardNavOptions = {}) {
  const containerRef = useRef<T | null>(null);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const keys = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ];
      if (!keys.includes(e.key)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const container = containerRef.current;
      if (!container) return;

      const items = Array.from(
        container.querySelectorAll<HTMLElement>("[data-kbd-item]"),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const current = active ? items.indexOf(active) : -1;

      // Columnas reales: cantidad de items que comparten el offsetTop del primero.
      const firstTop = items[0].offsetTop;
      let cols = items.filter((el) => el.offsetTop === firstTop).length;
      if (cols < 1) cols = 1;

      const clamp = (n: number) => {
        if (loop) return (n + items.length) % items.length;
        return Math.min(Math.max(n, 0), items.length - 1);
      };

      let next = current;
      switch (e.key) {
        case "ArrowRight":
          next = current < 0 ? 0 : clamp(current + 1);
          break;
        case "ArrowLeft":
          next = current < 0 ? 0 : clamp(current - 1);
          break;
        case "ArrowDown":
          next = current < 0 ? 0 : clamp(current + cols);
          break;
        case "ArrowUp":
          next = current < 0 ? 0 : clamp(current - cols);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = items.length - 1;
          break;
        case "PageDown":
          next = clamp((current < 0 ? 0 : current) + cols * 3);
          break;
        case "PageUp":
          next = clamp((current < 0 ? 0 : current) - cols * 3);
          break;
      }

      if (next === current || next < 0) {
        if (current >= 0) return;
      }
      e.preventDefault();
      const target = items[next];
      target?.focus();
      target?.scrollIntoView({ block: "nearest" });
    },
    [disabled, loop],
  );

  return { containerRef, onKeyDown };
}
