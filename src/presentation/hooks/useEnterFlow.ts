import { useCallback } from "react";

/**
 * useEnterFlow — Ergonomía estilo FoxPro/Clipper: Enter avanza al siguiente
 * campo del formulario; en el último campo ejecuta `onSubmit`.
 *
 * Capa `presentation/` pura: no conoce Supabase ni casos de uso.
 *
 * Uso:
 *   const { containerRef, onKeyDown } = useEnterFlow({ onSubmit: guardar });
 *   <form ref={containerRef} onKeyDown={onKeyDown}> … </form>
 *
 * Reglas:
 *  - Ignora `textarea` (Enter debe insertar salto de línea) salvo Ctrl/Cmd+Enter.
 *  - Salta elementos deshabilitados, ocultos o `readOnly`.
 *  - Shift+Enter retrocede al campo anterior.
 */

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[data-enter-flow-field]:not([disabled])';

function isVisible(el: HTMLElement) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

export interface UseEnterFlowOptions {
  /** Se ejecuta cuando Enter llega en el último campo (o con Ctrl/Cmd+Enter). */
  onSubmit?: () => void;
  /** Desactiva el comportamiento sin desmontar el hook. */
  disabled?: boolean;
}

export function useEnterFlow<T extends HTMLElement = HTMLFormElement>({
  onSubmit,
  disabled,
}: UseEnterFlowOptions = {}) {
  const containerRef = useCallback((node: T | null) => {
    ref.current = node;
  }, []) as unknown as React.MutableRefObject<T | null>;

  // Usamos un objeto ref clásico para permitir `ref={containerRef}` en JSX.
  const ref = (useEnterFlow as unknown as { _r?: never }, { current: null as T | null });

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isTextarea = target.tagName === "TEXTAREA";
      const forceSubmit = e.metaKey || e.ctrlKey;

      if (isTextarea && !forceSubmit) return;
      if (forceSubmit) {
        e.preventDefault();
        onSubmit?.();
        return;
      }

      const container =
        (target.closest("form,[data-enter-flow]") as HTMLElement | null) ?? null;
      if (!container) return;

      const fields = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (el) =>
          isVisible(el) &&
          !el.hasAttribute("readonly") &&
          el.getAttribute("aria-hidden") !== "true",
      );

      const idx = fields.indexOf(target);
      if (idx === -1) return;

      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      e.preventDefault();

      if (nextIdx < 0) return;
      if (nextIdx >= fields.length) {
        onSubmit?.();
        return;
      }
      const next = fields[nextIdx];
      next.focus();
      if (next instanceof HTMLInputElement && next.type !== "checkbox") {
        next.select?.();
      }
    },
    [disabled, onSubmit],
  );

  return { onKeyDown, containerRef: ref as unknown as React.RefObject<T> };
}
