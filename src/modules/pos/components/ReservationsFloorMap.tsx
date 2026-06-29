// Ola 28 Slice 2 — Plano de mesas con drag&drop para asignar reservas.
// Arrastra una reserva (chip izquierda) sobre una mesa del plano para asignarla.
// Re-arrastrar a la papelera o doble click sobre la pill liberará la mesa.
import { useMemo, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { Users, Trash2, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useFloorMap,
  useAssignReservationTable,
  type ReservationRow,
} from "../hooks/useReservations";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-500",
  confirmed: "bg-blue-500",
  seated: "bg-emerald-500",
  completed: "bg-muted-foreground",
  cancelled: "bg-red-500",
  no_show: "bg-orange-500",
};

interface Props {
  reservations: ReservationRow[];
  isLoading?: boolean;
}

export default function ReservationsFloorMap({ reservations, isLoading }: Props) {
  const { data: floor, isLoading: loadingFloor } = useFloorMap();
  const assign = useAssignReservationTable();
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const areas = floor?.areas ?? [];
  const tables = floor?.tables ?? [];
  const activeAreaId = activeArea ?? areas[0]?.id ?? null;
  const tablesInArea = useMemo(
    () => tables.filter((t) => t.dining_area_id === activeAreaId),
    [tables, activeAreaId],
  );

  const assignedByTable = useMemo(() => {
    const map = new Map<string, ReservationRow[]>();
    reservations.forEach((r) => {
      if (!r.dining_table_id) return;
      const arr = map.get(r.dining_table_id) ?? [];
      arr.push(r);
      map.set(r.dining_table_id, arr);
    });
    return map;
  }, [reservations]);

  const unassigned = reservations.filter(
    (r) => !r.dining_table_id && !["cancelled", "completed", "no_show"].includes(r.status),
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragId(null);
    const reservationId = String(e.active.id);
    const target = e.over?.id ? String(e.over.id) : null;
    if (!target) return;
    const tableId = target.startsWith("table:") ? target.slice(6) : null;
    const isTrash = target === "trash";
    const reservation = reservations.find((r) => r.id === reservationId);
    if (!reservation) return;
    try {
      if (isTrash) {
        if (!reservation.dining_table_id) return;
        await assign.mutateAsync({ id: reservationId, dining_table_id: null });
        toast.success("Mesa liberada");
      } else if (tableId && reservation.dining_table_id !== tableId) {
        await assign.mutateAsync({ id: reservationId, dining_table_id: tableId });
        toast.success("Reserva asignada a la mesa");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar");
    }
  };

  const draggedRes = dragId ? reservations.find((r) => r.id === dragId) : null;

  if (loadingFloor || isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Skeleton className="h-[500px]" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  if (areas.length === 0 || tables.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground border-dashed">
        Configura áreas y mesas en <code className="bg-muted px-1 rounded">/mesas</code> para usar el plano.
      </Card>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Columna reservas sin asignar */}
        <Card className="p-3 flex flex-col gap-2 max-h-[70vh]">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" /> Sin mesa ({unassigned.length})
            </h3>
            <TrashDroppable />
          </header>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {unassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Todas las reservas activas tienen mesa.
              </p>
            ) : (
              unassigned.map((r) => <ReservationChip key={r.id} r={r} />)
            )}
          </div>
        </Card>

        {/* Plano */}
        <Card className="p-3 flex flex-col gap-3 min-h-[600px]">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {areas.map((a) => (
              <button
                key={a.id}
                onClick={() => setActiveArea(a.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition",
                  activeAreaId === a.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted",
                )}
              >
                {a.name}
              </button>
            ))}
          </div>
          <div className="relative flex-1 rounded-lg border-2 border-dashed border-border bg-muted/20 overflow-auto">
            {tablesInArea.length === 0 ? (
              <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                Sin mesas en esta zona
              </p>
            ) : (
              tablesInArea.map((t) => (
                <TableDroppable key={t.id} table={t} reservations={assignedByTable.get(t.id) ?? []} />
              ))
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Arrastra una reserva sobre una mesa para asignarla. Sobre la papelera para liberarla.
          </p>
        </Card>
      </div>

      <DragOverlay>
        {draggedRes ? (
          <div className="rounded-md border bg-card shadow-lg px-2.5 py-1.5 text-xs font-medium opacity-90">
            {format(new Date(draggedRes.starts_at), "HH:mm")} · {draggedRes.customer_name} · {draggedRes.party_size}p
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ReservationChip({ r }: { r: ReservationRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: r.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-md border bg-card px-2.5 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none",
        "hover:border-primary/50 transition",
        isDragging && "opacity-30",
      )}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[r.status])} />
        {format(new Date(r.starts_at), "HH:mm")} · {r.customer_name}
      </div>
      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
        <Users className="h-3 w-3" />{r.party_size} pers
        {r.deposit_amount > 0 && <span className="ml-1">· dep ${Number(r.deposit_amount).toLocaleString("es-CO")}</span>}
      </div>
    </div>
  );
}

function TableDroppable({
  table,
  reservations,
}: {
  table: { id: string; label: string; capacity: number; pos_x: number; pos_y: number; width: number; height: number; shape: string };
  reservations: ReservationRow[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `table:${table.id}` });
  const occupied = reservations.length > 0;
  return (
    <div
      ref={setNodeRef}
      style={{ left: table.pos_x, top: table.pos_y, width: table.width, height: table.height }}
      className={cn(
        "absolute border-2 p-1.5 flex flex-col items-center justify-center text-center transition-all",
        table.shape === "round" ? "rounded-full" : "rounded-xl",
        occupied
          ? "bg-primary/10 border-primary text-primary"
          : "bg-secondary/10 border-secondary/40 text-secondary-foreground",
        isOver && "ring-4 ring-accent ring-offset-1 scale-105",
      )}
    >
      <div className="flex items-baseline gap-1">
        <span className="font-bold text-sm leading-none">{table.label}</span>
        <span className="text-[9px] flex items-center gap-0.5 opacity-70">
          <Users className="h-2.5 w-2.5" />{table.capacity}
        </span>
      </div>
      {occupied && (
        <div className="mt-1 flex flex-col items-center gap-0.5">
          {reservations.slice(0, 2).map((r) => (
            <Badge key={r.id} variant="outline" className="text-[9px] px-1 py-0 h-4 max-w-full truncate">
              {format(new Date(r.starts_at), "HH:mm")} {r.customer_name.split(" ")[0]}
            </Badge>
          ))}
          {reservations.length > 2 && (
            <span className="text-[9px] opacity-70">+{reservations.length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
}

function TrashDroppable() {
  const { setNodeRef, isOver } = useDroppable({ id: "trash" });
  const assign = useAssignReservationTable();
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border border-dashed px-2 py-1 text-xs flex items-center gap-1 transition",
        isOver ? "border-destructive bg-destructive/10 text-destructive" : "border-muted-foreground/30 text-muted-foreground",
      )}
      title="Soltar aquí para liberar la mesa"
    >
      {assign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      Liberar
    </div>
  );
}
