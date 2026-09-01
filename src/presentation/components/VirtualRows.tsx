/**
 * VirtualRows — virtualización genérica de listas densas (window scroll).
 *
 * Presentación pura: no conoce Supabase ni lógica de negocio. Renderiza sólo
 * las filas visibles cuando la lista supera `threshold`; por debajo de ese
 * umbral hace un render normal (el coste de virtualizar no se amortiza y así
 * el comportamiento previo queda intacto).
 *
 * Uso:
 *   <VirtualRows items={filtered} estimateSize={92} getKey={(p) => p.id}>
 *     {(p) => <ProductRow product={p} />}
 *   </VirtualRows>
 */
import { useRef, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

interface Props<T> {
  items: readonly T[];
  /** Altura estimada de fila en px (se re-mide en runtime). */
  estimateSize?: number;
  /** Separación vertical entre filas en px. */
  gap?: number;
  /** Debajo de este número de filas se renderiza sin virtualizar. */
  threshold?: number;
  overscan?: number;
  getKey?: (item: T, index: number) => string | number;
  className?: string;
  children: (item: T, index: number) => ReactNode;
}

export function VirtualRows<T>({
  items,
  estimateSize = 92,
  gap = 8,
  threshold = 60,
  overscan = 8,
  getKey,
  className,
  children,
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const keyOf = (item: T, i: number) => getKey?.(item, i) ?? i;

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize + gap,
    overscan,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  });

  if (items.length < threshold) {
    return (
      <div ref={parentRef} className={className} style={{ display: "grid", rowGap: gap }}>
        {items.map((item, i) => (
          <div key={keyOf(item, i)}>{children(item, i)}</div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={className}
      style={{ position: "relative", height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const item = items[row.index];
        return (
          <div
            key={keyOf(item, row.index)}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              paddingBottom: gap,
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {children(item, row.index)}
          </div>
        );
      })}
    </div>
  );
}

export default VirtualRows;
