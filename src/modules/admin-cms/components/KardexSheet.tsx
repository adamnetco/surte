import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useInventoryKardex } from "../hooks/useInventoryKardex";
import { ArrowDownCircle, ArrowUpCircle, RotateCcw, ArrowRightLeft, Package } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
  warehouseId?: string | null;
}

const RANGES: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "365d", days: 365 },
];

const TYPE_META: Record<string, { label: string; cls: string; Icon: typeof Package }> = {
  in: { label: "Entrada", cls: "text-emerald-600 bg-emerald-50", Icon: ArrowDownCircle },
  purchase: { label: "Compra", cls: "text-emerald-600 bg-emerald-50", Icon: ArrowDownCircle },
  out: { label: "Salida", cls: "text-rose-600 bg-rose-50", Icon: ArrowUpCircle },
  sale: { label: "Venta", cls: "text-rose-600 bg-rose-50", Icon: ArrowUpCircle },
  adjustment: { label: "Ajuste", cls: "text-amber-600 bg-amber-50", Icon: RotateCcw },
  transfer_in: { label: "Traslado IN", cls: "text-sky-600 bg-sky-50", Icon: ArrowRightLeft },
  transfer_out: { label: "Traslado OUT", cls: "text-sky-600 bg-sky-50", Icon: ArrowRightLeft },
  return: { label: "Devolución", cls: "text-violet-600 bg-violet-50", Icon: RotateCcw },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function KardexSheet({ open, onClose, productId, productName, warehouseId }: Props) {
  const [days, setDays] = useState(30);
  const { from, to } = useMemo(() => {
    const t = new Date();
    const f = new Date(t.getTime() - days * 86400000);
    return { from: f, to: t };
  }, [days]);

  const { data = [], isLoading, error } = useInventoryKardex({ productId, from, to, warehouseId });

  const totals = useMemo(() => {
    let inQ = 0, outQ = 0;
    for (const r of data) {
      if (r.quantity > 0) inQ += r.quantity;
      else outQ += Math.abs(r.quantity);
    }
    return { inQ, outQ, net: inQ - outQ, count: data.length };
  }, [data]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="text-base font-heading truncate">
            Kárdex — {productName ?? "Producto"}
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground">Movimientos del producto con saldo corrido por bodega.</p>
        </SheetHeader>

        {/* Range pills */}
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
                days === r.days
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* KPI strip */}
        <div className="px-4 pt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2">
            <p className="text-[10px] text-emerald-700">Entradas</p>
            <p className="font-bold text-emerald-700">{totals.inQ.toLocaleString("es-CO")}</p>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-2">
            <p className="text-[10px] text-rose-700">Salidas</p>
            <p className="font-bold text-rose-700">{totals.outQ.toLocaleString("es-CO")}</p>
          </div>
          <div className="rounded-xl bg-muted border border-border p-2">
            <p className="text-[10px] text-muted-foreground">Neto</p>
            <p className={`font-bold ${totals.net >= 0 ? "text-foreground" : "text-destructive"}`}>
              {totals.net >= 0 ? "+" : ""}{totals.net.toLocaleString("es-CO")}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card rounded-xl p-3 border border-border">
                  <Skeleton className="h-3 w-1/3 mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-xl p-3">
              Error cargando kárdex: {(error as Error).message}
            </div>
          )}
          {!isLoading && !error && data.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Package className="mx-auto mb-2 opacity-50" size={32} />
              Sin movimientos en el rango seleccionado.
            </div>
          )}
          {data.map((row, idx) => {
            const meta = TYPE_META[row.movement_type] ?? {
              label: row.movement_type,
              cls: "text-muted-foreground bg-muted",
              Icon: Package,
            };
            const Icon = meta.Icon;
            const positive = row.quantity > 0;
            return (
              <div key={idx} className="bg-card rounded-xl p-3 border border-border">
                <div className="flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg shrink-0 ${meta.cls}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{meta.label}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtDate(row.movement_at)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {row.warehouse_name ?? "—"}
                      {row.reference_type ? ` · ref: ${row.reference_type}` : ""}
                    </p>
                    {row.notes && <p className="text-[11px] mt-1 italic text-muted-foreground line-clamp-2">{row.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                      {positive ? "+" : ""}{row.quantity.toLocaleString("es-CO")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Saldo: {row.running_balance.toLocaleString("es-CO")}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
