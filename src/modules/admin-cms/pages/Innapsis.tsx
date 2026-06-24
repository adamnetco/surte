import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  RefreshCw,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  ExternalLink,
  Copy,
  Loader2,
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

type Invoice = {
  id: string;
  full_number: string | null;
  prefix: string | null;
  number: number | null;
  customer_name: string | null;
  customer_identification: string | null;
  total: number;
  status: string;
  cufe: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  issue_date: string | null;
  created_at: string;
  document_type: string | null;
  last_error: string | null;
  retry_count: number | null;
  is_contingency: boolean | null;
};

const STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "accepted", label: "Aceptadas" },
  { key: "pending", label: "En curso" },
  { key: "retrying", label: "Reintentando" },
  { key: "error", label: "Con error" },
  { key: "dead_letter", label: "Dead letter" },
] as const;

const statusBadge = (status: string) => {
  const s = (status || "").toLowerCase();
  if (["accepted", "aceptada", "success", "approved"].includes(s))
    return { label: "Aceptada", Icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" };
  if (["pending", "queued", "processing"].includes(s))
    return { label: "En curso", Icon: Clock, cls: "bg-sky-500/10 text-sky-700 border-sky-500/30" };
  if (["retrying"].includes(s))
    return { label: "Reintentando", Icon: RefreshCw, cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" };
  if (["error", "rejected", "permanent"].includes(s))
    return { label: "Error", Icon: XCircle, cls: "bg-red-500/10 text-red-700 border-red-500/30" };
  if (["dead_letter"].includes(s))
    return { label: "Dead letter", Icon: AlertTriangle, cls: "bg-red-700/10 text-red-800 border-red-700/30" };
  if (["contingency"].includes(s))
    return { label: "Contingencia", Icon: AlertTriangle, cls: "bg-orange-500/10 text-orange-700 border-orange-500/30" };
  return { label: status || "—", Icon: Clock, cls: "bg-muted text-muted-foreground border-border" };
};

const Innapsis = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "innapsis", orgId, filter],
    enabled: !!orgId,
    refetchInterval: 30_000,
    queryFn: async () => {
      let query = supabase
        .from("electronic_invoices")
        .select(
          "id,full_number,prefix,number,customer_name,customer_identification,total,status,cufe,pdf_url,xml_url,issue_date,created_at,document_type,last_error,retry_count,is_contingency",
        )
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(200);

      if (filter !== "all") {
        if (filter === "error") query = query.in("status", ["error", "rejected", "permanent"]);
        else if (filter === "pending") query = query.in("status", ["pending", "queued", "processing"]);
        else if (filter === "accepted") query = query.in("status", ["accepted", "success", "approved"]);
        else query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter(
      (i) =>
        i.full_number?.toLowerCase().includes(needle) ||
        i.customer_name?.toLowerCase().includes(needle) ||
        i.customer_identification?.toLowerCase().includes(needle) ||
        i.cufe?.toLowerCase().includes(needle),
    );
  }, [data, q]);

  const counts = useMemo(() => {
    const c = { all: data?.length ?? 0, accepted: 0, pending: 0, retrying: 0, error: 0, dead_letter: 0 };
    for (const r of data ?? []) {
      const s = r.status?.toLowerCase();
      if (["accepted", "success", "approved"].includes(s)) c.accepted++;
      else if (["pending", "queued", "processing"].includes(s)) c.pending++;
      else if (s === "retrying") c.retrying++;
      else if (["error", "rejected", "permanent"].includes(s)) c.error++;
      else if (s === "dead_letter") c.dead_letter++;
    }
    return c;
  }, [data]);

  const retry = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const { error } = await supabase.functions.invoke("innapsis-emit", {
        body: { invoice_id: invoice.id, forced_retry: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reintento encolado");
      queryClient.invalidateQueries({ queryKey: ["admin", "innapsis", orgId] });
    },
    onError: (e: any) => toast.error(`No se pudo reintentar: ${e.message ?? e}`),
  });

  const copyCufe = async (cufe: string) => {
    await navigator.clipboard.writeText(cufe);
    toast.success("CUFE copiado");
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-12">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-xl text-foreground tracking-tight">
              Facturación electrónica DIAN
            </h1>
            <p className="text-xs text-muted-foreground">
              Listado de documentos emitidos vía Innapsis — {currentOrg?.name ?? "tu organización"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/superadmin/einvoice-bulk-retry")}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted"
            >
              <RefreshCw size={14} /> Bulk retry
            </button>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-9 w-9 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Actualizar"
            >
              <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* Búsqueda */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar por número, cliente, NIT o CUFE…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Filtros con contadores */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {STATUS_FILTERS.map((f) => {
            const count = counts[f.key as keyof typeof counts] ?? 0;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:border-foreground/30",
                )}
              >
                <Filter size={12} />
                {f.label}
                <span
                  className={cn(
                    "tabular-nums text-[10px] px-1.5 py-0.5 rounded-full",
                    active ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Listado */}
        {isError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
            <p className="text-sm font-semibold text-destructive">No pudimos cargar las facturas</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {(error as Error)?.message}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs font-semibold text-destructive hover:underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {isLoading && !isError && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            icon={FileText}
            title="Sin facturas para mostrar"
            description={q ? "Ajusta tu búsqueda o filtros." : "Aún no se han emitido documentos DIAN en este filtro."}
            compact
          />
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((inv) => {
              const badge = statusBadge(inv.status);
              const canRetry = ["error", "rejected", "permanent", "retrying", "dead_letter"].includes(
                inv.status?.toLowerCase(),
              );
              return (
                <article
                  key={inv.id}
                  className="bg-card border border-border rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground truncate">
                          {inv.full_number ?? `${inv.prefix ?? ""}${inv.number ?? "—"}`}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            badge.cls,
                          )}
                        >
                          <badge.Icon size={11} />
                          {badge.label}
                        </span>
                        {inv.is_contingency && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700 border border-orange-500/30">
                            Contingencia
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {inv.customer_name ?? "Consumidor final"}
                        {inv.customer_identification ? ` · ${inv.customer_identification}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                        {new Date(inv.issue_date ?? inv.created_at).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {(inv.retry_count ?? 0) > 0 && ` · ${inv.retry_count} reintento(s)`}
                      </p>
                    </div>
                    <p className="font-bold text-sm tabular-nums text-foreground shrink-0">
                      {COP.format(Number(inv.total || 0))}
                    </p>
                  </div>

                  {inv.last_error && (
                    <p className="text-[11px] text-red-700 bg-red-500/5 border border-red-500/20 rounded-md px-2 py-1 line-clamp-2">
                      {inv.last_error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
                        onClick={() => copyCufe(inv.cufe!)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border hover:bg-muted"
                        title={inv.cufe}
                      >
                        <Copy size={12} /> CUFE
                      </button>
                    )}
                    {canRetry && (
                      <button
                        onClick={() => retry.mutate(inv)}
                        disabled={retry.isPending && retry.variables?.id === inv.id}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        {retry.isPending && retry.variables?.id === inv.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        Reintentar
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/admin/innapsis/${inv.id}`)}
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      Detalle <ExternalLink size={11} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Innapsis;
