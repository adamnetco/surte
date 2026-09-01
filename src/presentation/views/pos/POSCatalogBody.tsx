import React from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export interface CatalogProduct {
  id: string;
  name: string;
  price: number | string;
  image_url?: string | null;
  category_id?: string | null;
}

interface Props<T extends CatalogProduct> {
  loading: boolean;
  catalogError: string | null;
  filteredCount: number;
  visible: readonly T[];
  remaining: number;
  onLoadMore: () => void;
  onScroll: (e: React.UIEvent<HTMLElement>) => void;
  density: "grid" | "list";
  isFood: boolean;
  categoryNameById: Record<string, string>;
  containerRef: React.RefObject<HTMLDivElement>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSelect: (p: T) => void;
  onRetry: () => void;
}

/**
 * Cuerpo scrolleable del catálogo POS (grid / lista densa) — presentación pura.
 * Recibe la ventana progresiva ya calculada y la navegación por teclado por props.
 */
export function POSCatalogBody<T extends CatalogProduct>({
  loading,
  catalogError,
  filteredCount,
  visible,
  remaining,
  onLoadMore,
  onScroll,
  density,
  isFood,
  categoryNameById,
  containerRef,
  onKeyDown,
  onSelect,
  onRetry,
}: Props<T>) {
  return (
    <div className="flex-1 overflow-y-auto p-3" onScroll={onScroll}>
      {loading ? (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
          aria-label="Cargando catálogo"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border overflow-hidden">
              <Skeleton className="aspect-square rounded-none" />
              <div className="p-2 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-4 w-1/2 mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : catalogError && filteredCount === 0 ? (
        <div className="text-center py-10 px-4 space-y-2">
          <p className="text-sm font-semibold text-destructive">No se pudo cargar el catálogo</p>
          <p className="text-xs text-muted-foreground">{catalogError}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : filteredCount === 0 ? (
        <div className="text-center py-10 px-4" role="status">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/50 border border-border grid place-items-center mb-3">
            <ScanLine className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sin productos en esta vista</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Prueba con otra categoría, escanea un código de barras o busca por nombre/SKU (
            <kbd className="px-1 rounded bg-muted font-mono text-[10px]">F3</kbd>).
          </p>
        </div>
      ) : density === "list" ? (
        <ul
          role="list"
          ref={containerRef as unknown as React.RefObject<HTMLUListElement>}
          onKeyDown={onKeyDown}
          className="divide-y rounded-md border bg-card overflow-hidden"
        >
          {visible.map((p, idx) => {
            const cat = p.category_id ? categoryNameById[p.category_id] : null;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  data-kbd-item
                  onClick={() => onSelect(p)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-primary/5 focus:bg-primary/10 focus:outline-none transition"
                >
                  {!isFood && idx < 9 && (
                    <kbd
                      className="shrink-0 px-1 py-0 text-[9px] font-bold rounded bg-foreground/85 text-background w-7 text-center"
                      title={`Alt+${idx + 1}`}
                      aria-hidden="true"
                    >
                      Alt+{idx + 1}
                    </kbd>
                  )}
                  <span className="flex-1 min-w-0 truncate text-[12px] font-medium">{p.name}</span>
                  {cat && (
                    <span className="hidden sm:inline text-[10px] text-muted-foreground shrink-0 truncate max-w-[120px]">
                      ({cat})
                    </span>
                  )}
                  <span className="text-[12px] font-bold text-primary tabular-nums shrink-0">
                    {COP(Number(p.price))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div ref={containerRef} onKeyDown={onKeyDown} className="grid gap-1.5 grid-cols-2 sm:grid-cols-3">
          {visible.map((p, idx) => {
            const cat = p.category_id ? categoryNameById[p.category_id] : null;
            return (
              <button
                key={p.id}
                data-kbd-item
                onClick={() => onSelect(p)}
                className="group relative bg-card rounded-md border border-border hover:border-primary/50 hover:shadow-sm transition text-left overflow-hidden active:scale-[0.98] flex flex-col focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                title={`${p.name}${cat ? ` · ${cat}` : ""} — ${COP(Number(p.price))}`}
              >
                {!isFood && idx < 9 && (
                  <kbd
                    className="absolute top-1 left-1 z-10 px-1 py-0 text-[9px] font-bold rounded bg-foreground/80 text-background"
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </kbd>
                )}
                <div className="aspect-[4/3] bg-gradient-to-br from-muted/60 to-muted overflow-hidden">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted-foreground/40 text-2xl font-heading font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="px-1.5 py-1 leading-tight flex flex-col gap-0.5 flex-1">
                  <p className="text-[11px] font-medium line-clamp-2 min-h-[1.7em] text-foreground">{p.name}</p>
                  <span className="text-[12px] font-bold tabular-nums text-primary mt-auto">
                    {COP(Number(p.price))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {remaining > 0 && (
        <div className="pt-2 text-center">
          <Button size="sm" variant="outline" onClick={onLoadMore} className="h-9 text-xs">
            Mostrar más ({remaining} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}

export default POSCatalogBody;
