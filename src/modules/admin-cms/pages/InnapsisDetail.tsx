import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  FileText,
  Loader2,
  Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const EVENT_ICON: Record<string, { Icon: any; cls: string }> = {
  emitted: { Icon: Send, cls: "text-sky-600 bg-sky-500/10" },
  accepted: { Icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/10" },
  rejected: { Icon: XCircle, cls: "text-red-600 bg-red-500/10" },
  error: { Icon: XCircle, cls: "text-red-600 bg-red-500/10" },
  retry: { Icon: RefreshCw, cls: "text-amber-600 bg-amber-500/10" },
  contingency: { Icon: AlertTriangle, cls: "text-orange-600 bg-orange-500/10" },
  pending: { Icon: Clock, cls: "text-muted-foreground bg-muted" },
};

const eventVisual = (type: string) => {
  const key = (type || "").toLowerCase();
  return (
    EVENT_ICON[key] ??
    Object.entries(EVENT_ICON).find(([k]) => key.includes(k))?.[1] ?? {
      Icon: Circle,
      cls: "text-muted-foreground bg-muted",
    }
  );
};

const InnapsisDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const invoiceQ = useQuery({
    queryKey: ["admin", "innapsis", "detail", id],
    enabled: !!id && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("electronic_invoices")
        .select("*")
        .eq("id", id!)
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [eventsLimit, setEventsLimit] = useState(25);

  const eventsQ = useQuery({
    queryKey: ["admin", "innapsis", "events", id, eventsLimit],
    enabled: !!id && !!orgId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("einvoice_events")
        .select("id,event_type,status,message,payload,response,created_at,performed_by", {
          count: "exact",
        })
        .eq("invoice_id", id!)
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(eventsLimit);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });

  const retry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("innapsis-emit", {
        body: { invoice_id: id, forced_retry: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reintento encolado");
      queryClient.invalidateQueries({ queryKey: ["admin", "innapsis", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "innapsis", "events", id] });
    },
    onError: (e: any) => toast.error(`No se pudo reintentar: ${e.message ?? e}`),
  });

  const inv = invoiceQ.data as any;
  const events = (eventsQ.data as any)?.rows ?? [];
  const totalEvents = (eventsQ.data as any)?.total ?? events.length;

  const lastError = useMemo(() => {
    if (inv?.last_error) return inv.last_error;
    const failed = events.find((e: any) =>
      ["error", "rejected"].includes((e.status ?? e.event_type ?? "").toLowerCase()),
    );
    return failed?.message ?? null;
  }, [inv, events]);

  if (invoiceQ.isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AdminHeader />
        <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AdminHeader />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <EmptyState
            icon={FileText}
            title="Factura no encontrada"
            description="No existe o no pertenece a tu organización."
            compact
          />
          <div className="text-center mt-4">
            <button
              onClick={() => navigate("/admin/innapsis")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Volver al listado
            </button>
          </div>
        </main>
      </div>
    );
  }

  const canRetry = ["error", "rejected", "permanent", "retrying", "dead_letter"].includes(
    (inv.status ?? "").toLowerCase(),
  );

  return (
    <div className="min-h-[100dvh] bg-background pb-16">
      <AdminHeader />

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Volver + título */}
        <button
          onClick={() => navigate("/admin/innapsis")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Volver a Innapsis
        </button>

        <header className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-lg text-foreground truncate">
                {inv.full_number ?? `${inv.prefix ?? ""}${inv.number ?? "—"}`}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {inv.customer_name ?? "Consumidor final"}
                {inv.customer_identification ? ` · ${inv.customer_identification}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                {new Date(inv.issue_date ?? inv.created_at).toLocaleString("es-CO")}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-base tabular-nums">{COP.format(Number(inv.total || 0))}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                {inv.status}
              </p>
            </div>
          </div>

          {lastError && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
              <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide">
                Último error
              </p>
              <p className="text-xs text-red-700 mt-0.5 whitespace-pre-wrap break-words">
                {lastError}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {inv.pdf_url && (
              <a
                href={inv.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border hover:bg-muted"
              >
                <Download size={12} /> PDF
              </a>
            )}
            {inv.xml_url && (
              <a
                href={inv.xml_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border hover:bg-muted"
              >
                <Download size={12} /> XML
              </a>
            )}
            {inv.cufe && (
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(inv.cufe);
                  toast.success("CUFE copiado");
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border hover:bg-muted"
                title={inv.cufe}
              >
                <Copy size={12} /> CUFE
              </button>
            )}
            {canRetry && (
              <button
                onClick={() => retry.mutate()}
                disabled={retry.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 disabled:opacity-50"
              >
                {retry.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                Reintentar emisión
              </button>
            )}
          </div>
        </header>

        {/* Timeline einvoice_events */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Timeline DIAN ({events.length})
            </h2>
            <button
              onClick={() => eventsQ.refetch()}
              disabled={eventsQ.isRefetching}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Refrescar eventos"
            >
              <RefreshCw size={14} className={eventsQ.isRefetching ? "animate-spin" : ""} />
            </button>
          </div>

          {eventsQ.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Sin eventos registrados"
              description="Aún no hay eventos de la cola Innapsis para esta factura."
              compact
            />
          ) : (
            <ol className="relative border-l-2 border-border ml-3 space-y-3 pl-5">
              {events.map((ev: any) => {
                const v = eventVisual(ev.event_type);
                return (
                  <li key={ev.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[34px] top-0 w-7 h-7 rounded-full grid place-items-center border-2 border-background",
                        v.cls,
                      )}
                    >
                      <v.Icon size={13} />
                    </span>
                    <div className="bg-card border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground capitalize">
                          {ev.event_type.replace(/_/g, " ")}
                        </p>
                        <time className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {new Date(ev.created_at).toLocaleString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </time>
                      </div>
                      {ev.status && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                          estado: {ev.status}
                        </p>
                      )}
                      {ev.message && (
                        <p className="text-xs text-foreground/80 mt-1 whitespace-pre-wrap break-words">
                          {ev.message}
                        </p>
                      )}
                      {(ev.response || ev.payload) && (
                        <details className="mt-2 group">
                          <summary className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none">
                            Ver payload
                          </summary>
                          <pre className="mt-1.5 text-[10px] bg-muted/60 rounded-md p-2 overflow-x-auto max-h-48 leading-snug">
                            {JSON.stringify(ev.response ?? ev.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
};

export default InnapsisDetail;
