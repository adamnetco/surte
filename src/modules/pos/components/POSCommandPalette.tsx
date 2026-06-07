import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Package } from "lucide-react";

interface Product { id: string; name: string; price: number; sku?: string | null; gtin?: string | null; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: Product[];
  onPick: (productId: string) => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

/** Command Palette (⌘K / Ctrl+K) para buscar y agregar productos al ticket sin tocar el mouse. */
export default function POSCommandPalette({ open, onOpenChange, products, onPick }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Top 30 por relevancia simple (incluye sku / gtin).
  const top = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.gtin?.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [products, query]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar producto, SKU o código de barras…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Productos">
          {top.map((p) => (
            <CommandItem
              key={p.id}
              value={`${p.name} ${p.sku ?? ""} ${p.gtin ?? ""}`}
              onSelect={() => {
                onPick(p.id);
                onOpenChange(false);
                setQuery("");
              }}
              className="flex items-center gap-2"
            >
              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{p.name}</span>
              {p.sku && <span className="text-[10px] text-muted-foreground font-mono">{p.sku}</span>}
              <span className="text-xs font-semibold text-primary">{COP(p.price)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
