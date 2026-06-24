import { useState } from "react";
import { FileCheck2, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useShiftDocsStats } from "@/modules/pos/hooks/useShiftDocsStats";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  organizationId: string;
  className?: string;
}

interface RecentRow {
  id: string;
  full_number: string | null;
  status: string;
  total: number;
  created_at: string;
  customer_name: string | null;
}

/**
 * AC15 — Widget de turno en la barra POS:
 * "Docs hoy: X ok · Y retry · Z error". Click → popover con últimos 10 docs y
 * acción rápida "Reintentar todos los pendientes" (admin).
 */
export default function EinvoiceShiftWidget({ organizationId, className }: Props) {
  const stats = useShiftDocsStats(organizationId);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentRow[] | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadRecent = async () => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("electronic_invoices")
      .select("id, full_number, status, total, created_at, customer_name")
      .eq("organization_id", organizationId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);
    setRecent((data as any) ?? []);
  };

  const retryAll = async () => {
    setRetrying(true);
    try {
      // Preview con dry_run para confirmar count antes de mutar.
      const { data: preview, error: preErr } = await supabase.functions.invoke("einvoice-resend", {
        body: { action: "retry_all_today", organization_id: organizationId, dry_run: true },
      });
      if (preErr) throw preErr;
      const candidates = (preview as any)?.candidates ?? 0;
      if (candidates === 0) {
        toast.info("Sin pendientes que reintentar");
        return;
      }
      if (!window.confirm(`Se reencolarán ${candidates} documentos. ¿Continuar?`)) return;

      // POS-einvoice-retry-scoping AC3: enviar organization_id explícito
      const { data, error } = await supabase.functions.invoke("einvoice-resend", {
        body: { action: "retry_all_today", organization_id: organizationId },
      });
      if (error) throw error;
      toast.success(`Reencoladas: ${(data as any)?.requeued ?? 0}`);
      loadRecent();
    } catch (e: any) {
      toast.error("No se pudo reintentar", { description: e?.message });
    } finally {
      setRetrying(false);
    }
  };



  if (stats.loading) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-1", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        Docs hoy…
      </div>
    );
  }

  if (stats.total === 0) return null;

  const hasIssues = stats.retry > 0 || stats.error > 0;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) loadRecent(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Documentos DIAN emitidos hoy"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition hover:bg-muted",
            hasIssues ? "border-amber-300 bg-amber-50 text-amber-900" : "border-border bg-card text-foreground",
            className,
          )}
        >
          <FileCheck2 className="w-3 h-3 shrink-0" />
          <span className="font-semibold">Docs {stats.total}</span>
          <span className="text-emerald-700">· {stats.ok} ok</span>
          {stats.retry > 0 && <span className="text-amber-700">· {stats.retry} retry</span>}
          {stats.error > 0 && <span className="text-destructive">· {stats.error} err</span>}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-2">
        <div>
          <p className="text-sm font-semibold">Documentos DIAN hoy</p>
          <p className="text-[11px] text-muted-foreground">
            {stats.ok} aceptados · {stats.retry} en cola · {stats.error} con error
          </p>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1">
          {recent === null && (
            <p className="text-xs text-muted-foreground py-2 text-center">Cargando…</p>
          )}
          {recent?.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">Sin documentos.</p>
          )}
          {recent?.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-[11px] py-1 border-b last:border-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{r.full_number ?? "—"}</p>
                <p className="text-muted-foreground truncate">
                  {r.customer_name ?? "Consumidor final"} · {new Date(r.created_at).toLocaleTimeString("es-CO")}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>

        {(stats.retry > 0 || stats.error > 0) && (
          <button
            type="button"
            onClick={retryAll}
            disabled={retrying}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold py-1.5 hover:opacity-90 disabled:opacity-50"
          >
            {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3" />}
            Reintentar pendientes
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "accepted" || status === "sent" ? "bg-emerald-100 text-emerald-800" :
    status === "rejected" || status === "error" ? "bg-destructive/15 text-destructive" :
    "bg-amber-100 text-amber-800";
  return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0", cls)}>{status}</span>;
}
