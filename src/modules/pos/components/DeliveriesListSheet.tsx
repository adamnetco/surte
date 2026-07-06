import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bike, Clock, Loader2, Phone, User, RefreshCw } from "lucide-react";
import { supabaseTableOrderRepository } from "@/infrastructure/database/SupabaseTableOrderRepository";
import type { DeliveryRow } from "@/core/ports/ITableOrderRepository";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const minsSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

const STATUS_TONE: Record<string, string> = {
  open: "bg-sky-500/15 text-sky-700 border-sky-500/40",
  sent: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  billed: "bg-violet-500/15 text-violet-700 border-violet-500/40",
  paid: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
};


/**
 * Lista de domicilios abiertos: table_orders con service_type_key='delivery'
 * o metadata.mode='domicilio'. Read-only, con auto-refresh via realtime.
 */
export default function DeliveriesListSheet({ open, onOpenChange, organizationId }: Props) {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("table_orders")
      .select("id,order_number,customer_name,customer_phone,total,status,opened_at,notes,metadata,service_type_key")
      .eq("organization_id", organizationId)
      .in("status", ["open", "sent", "billed"])
      .or("service_type_key.eq.delivery,metadata->>mode.eq.domicilio")
      .order("opened_at", { ascending: false })
      .limit(100);
    if (error) console.warn("[deliveries]", error);
    setRows((data as DeliveryRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    void load();
    const ch = (supabase as any)
      .channel(uniqueTopic(`deliveries-${organizationId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_orders", filter: `organization_id=eq.${organizationId}` },
        () => void load(),
      )
      .subscribe();
    return () => safeRemoveChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizationId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bike className="w-5 h-5 text-primary" /> Domicilios en curso
            </SheetTitle>
            <Button size="icon" variant="ghost" onClick={() => void load()} disabled={loading} title="Refrescar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <SheetDescription className="text-xs">
            {rows.length} pedido{rows.length === 1 ? "" : "s"} activo{rows.length === 1 ? "" : "s"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && rows.length === 0 ? (
            <div className="grid place-items-center py-12 text-sm text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Bike className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No hay domicilios activos.
            </div>
          ) : (
            rows.map((r) => {
              const tone = STATUS_TONE[r.status] ?? "bg-muted text-muted-foreground border-muted";
              const address =
                (r.metadata && (r.metadata.address || r.metadata.direccion)) ||
                r.notes ||
                null;
              return (
                <div key={r.id} className="rounded-lg border p-3 bg-card hover:border-primary/50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">
                          #{r.order_number ?? r.id.slice(0, 6)}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${tone}`}>
                          {r.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-foreground truncate">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {r.customer_name || "Sin cliente"}
                      </div>
                      {r.customer_phone && (
                        <a
                          href={`tel:${r.customer_phone}`}
                          className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Phone className="w-3 h-3" /> {r.customer_phone}
                        </a>
                      )}
                      {address && (
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                          {address}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold tabular-nums">{COP(Number(r.total))}</div>
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground tabular-nums">
                        <Clock className="w-3 h-3" /> {minsSince(r.opened_at)} min
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
