import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * useProgressiveList — "windowing lite" para listas densas (10k+ SKUs).
 *
 * Renderiza sólo los primeros `pageSize` elementos y va ampliando la ventana
 * cuando el contenedor scrollea cerca del final. A diferencia de una
 * virtualización real (react-virtual) mantiene los nodos en el DOM, por lo que
 * la navegación por teclado (roving focus), el scroll-into-view y los lectores
 * de pantalla siguen funcionando sin cambios.
 *
 * Se resetea automáticamente cuando cambia la identidad de la lista (filtros,
 * categoría, búsqueda).
 */
export function useProgressiveList<T>(
  items: readonly T[],
  opts?: { pageSize?: number; resetKey?: unknown },
) {
  const pageSize = opts?.pageSize ?? 120;
  const resetKey = opts?.resetKey;
  const [limit, setLimit] = useState(pageSize);

  useEffect(() => {
    setLimit(pageSize);
  }, [pageSize, resetKey, items.length]);

  const visible = useMemo(
    () => (items.length <= limit ? (items as T[]) : (items.slice(0, limit) as T[])),
    [items, limit],
  );

  const remaining = Math.max(0, items.length - visible.length);

  const loadMore = useCallback(() => {
    setLimit((l) => l + pageSize);
  }, [pageSize]);

  /** Conectar al `onScroll` del contenedor scrolleable. */
  const onScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      if (remaining === 0) return;
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 320) loadMore();
    },
    [remaining, loadMore],
  );

  return { visible, remaining, loadMore, onScroll, total: items.length };
}
