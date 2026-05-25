import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PosCategory { id: string; name: string; }

interface Props {
  categories: PosCategory[];
  activeId: string | null; // null = todos
  onChange: (id: string | null) => void;
  counts?: Record<string, number>; // optional product counts per category
}

/** Tabs horizontales scrollables con la categoría "Todos" siempre presente. */
export default function POSCategoryTabs({ categories, activeId, onChange, counts }: Props) {
  return (
    <ScrollArea className="w-full bg-card border-b">
      <div className="flex items-center gap-1.5 px-3 py-2">
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
            count={counts?.[c.id]}
            active={activeId === c.id}
            onClick={() => onChange(c.id)}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
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
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-semibold transition-all active:scale-95",
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
