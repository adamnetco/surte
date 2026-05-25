import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Search, Utensils, Bike } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PosTable {
  id: string;
  label: string;
  zone: string;
  occupied?: boolean;
  total?: number;
  openedMinutes?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current?: string | null;
  /** Si no se pasan, generamos un seed estándar (1..18 + LLEVAR 1..5). */
  tables?: PosTable[];
  onPick: (t: PosTable) => void;
}

const DEFAULT_TABLES: PosTable[] = [
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `local-${i + 1}`, label: String(i + 1), zone: "LOCAL",
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `llevar-${i + 1}`, label: `LLEVAR ${i + 1}`, zone: "LLEVAR",
  })),
];

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

/**
 * Selector visual de mesas estilo VectorPOS, en un Sheet lateral.
 * Mobile-first; en desktop ocupa ~440px a la derecha.
 */
export default function TableGridSheet({ open, onOpenChange, current, tables, onPick }: Props) {
  const data = tables ?? DEFAULT_TABLES;
  const zones = useMemo(() => Array.from(new Set(data.map((t) => t.zone))), [data]);
  const [zone, setZone] = useState<string>(zones[0] ?? "LOCAL");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    return data.filter((t) => t.zone === zone && (!q || t.label.toLowerCase().includes(q.toLowerCase())));
  }, [data, zone, q]);

  const free = data.filter((t) => !t.occupied).length;
  const busy = data.length - free;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[460px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Utensils className="w-5 h-5 text-primary" /> Selecciona la mesa
          </SheetTitle>
          <SheetDescription className="text-xs">
            <span className="text-secondary font-semibold">{free} libres</span> ·{" "}
            <span className="text-destructive font-semibold">{busy} ocupadas</span>
          </SheetDescription>
        </SheetHeader>

        {/* Tabs de zona */}
        <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZone(z)}
              className={cn(
                "h-8 px-3 text-xs font-bold rounded-full border transition",
                z === zone
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {z === "LLEVAR" ? <Bike className="w-3 h-3 inline mr-1" /> : null}
              {z}
            </button>
          ))}
        </div>

        <div className="px-4 py-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar mesa…"
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* Grilla */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {visible.map((t) => {
              const active = current === t.label;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onPick(t); onOpenChange(false); }}
                  className={cn(
                    "aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition relative active:scale-95",
                    t.occupied
                      ? "bg-destructive/10 border-destructive/40 text-destructive"
                      : "bg-primary/5 border-primary/30 text-primary hover:bg-primary/15",
                    active && "ring-2 ring-accent ring-offset-2"
                  )}
                >
                  <span className="text-2xl font-extrabold leading-none">{t.label}</span>
                  {t.occupied ? (
                    <>
                      <span className="text-[10px] font-semibold tabular-nums">
                        {t.total != null ? COP(t.total) : ""}
                      </span>
                      {typeof t.openedMinutes === "number" && (
                        <span className="absolute top-1 right-1 text-[9px] bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 font-bold">
                          {t.openedMinutes}m
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Libre</span>
                  )}
                </button>
              );
            })}
          </div>
          {visible.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">Sin mesas en esta zona</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
