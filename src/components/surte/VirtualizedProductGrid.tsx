import { memo, useEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import ProductCard from "./ProductCard";

interface Props {
  products: any[];
  /** Threshold to skip virtualization for small lists */
  virtualizeThreshold?: number;
}

// Tailwind breakpoints used in legacy grid: 2 / md:3 / lg:4 / xl:5
function getColumnsForWidth(w: number) {
  if (w >= 1280) return 5;
  if (w >= 1024) return 4;
  if (w >= 768) return 3;
  return 2;
}

const VirtualizedProductGrid = ({ products, virtualizeThreshold = 40 }: Props) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(() =>
    typeof window === "undefined" ? 2 : getColumnsForWidth(window.innerWidth)
  );

  useEffect(() => {
    const onResize = () => setColumns(getColumnsForWidth(window.innerWidth));
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Small lists: render normally — virtualization overhead not worth it
  if (products.length < virtualizeThreshold) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    );
  }

  const rowCount = Math.ceil(products.length / columns);
  // Approximate row height: square image + meta (mobile slightly shorter)
  const estimatedRowHeight = columns >= 4 ? 320 : columns === 3 ? 300 : 260;

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {items.map((row) => {
        const start = row.index * columns;
        const slice = products.slice(start, start + columns);
        return (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 right-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 pb-3 md:pb-4"
            style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
          >
            {slice.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default memo(VirtualizedProductGrid);
