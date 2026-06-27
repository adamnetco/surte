import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertOctagon, PackagePlus, Settings2, X, Check, Loader2 } from "lucide-react";
import { useCriticalStock, CriticalStockRow } from "../hooks/useCriticalStock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  orgId: string | undefined;
};

export default function CriticalStockSheet({ open, onClose, orgId }: Props) {
  const { rows, loading, reload } = useCriticalStock(orgId, open);
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.severity === filter)),
    [rows, filter]
  );

  const counts = useMemo(() => ({
    all: rows.length,
    critical: rows.filter((r) => r.severity === "critical").length,
    warning: rows.filter((r) => r.severity === "warning").length,
  }), [rows]);

  const totalSuggestedCost = useMemo(
    () => filtered.reduce((sum, r) => sum + r.suggested_qty * (r.avg_cost || 0), 0),
    [filtered]
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border bg-card">
          <SheetTitle className="flex items-center gap-2 text-base font-heading">
            <AlertTriangle size={18} className="text-destructive" />
            Stock crítico & reorden
          </SheetTitle>
          <SheetDescription className="text-xs">
            {rows.length} producto{rows.length === 1 ? "" : "s"} requiere{rows.length === 1 ? "" : "n"} reposición.
            {totalSuggestedCost > 0 && (
              <> Costo estimado: <strong>${Math.round(totalSuggestedCost).toLocaleString("es-CO")}</strong></>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Filter pills */}
        <div className="px-4 py-2 flex gap-2 border-b border-border bg-card">
          {([
            { id: "all" as const, label: "Todos", count: counts.all },
            { id: "critical" as const, label: "Crítico", count: counts.critical },
            { id: "warning" as const, label: "Advertencia", count: counts.warning },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                filter === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border"
              }`}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && [0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl p-3 border border-border flex gap-3">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-2.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Check size={32} className="mx-auto mb-2 text-primary" />
              Sin alertas. Todo el inventario está sobre los umbrales configurados.
            </div>
          )}

          {!loading && filtered.map((row) => (
            <CriticalRowCard
              key={row.stock_id}
              row={row}
              editing={editing === row.stock_id}
              onEdit={() => setEditing(editing === row.stock_id ? null : row.stock_id)}
              onSaved={() => { setEditing(null); reload(); }}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted"
        >
          <X size={16} />
        </button>
      </SheetContent>
    </Sheet>
  );
}

function CriticalRowCard({
  row, editing, onEdit, onSaved,
}: { row: CriticalStockRow; editing: boolean; onEdit: () => void; onSaved: () => void }) {
  const [min, setMin] = useState(String(row.min_stock ?? 0));
  const [rop, setRop] = useState(String(row.reorder_point ?? 0));
  const [max, setMax] = useState(String(row.max_stock ?? 0));
  const [saving, setSaving] = useState(false);

  const severityStyle = row.severity === "critical"
    ? "border-destructive/60 bg-destructive/5"
    : "border-yellow-500/50 bg-yellow-500/5";

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("product_stock")
      .update({
        min_stock: Number(min) || 0,
        reorder_point: Number(rop) || 0,
        max_stock: Number(max) || 0,
      })
      .eq("id", row.stock_id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Umbrales actualizados");
    onSaved();
  };

  return (
    <div className={`rounded-xl border p-3 ${severityStyle}`}>
      <div className="flex gap-3 items-start">
        <img src={row.image_url || "/placeholder.svg"} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {row.severity === "critical" ? (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5"><AlertOctagon size={10} className="mr-0.5" />Crítico</Badge>
            ) : (
              <Badge className="text-[10px] h-4 px-1.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20"><AlertTriangle size={10} className="mr-0.5" />Reorden</Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{row.warehouse_name}</span>
          </div>
          <p className="font-semibold text-sm truncate mt-0.5">{row.product_name}</p>
          <p className="text-[11px] text-muted-foreground">
            SKU: {row.sku || "—"} · Mín: {row.min_stock} · Rop: {row.reorder_point ?? 0}
          </p>
          <div className="flex items-baseline gap-3 mt-1.5">
            <span className={`text-lg font-bold ${row.severity === "critical" ? "text-destructive" : "text-yellow-700 dark:text-yellow-400"}`}>
              {row.quantity}
            </span>
            <span className="text-[11px] text-muted-foreground">disponibles</span>
            {row.suggested_qty > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <PackagePlus size={12} /> Sugerido: {row.suggested_qty}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          aria-label="Configurar umbrales"
          className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-foreground"
        >
          <Settings2 size={14} />
        </button>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Mínimo</label>
            <input type="number" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Reorden</label>
            <input type="number" inputMode="decimal" value={rop} onChange={(e) => setRop(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Máximo</label>
            <input type="number" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background border border-border text-sm" />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="col-span-3 mt-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Guardar umbrales
          </button>
        </div>
      )}
    </div>
  );
}
