import { useCallback, useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarX2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseProductLotRepository as lotRepo } from "@/infrastructure/database/SupabaseProductLotRepository";
import type { LotExpiryRow, LotSeverity } from "@/core/ports/IProductLotRepository";

type Props = { open: boolean; onClose: () => void; orgId: string | undefined };

const SEV_META: Record<LotSeverity, { label: string; variant: "destructive" | "outline" | "secondary" }> = {
  expired: { label: "Vencido", variant: "destructive" },
  critical: { label: "Crítico", variant: "destructive" },
  soon: { label: "Próximo", variant: "outline" },
  ok: { label: "Ok", variant: "secondary" },
};

export default function ExpiryAlertsSheet({ open, onClose, orgId }: Props) {
  const [rows, setRows] = useState<LotExpiryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | LotSeverity>("all");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      setRows(await lotRepo.expirySummary(orgId, 60));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar vencimientos");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.severity === filter)),
    [rows, filter],
  );
  const counts = useMemo(() => ({
    all: rows.length,
    expired: rows.filter((r) => r.severity === "expired").length,
    critical: rows.filter((r) => r.severity === "critical").length,
    soon: rows.filter((r) => r.severity === "soon").length,
  }), [rows]);

  const valueAtRisk = useMemo(
    () => filtered.reduce((s, r) => s + Number(r.quantity) * Number(r.unit_cost || 0), 0),
    [filtered],
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border bg-card">
          <SheetTitle className="flex items-center gap-2 text-base font-heading">
            <CalendarX2 size={18} className="text-destructive" />
            Vencimientos de lotes
          </SheetTitle>
          <SheetDescription className="text-xs">
            {counts.all} lote(s) vencidos o por vencer en 60 días.
            {valueAtRisk > 0 && <> Valor en riesgo: <strong>${Math.round(valueAtRisk).toLocaleString("es-CO")}</strong></>}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-2 flex gap-2 border-b border-border bg-card overflow-x-auto">
          {([
            { id: "all" as const, label: "Todos", count: counts.all },
            { id: "expired" as const, label: "Vencidos", count: counts.expired },
            { id: "critical" as const, label: "Críticos", count: counts.critical },
            { id: "soon" as const, label: "Próximos", count: counts.soon },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition ${
                filter === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">
              Sin lotes en riesgo. Registra fechas de vencimiento al recibir mercancía.
            </p>
          )}
          {!loading && filtered.map((r) => {
            const meta = SEV_META[r.severity];
            return (
              <div key={r.lot_id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{r.product_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Lote {r.lot_code} · {r.warehouse_name} · SKU {r.sku || "—"}
                  </p>
                  <Badge variant={meta.variant} className="mt-1 text-[10px]">
                    {meta.label}
                    {r.expires_at ? ` · ${r.expires_at}` : ""}
                    {r.days_left !== null ? ` (${r.days_left}d)` : ""}
                  </Badge>
                </div>
                <p className="text-sm font-bold tabular-nums">{Number(r.quantity)}</p>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
