import { useMemo, useState } from "react";
import { Users, Clock, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import TableOrderDrawer from "./TableOrderDrawer";
import { useTablesFloor } from "../hooks/useTablesFloor";

/**
 * POSFloorMapPanel — vista embebida de mesas dentro del workspace POS
 * para negocios `food`. Reemplaza la grilla de catálogo cuando el cajero
 * está en modo "Mesas". Reutiliza TableOrderDrawer para la edición del
 * pedido (split, transferir, anular). Sin canvas drag&drop — esto es
 * picking rápido, no diseño (ese vive en /mesas).
 */

interface Area { id: string; name: string; color: string | null; }
interface Table {
  id: string; label: string; capacity: number;
  status: string; dining_area_id: string | null;
}
interface OpenOrder {
  id: string; dining_table_id: string | null;
  total: number; opened_at: string; sub_label: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; ring: string; label: string }> = {
  available: { bg: "bg-emerald-500/10 hover:bg-emerald-500/20",  ring: "ring-emerald-500/30",  label: "Libre" },
  occupied:  { bg: "bg-amber-500/15 hover:bg-amber-500/25",      ring: "ring-amber-500/50",    label: "Ocupada" },
  reserved:  { bg: "bg-sky-500/15 hover:bg-sky-500/25",          ring: "ring-sky-500/50",      label: "Reservada" },
  dirty:     { bg: "bg-muted hover:bg-muted/80",                  ring: "ring-muted-foreground/30", label: "Por limpiar" },
};

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

function minutesSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

interface Props {
  organizationId: string;
  userId: string;
}

export default function POSFloorMapPanel({ organizationId, userId }: Props) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [activeArea, setActiveArea] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);
  const [openTableId, setOpenTableId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const [{ data: a }, { data: t }, { data: o }] = await Promise.all([
      supabase.from("dining_areas")
        .select("id,name,color").eq("organization_id", organizationId)
        .eq("is_active", true).order("sort_order"),
      supabase.from("dining_tables")
        .select("id,label,capacity,status,dining_area_id")
        .eq("organization_id", organizationId).eq("is_active", true).order("label"),
      supabase.from("table_orders")
        .select("id,dining_table_id,total,opened_at,sub_label")
        .eq("organization_id", organizationId).in("status", ["open", "sent", "billed"]),
    ]);
    setAreas((a as Area[]) ?? []);
    setTables((t as Table[]) ?? []);
    setOpenOrders((o as OpenOrder[]) ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refrescar al haber cambios en table_orders o status de mesas.
  useEffect(() => {
    if (!organizationId) return;
    const ch = supabase
      .channel(uniqueTopic("pos-floor"))
      .on("postgres_changes", { event: "*", schema: "public", table: "table_orders", filter: `organization_id=eq.${organizationId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "dining_tables", filter: `organization_id=eq.${organizationId}` }, load)
      .subscribe();
    return () => { safeRemoveChannel(ch); };
  }, [organizationId, load]);

  const filtered = useMemo(
    () => activeArea === "all" ? tables : tables.filter(t => t.dining_area_id === activeArea),
    [tables, activeArea],
  );
  const ordersByTable = useMemo(() => {
    const m = new Map<string, OpenOrder>();
    openOrders.forEach(o => { if (o.dining_table_id) m.set(o.dining_table_id, o); });
    return m;
  }, [openOrders]);

  if (loading) {
    return (
      <div className="flex-1 grid place-items-center text-muted-foreground text-sm gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando mesas…
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex-1 grid place-items-center text-center px-6 py-10">
        <div className="space-y-3 max-w-sm">
          <p className="text-sm font-semibold">Aún no hay mesas configuradas</p>
          <p className="text-xs text-muted-foreground">
            Crea zonas y mesas desde <span className="font-mono">/mesas</span> para activar la operación de salón.
          </p>
          <Button asChild size="sm" variant="outline">
            <a href="/mesas"><Plus className="w-4 h-4 mr-1.5" /> Configurar salón</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tabs de zona */}
      <div className="flex items-center gap-1 px-3 py-2 border-b overflow-x-auto bg-card">
        <button
          onClick={() => setActiveArea("all")}
          className={cn(
            "shrink-0 text-xs px-3 h-8 rounded-md border transition",
            activeArea === "all" ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/60",
          )}
        >
          Todas <span className="ml-1 opacity-70">({tables.length})</span>
        </button>
        {areas.map(a => {
          const count = tables.filter(t => t.dining_area_id === a.id).length;
          const active = activeArea === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setActiveArea(a.id)}
              className={cn(
                "shrink-0 text-xs px-3 h-8 rounded-md border transition",
                active ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary/60",
              )}
            >
              {a.name} <span className="ml-1 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Grilla de mesas */}
      <div className="flex-1 overflow-y-auto p-3">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
        >
          {filtered.map(t => {
            const order = ordersByTable.get(t.id);
            const effectiveStatus = order ? "occupied" : t.status;
            const s = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES.available;
            const mins = order ? minutesSince(order.opened_at) : null;
            return (
              <button
                key={t.id}
                onClick={() => setOpenTableId(t.id)}
                className={cn(
                  "h-[112px] rounded-lg border ring-1 px-2 py-2 text-left transition active:scale-[0.98]",
                  "flex flex-col justify-between",
                  s.bg, s.ring,
                )}
                title={`Mesa ${t.label} — ${s.label}`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xl font-bold leading-none">{t.label}</span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Users className="w-3 h-3" /> {t.capacity}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wide font-semibold opacity-80">
                    {s.label}
                  </div>
                  {order ? (
                    <>
                      <div className="text-sm font-bold tabular-nums">{COP(Number(order.total))}</div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                        <Clock className="w-3 h-3" /> {mins} min
                        {order.sub_label && <span className="ml-1 truncate">· {order.sub_label}</span>}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">Toca para abrir cuenta</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {openTableId && (
        <TableOrderDrawer
          tableId={openTableId}
          organizationId={organizationId}
          userId={userId}
          onClose={() => { setOpenTableId(null); load(); }}
        />
      )}
    </div>
  );
}
