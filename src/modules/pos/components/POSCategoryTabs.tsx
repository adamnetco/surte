import { useEffect, useRef, useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { LayoutGrid, ChevronLeft, ChevronRight, Tag, type LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

export interface PosCategory {
  id: string;
  name: string;
  /** lucide-react icon name stored in `categories.icon_name` */
  icon_name?: string | null;
}

interface Props {
  categories: PosCategory[];
  activeId: string | null; // null = todos
  onChange: (id: string | null) => void;
  counts?: Record<string, number>; // optional product counts per category
}

/**
 * Strip horizontal de categorías con icono + chip + contador.
 * Inspirado en Alegra POS / SoftwarePOS: icono visible por categoría y
 * flechas de paginación que aparecen sólo si hay overflow real (desktop).
 * En móvil/táctil se mantiene el scroll horizontal nativo.
 */
export default function POSCategoryTabs({ categories, activeId, onChange, counts }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [categories.length]);

  const scrollBy = (dx: number) => {
    scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div className="relative w-full bg-card border-b">
      {overflow && (
        <button
          type="button"
          onClick={() => scrollBy(-260)}
          aria-label="Categorías anteriores"
          className="hidden md:grid absolute left-0 top-0 bottom-0 z-10 w-8 place-items-center bg-gradient-to-r from-card via-card/90 to-transparent hover:text-primary"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <ScrollArea className="w-full">
        <div
          ref={scrollerRef}
          className={cn("flex items-center gap-1.5 py-2", overflow ? "md:px-10 px-3" : "px-3")}
        >
          <CategoryChip
            label="Todos"
            icon={<LayoutGrid className="w-3.5 h-3.5" />}
            active={activeId === null}
            onClick={() => onChange(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              icon={<DynamicCategoryIcon name={c.icon_name ?? undefined} />}
              count={counts?.[c.id]}
              active={activeId === c.id}
              onClick={() => onChange(c.id)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {overflow && (
        <button
          type="button"
          onClick={() => scrollBy(260)}
          aria-label="Siguientes categorías"
          className="hidden md:grid absolute right-0 top-0 bottom-0 z-10 w-8 place-items-center bg-gradient-to-l from-card via-card/90 to-transparent hover:text-primary"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Resuelve un icono de lucide por nombre. Acepta tanto PascalCase
 * ("ShoppingBag") como kebab-case ("shopping-bag"), que es como suele
 * guardarse en BD. Si no encuentra, cae a un Tag neutro.
 */
function DynamicCategoryIcon({ name }: { name?: string }) {
  if (!name) return <Tag className="w-3.5 h-3.5" />;
  const pascal = name
    .split(/[-_\s]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Icon = ((LucideIcons as unknown) as Record<string, LucideIcon | undefined>)[pascal];
  if (!Icon) return <Tag className="w-3.5 h-3.5" />;
  return <Icon className="w-3.5 h-3.5" />;
}

function CategoryChip({
  label, icon, active, count, onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={typeof count === "number" ? `${label} (${count} productos)` : label}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 px-3 h-10 rounded-full border text-xs font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted"
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
      {typeof count === "number" && (
        <span className={cn(
          "text-[10px] px-1.5 rounded-full font-bold tabular-nums",
          active ? "bg-primary-foreground/20" : "bg-foreground/10"
        )}>{count}</span>
      )}
    </button>
  );
}
