import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Play, Trash2, User, Package, Filter, Loader2, PauseCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ParkedTicketItem {
  productId: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
  notes?: string;
}

interface ParkedTicketRow {
  id: string;
  label: string | null;
  customer_name: string | null;
  notes: string | null;
  items: ParkedTicketItem[];
  subtotal: number;
  total: number;
  cashier_id: string | null;
  cash_session_id: string | null;
  created_at: string;
}

interface Props {
  organizationId: string;
  currentCashSessionId?: string | null;
  currentUserId?: string | null;
  /** Se llama cuando el usuario elige retomar un ticket. El workspace decide cómo integrarlo. */
  onResume: (row: ParkedTicketRow) => void;
  /** Si el workspace tiene ticket abierto, se pasa true para mostrar la advertencia. */
  hasActiveTicket: boolean;
}

const COP = (n: number) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
}).format(n);

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `hace ${days} d`;
}

/**
 * Sheet lateral con la lista de tickets suspendidos. Se abre al recibir el
 * evento `pos:open-parked` (disparado por el badge del top ribbon o desde F-keys).
 *
 * Filtros: búsqueda por texto (etiqueta/cliente/notas), "Solo míos" y
 * "Solo esta sesión de caja". Sin ordenamiento configurable — siempre más
 * reciente primero, que es lo que 99% del tiempo se necesita en operación.
 */
export default function ParkedTicketsSheet({
  organizationId,
  currentCashSessionId,
  currentUserId,
  onResume,
  hasActiveTicket,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParkedTicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyThisSession, setOnlyThisSession] = useState(true);

  // Listener del evento global.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("pos:open-parked", onOpen);
    return () => window.removeEventListener("pos:open-parked", onOpen);
  }, []);

  // Carga + realtime.
  useEffect(() => {
    if (!open || !organizationId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("parked_tickets")
        .select("id, label, customer_name, notes, items, subtotal, total, cashier_id, cash_session_id, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) toast.error("No se pudieron cargar los tickets suspendidos");
      else setRows((data ?? []) as unknown as ParkedTicketRow[]);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel(`parked-sheet-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parked_tickets", filter: `organization_id=eq.${organizationId}` },
        () => load(),
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [open, organizationId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyMine && currentUserId && r.cashier_id !== currentUserId) return false;
      if (onlyThisSession && currentCashSessionId && r.cash_session_id !== currentCashSessionId) return false;
      if (!query) return true;
      const hay = [r.label, r.customer_name, r.notes].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q, onlyMine, onlyThisSession, currentUserId, currentCashSessionId]);

  const handleResume = (row: ParkedTicketRow) => {
    if (hasActiveTicket) {
      const ok = window.confirm(
        "Ya tienes un ticket abierto. Al retomar este suspendido, el ticket actual se descartará.\n\n¿Continuar?",
      );
      if (!ok) return;
    }
    onResume(row);
    // Eliminar tras retomar — un ticket suspendido no se retoma dos veces.
    supabase.from("parked_tickets").delete().eq("id", row.id).then(({ error }) => {
      if (error) toast.error("Retomado pero no se pudo eliminar el suspendido");
    });
    setOpen(false);
  };

  const handleDelete = async (row: ParkedTicketRow) => {
    if (!window.confirm(`Eliminar ticket suspendido${row.label ? ` "${row.label}"` : ""}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("parked_tickets").delete().eq("id", row.id);
    if (error) toast.error("No se pudo eliminar");
    else toast.success("Ticket eliminado");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b space-y-1">
          <SheetTitle className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-amber-600" aria-hidden />
            Tickets suspendidos
            <Badge variant="secondary" className="ml-auto tabular-nums">{filtered.length}</Badge>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Retoma un ticket guardado con F8. Los suspendidos se conservan hasta que los retomes o elimines.
          </SheetDescription>
        </SheetHeader>

        {/* Filtros */}
        <div className="p-3 space-y-2 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por etiqueta, cliente o notas…"
              className="pl-8 h-9 text-sm"
              aria-label="Buscar tickets suspendidos"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1">
              <Filter className="w-3 h-3" aria-hidden /> Filtros:
            </span>
            <FilterChip active={onlyThisSession} onClick={() => setOnlyThisSession((v) => !v)}>
              Solo esta caja
            </FilterChip>
            <FilterChip active={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
              Solo míos
            </FilterChip>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState hasFilters={!!q || onlyMine || (!!currentCashSessionId && onlyThisSession)} totalRows={rows.length} />
          ) : (
            filtered.map((row) => (
              <ParkedCard
                key={row.id}
                row={row}
                onResume={() => handleResume(row)}
                onDelete={() => handleDelete(row)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors touch-manipulation active:scale-95",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-border text-muted-foreground hover:border-primary/40",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ParkedCard({
  row, onResume, onDelete,
}: { row: ParkedTicketRow; onResume: () => void; onDelete: () => void }) {
  const items = Array.isArray(row.items) ? row.items : [];
  const nItems = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  return (
    <article className="rounded-lg border bg-card p-3 space-y-2 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold truncate">
            {row.label ?? row.customer_name ?? `Ticket ${row.id.slice(0, 6)}`}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{relativeTime(row.created_at)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold tabular-nums">{COP(row.total)}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">Sub {COP(row.subtotal)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Package className="w-3 h-3" aria-hidden />
          {items.length} ítem{items.length === 1 ? "" : "s"} · {nItems} und
        </span>
        {row.customer_name && row.label && row.customer_name !== row.label && (
          <span className="inline-flex items-center gap-1 truncate">
            <User className="w-3 h-3" aria-hidden />
            {row.customer_name}
          </span>
        )}
      </div>

      {row.notes && (
        <p className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1 line-clamp-2">
          {row.notes}
        </p>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <Button size="sm" className="flex-1 h-8 text-xs" onClick={onResume}>
          <Play className="w-3.5 h-3.5 mr-1" /> Retomar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          aria-label="Eliminar ticket suspendido"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </article>
  );
}

function EmptyState({ hasFilters, totalRows }: { hasFilters: boolean; totalRows: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <PauseCircle className="w-12 h-12 text-muted-foreground/40 mb-3" aria-hidden />
      <p className="text-sm font-semibold text-muted-foreground">
        {hasFilters && totalRows > 0
          ? "Ningún ticket coincide con los filtros"
          : "No hay tickets suspendidos"}
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
        {hasFilters && totalRows > 0
          ? "Prueba desmarcando “Solo esta caja” o borrando la búsqueda."
          : "Pulsa F8 durante una venta para suspender el ticket actual."}
      </p>
    </div>
  );
}
