import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ArrowLeftRight, Loader2, X, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTablesFloor } from "../hooks/useTablesFloor";
import TableOrderDrawer from "./TableOrderDrawer";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const minsSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

/**
 * Vista tipo VectorPOS de TODAS las mesas del salón:
 * - Muestra ocupación + tiempo transcurrido + total en cuenta.
 * - Permite mover un ticket de una mesa a otra (Mover → tocar origen → tocar destino).
 * - Tocar una mesa ocupada (fuera de modo mover) abre el drawer para cobrar/imprimir.
 */
export default function TablesOverviewSheet({ open, onOpenChange, organizationId, userId }: Props) {
  const { areas, tables, primaryOrderByTable, loading, reload } = useTablesFloor(organizationId);
  const [activeArea, setActiveArea] = useState<string | "all">("all");
  const [moveMode, setMoveMode] = useState(false);
  const [moveSource, setMoveSource] = useState<{ tableId: string; orderId: string; label: string } | null>(null);
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const filtered = useMemo(
    () => (activeArea === "all" ? tables : tables.filter((t) => t.dining_area_id === activeArea)),
    [tables, activeArea],
  );

  const occupiedCount = tables.filter((t) => primaryOrderByTable.get(t.id)).length;
  const freeCount = tables.length - occupiedCount;

  const cancelMove = () => {
    setMoveMode(false);
    setMoveSource(null);
  };

  const handleTableClick = async (t: (typeof tables)[number]) => {
    const order = primaryOrderByTable.get(t.id);

    if (moveMode) {
      if (!moveSource) {
        if (!order) {
          toast.error("Selecciona primero una mesa OCUPADA como origen");
          return;
        }
        setMoveSource({ tableId: t.id, orderId: order.id, label: t.label });
        toast.info(`Origen: mesa ${t.label}. Ahora toca la mesa destino (libre).`);
        return;
      }
      // Ya hay origen → destino
      if (t.id === moveSource.tableId) {
        toast.error("Selecciona una mesa distinta como destino");
        return;
      }
      if (order) {
        toast.error(`La mesa ${t.label} está ocupada`);
        return;
      }
      setMoving(true);
      try {
        const { error: uErr } = await (supabase as any)
          .from("table_orders")
          .update({ dining_table_id: t.id })
          .eq("id", moveSource.orderId)
          .eq("organization_id", organizationId);
        if (uErr) throw uErr;

        await (supabase as any)
          .from("dining_tables")
          .update({ status: "occupied" })
          .eq("id", t.id)
          .eq("organization_id", organizationId);

        await (supabase as any)
          .from("dining_tables")
          .update({ status: "available" })
          .eq("id", moveSource.tableId)
          .eq("organization_id", organizationId);

        toast.success(`Cuenta movida: mesa ${moveSource.label} → mesa ${t.label}`);
        cancelMove();
        await reload();
      } catch (err) {
        console.error("[move-table]", err);
        toast.error("No se pudo mover la cuenta");
      } finally {
        setMoving(false);
      }
      return;
    }

    // Modo normal → abrir drawer
    setOpenTableId(t.id);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) cancelMove(); onOpenChange(o); }}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b space-y-2">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Utensils className="w-5 h-5 text-primary" /> Todas las mesas
            </SheetTitle>
            <Button
              size="sm"
              variant={moveMode ? "default" : "outline"}
              onClick={() => (moveMode ? cancelMove() : setMoveMode(true))}
              className="gap-1.5"
            >
              {moveMode ? <X className="w-3.5 h-3.5" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
              {moveMode ? "Cancelar" : "Mover cuenta"}
            </Button>
          </div>
          <SheetDescription className="text-xs flex items-center gap-3">
            <span className="text-emerald-600 font-semibold">{freeCount} libres</span>
            <span className="text-amber-600 font-semibold">{occupiedCount} ocupadas</span>
            {moveMode && (
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {moveSource ? `Origen: ${moveSource.label} — toca destino libre` : "Toca la mesa origen (ocupada)"}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

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
          {areas.map((a) => {
            const count = tables.filter((t) => t.dining_area_id === a.id).length;
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

        {/* Grilla */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid place-items-center py-12 text-sm text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando mesas…
            </div>
          ) : tables.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              No hay mesas configuradas.
            </p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
              {filtered.map((t) => {
                const order = primaryOrderByTable.get(t.id);
                const isSource = moveSource?.tableId === t.id;
                const isValidTarget = moveMode && moveSource && !order && t.id !== moveSource.tableId;
                return (
                  <button
                    key={t.id}
                    disabled={moving}
                    onClick={() => handleTableClick(t)}
                    className={cn(
                      "h-[118px] rounded-lg border ring-1 px-2 py-2 text-left transition active:scale-[0.98] flex flex-col justify-between",
                      order
                        ? "bg-amber-500/15 ring-amber-500/50 border-amber-500/40"
                        : "bg-emerald-500/10 ring-emerald-500/30 border-emerald-500/30",
                      isSource && "ring-2 ring-primary bg-primary/10",
                      isValidTarget && "ring-2 ring-emerald-500 animate-pulse",
                      moving && "opacity-60",
                    )}
                    title={`Mesa ${t.label}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xl font-bold leading-none">{t.label}</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Users className="w-3 h-3" /> {t.capacity}
                      </span>
                    </div>
                    {order ? (
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold tabular-nums">{COP(Number(order.total))}</div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                          <Clock className="w-3 h-3" /> {minsSince(order.opened_at)} min
                          {order.sub_label && <span className="ml-1 truncate">· {order.sub_label}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">Libre</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {openTableId && (
          <TableOrderDrawer
            tableId={openTableId}
            organizationId={organizationId}
            userId={userId}
            onClose={() => { setOpenTableId(null); reload(); }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
