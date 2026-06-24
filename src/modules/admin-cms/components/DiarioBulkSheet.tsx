import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, FileCheck2, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Ola 4 — Slice 1: Bulk actions en acciones del Daily Driver.
 * Sheet lateral que lista los ítems afectados (DIAN errors o pedidos pendientes)
 * con selección múltiple y ejecución batch contra los EFs / tabla correspondientes.
 */

export type BulkKind = "einvoice" | "pending";

type EinvoiceRow = {
  id: string;
  full_number: string | null;
  customer_name: string | null;
  total: number | null;
  status: string;
  last_error: string | null;
  retry_count: number | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_number: number;
  customer_name: string | null;
  total: number | null;
  created_at: string;
  payment_status: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: BulkKind | null;
  organizationId: string | undefined;
  onAfterAction?: () => void;
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const META: Record<BulkKind, { title: string; description: string; icon: any; cta: string }> = {
  einvoice: {
    title: "Errores de facturación electrónica",
    description: "Selecciona las facturas a reintentar contra la DIAN.",
    icon: FileCheck2,
    cta: "Reintentar seleccionadas",
  },
  pending: {
    title: "Pedidos pendientes",
    description: "Marca como confirmados los pedidos que ya estén en proceso.",
    icon: ShoppingCart,
    cta: "Confirmar seleccionados",
  },
};

export default function DiarioBulkSheet({
  open,
  onOpenChange,
  kind,
  organizationId,
  onAfterAction,
}: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  // Reset selección al cerrar / cambiar kind
  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open, kind]);

  const queryKey = ["admin", "diario-bulk", kind, organizationId];
  const since24h = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), [open, kind]);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey,
    enabled: open && !!organizationId && !!kind,
    queryFn: async () => {
      if (!organizationId || !kind) return [];

      if (kind === "einvoice") {
        const { data, error } = await supabase
          .from("electronic_invoices")
          .select("id, full_number, customer_name, total, status, last_error, retry_count, created_at")
          .eq("organization_id", organizationId)
          .in("status", ["error", "dead_letter", "rejected"])
          .gte("created_at", since24h)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return (data ?? []) as EinvoiceRow[];
      }

      // pending
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, total, created_at, payment_status")
        .eq("organization_id", organizationId)
        .eq("status", "pendiente")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const rows = (data ?? []) as Array<EinvoiceRow | OrderRow>;
  const meta = kind ? META[kind] : null;
  const allChecked = rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runRetryAllToday = async () => {
    if (!organizationId) return;
    setRunning(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("einvoice-resend", {
        body: { action: "retry_all_today", organization_id: organizationId },
      });
      if (error) throw error;
      const requeued = (res as any)?.requeued ?? (res as any)?.candidates ?? 0;
      toast.success(`Reencolados ${requeued} documento(s) DIAN del día`);
      await refetch();
      qc.invalidateQueries({ queryKey: ["admin", "diario", organizationId] });
      onAfterAction?.();
    } catch (e: any) {
      toast.error("No se pudo reintentar el lote", { description: e?.message });
    } finally {
      setRunning(false);
    }
  };

  const runBulk = async () => {
    if (!kind || selected.size === 0) return;
    setRunning(true);
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;

    try {
      if (kind === "einvoice") {
        // Reintento individual en paralelo (max 5 concurrentes)
        const chunks = chunk(ids, 5);
        for (const c of chunks) {
          const results = await Promise.allSettled(
            c.map((id) =>
              supabase.functions.invoke("einvoice-resend", {
                body: { invoice_id: id, action: "retry_now" },
              }),
            ),
          );
          results.forEach((r) => {
            if (r.status === "fulfilled" && !(r.value as any)?.error) ok++;
            else fail++;
          });
        }
      } else if (kind === "pending") {
        const { error } = await supabase
          .from("orders")
          .update({ status: "confirmado" })
          .in("id", ids)
          .eq("organization_id", organizationId!);
        if (error) {
          fail = ids.length;
        } else {
          ok = ids.length;
        }
      }

      if (ok > 0) toast.success(`${ok} procesado(s) correctamente${fail ? ` · ${fail} con error` : ""}`);
      else toast.error(`No se pudo procesar el lote (${fail} error/es)`);

      setSelected(new Set());
      await refetch();
      qc.invalidateQueries({ queryKey: ["admin", "diario", organizationId] });
      onAfterAction?.();
    } catch (e: any) {
      toast.error("Error ejecutando acción bulk", { description: e?.message });
    } finally {
      setRunning(false);
    }
  };

  if (!meta || !kind) return null;
  const Icon = meta.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] p-0 flex flex-col sm:max-w-2xl sm:mx-auto sm:rounded-t-2xl">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border text-left">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg grid place-items-center bg-primary/10 text-primary shrink-0">
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base">{meta.title}</SheetTitle>
              <SheetDescription className="text-xs">{meta.description}</SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isRefetching}
              aria-label="Actualizar lista"
            >
              <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                disabled={rows.length === 0 || running}
              />
              {selected.size > 0 ? `${selected.size} seleccionado(s)` : `Seleccionar todo (${rows.length})`}
            </label>
            {kind === "einvoice" && (
              <Button
                variant="outline"
                size="sm"
                onClick={runRetryAllToday}
                disabled={running || isLoading}
                className="text-xs h-7"
              >
                {running ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                Reintentar todos hoy
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-2">
          {isLoading && (
            <div className="space-y-2 py-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="text-destructive shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-destructive">No pudimos cargar los datos.</p>
            </div>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-medium">Sin elementos por procesar</p>
              <p className="text-xs">Todo está al día.</p>
            </div>
          )}

          {!isLoading && rows.length > 0 && (
            <ul className="space-y-1.5 py-1">
              {rows.map((row) => {
                const checked = selected.has(row.id);
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex items-start gap-2 p-2.5 rounded-lg border transition cursor-pointer",
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-foreground/20",
                    )}
                    onClick={() => !running && toggleOne(row.id)}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleOne(row.id)}
                      disabled={running}
                      className="mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      {kind === "einvoice" ? (
                        <EinvoiceLine row={row as EinvoiceRow} />
                      ) : (
                        <OrderLine row={row as OrderRow} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <SheetFooter className="border-t border-border px-4 py-3 flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={running}
          >
            <X size={14} className="mr-1" />
            Cerrar
          </Button>
          <Button
            className="flex-1"
            onClick={runBulk}
            disabled={running || selected.size === 0}
          >
            {running ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            {meta.cta}
            {selected.size > 0 && ` (${selected.size})`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EinvoiceLine({ row }: { row: EinvoiceRow }) {
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-foreground">
          {row.full_number ?? "—"}
        </span>
        <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
          {row.status}
        </Badge>
        {(row.retry_count ?? 0) > 0 && (
          <span className="text-[10px] text-muted-foreground">{row.retry_count} reintento(s)</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {row.customer_name ?? "Sin cliente"} ·{" "}
        <span className="tabular-nums">{COP.format(Number(row.total ?? 0))}</span>
      </p>
      {row.last_error && (
        <p className="text-[11px] text-red-700 mt-0.5 line-clamp-2" title={row.last_error}>
          {row.last_error}
        </p>
      )}
    </>
  );
}

function OrderLine({ row }: { row: OrderRow }) {
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-foreground">#{row.order_number}</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5">pendiente</Badge>
        {row.payment_status && row.payment_status !== "pendiente" && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">pago: {row.payment_status}</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {row.customer_name ?? "Sin cliente"} ·{" "}
        <span className="tabular-nums">{COP.format(Number(row.total ?? 0))}</span>
      </p>
      <p className="text-[11px] text-muted-foreground">
        {new Date(row.created_at).toLocaleString("es-CO", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
