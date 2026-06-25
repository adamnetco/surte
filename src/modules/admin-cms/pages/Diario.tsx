import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Tag,
  ChevronRight,
  Sun,
  Moon,
  Sunrise,
  Sparkles,
  AlertCircle,
  FileCheck2,
  StickyNote,
  Check,
  Zap,
  Share2,
  Keyboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useDailyChecklist } from "@/modules/admin-cms/hooks/useDailyChecklist";
import SyncStatusPanel from "@/modules/admin-cms/components/SyncStatusPanel";
import DiarioBulkSheet, { type BulkKind } from "@/modules/admin-cms/components/DiarioBulkSheet";
import DiarioShareDialog from "@/modules/admin-cms/components/DiarioShareDialog";
import { getTopHotkeys } from "@/components/GlobalHotkeys";
import {
  CHECKLIST_TEMPLATES,
  templateForRole,
  getTemplateByKey,
} from "@/modules/admin-cms/lib/checklistTemplates";

/**
 * Daily Driver — pantalla mobile-first del flujo diario del admin.
 * - KPIs con refresco automático (60s) + manual + manejo de errores.
 * - Acciones ordenadas por severidad (danger → warn) según datos reales.
 * - Checklist persistido en Supabase, reinicio automático al cambiar de día.
 */


const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return { txt: "Buenas noches", Icon: Moon };
  if (h < 12) return { txt: "Buenos días", Icon: Sunrise };
  if (h < 19) return { txt: "Buenas tardes", Icon: Sun };
  return { txt: "Buenas noches", Icon: Moon };
};

function useDailySnapshot(orgId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "diario", orgId],
    enabled: !!orgId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const since = startOfTodayISO();
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [ordersToday, pending, lowStock, syncErrors, einvoiceErrors] = await Promise.all([
        supabase
          .from("orders")
          .select("id,total,status,created_at")
          .eq("organization_id", orgId!)
          .gte("created_at", since),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .eq("status", "pendiente"),
        supabase
          .from("products")
          .select("id,name,stock", { count: "exact" })
          .eq("organization_id", orgId!)
          .lte("stock", 5)
          .order("stock", { ascending: true })
          .limit(5),
        supabase
          .from("sync_logs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .eq("status", "error")
          .gte("last_run_at", since24h),
        supabase
          .from("electronic_invoices")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId!)
          .in("status", ["error", "dead_letter", "rejected"])
          .gte("created_at", since24h),
      ]);

      // Propagar el primer error real para que React Query maneje retries/UI
      const firstErr =
        ordersToday.error || pending.error || lowStock.error || syncErrors.error || einvoiceErrors.error;
      if (firstErr) throw firstErr;

      const todays = ordersToday.data ?? [];
      const revenue = todays.reduce((s, o: any) => s + Number(o.total || 0), 0);

      return {
        ordersToday: todays.length,
        revenueToday: revenue,
        pendingCount: pending.count ?? 0,
        lowStockCount: lowStock.count ?? 0,
        lowStockSample: (lowStock.data ?? []) as Array<{ id: string; name: string; stock: number }>,
        syncErrors: syncErrors.count ?? 0,
        einvoiceErrors: einvoiceErrors.count ?? 0,
      };
    },
  });
}


type Severity = "ok" | "info" | "warn" | "danger";

const SEV_STYLES: Record<Severity, { dot: string; text: string; bar: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700", bar: "bg-emerald-500/10" },
  info: { dot: "bg-sky-500", text: "text-sky-700", bar: "bg-sky-500/10" },
  warn: { dot: "bg-amber-500", text: "text-amber-700", bar: "bg-amber-500/10" },
  danger: { dot: "bg-red-500", text: "text-red-700", bar: "bg-red-500/10" },
};

function ActionCard({
  icon: Icon,
  title,
  description,
  badge,
  severity = "info",
  onClick,
  bulkLabel,
  onBulk,
}: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  badge?: string;
  severity?: Severity;
  onClick: () => void;
  bulkLabel?: string;
  onBulk?: () => void;
}) {
  const sev = SEV_STYLES[severity];
  return (
    <div
      className={cn(
        "w-full bg-card border border-border rounded-xl p-4",
        "min-h-[72px] flex items-center gap-3 transition",
        "hover:border-foreground/20",
      )}
    >
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99]">
        <div className={cn("w-11 h-11 rounded-lg grid place-items-center shrink-0", sev.bar)}>
          <Icon className={sev.text} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-foreground truncate">{title}</h3>
            {badge && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white", sev.dot)}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        </div>
      </button>
      {onBulk ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBulk();
          }}
          className={cn(
            "shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition",
            "border-foreground/20 text-foreground hover:bg-foreground hover:text-background",
          )}
          aria-label={bulkLabel ?? "Resolver"}
        >
          <Zap size={12} />
          {bulkLabel ?? "Resolver"}
        </button>
      ) : (
        <ChevronRight className="text-muted-foreground shrink-0" size={18} onClick={onClick} />
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-7 w-24 mt-1" />
      ) : (
        <p className="text-2xl font-heading font-bold text-foreground mt-0.5 tabular-nums">{value}</p>
      )}
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

const TEMPLATE_LS_KEY = "sistecpos:diario:tplKey";


type ActionEntry = {
  key: string;
  icon: any;
  title: string;
  description: string;
  badge: string;
  severity: Severity;
  onClick: () => void;
  weight: number;
  bulkKind?: BulkKind;
};

function ChecklistRow({
  item_key,
  label,
  checked,
  notes,
  onToggle,
  onSaveNotes,
}: {
  item_key: string;
  label: string;
  checked: boolean;
  notes: string;
  onToggle: () => void;
  onSaveNotes: (v: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Sync external changes when not editing (avoid clobbering typing)
  useEffect(() => {
    if (!editing) setDraft(notes);
  }, [notes, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (next !== (notes ?? "").trim()) {
      setSaving(true);
      try {
        await onSaveNotes(next);
        setSavedAt(Date.now());
      } finally {
        setSaving(false);
      }
    }
    setEditing(false);
  };

  return (
    <div className="p-2.5">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          aria-pressed={checked}
          aria-label={`Marcar ${label}`}
          className="shrink-0"
        >
          <span
            className={cn(
              "w-5 h-5 rounded-md border-2 grid place-items-center transition",
              checked
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-border bg-background",
            )}
          >
            {checked && (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </span>
        </button>
        <button
          onClick={onToggle}
          className={cn(
            "text-sm flex-1 text-left min-h-[32px]",
            checked ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {label}
        </button>
        <button
          onClick={() => setEditing((v) => !v)}
          aria-label={`Notas de ${label}`}
          className={cn(
            "shrink-0 h-7 w-7 rounded-md grid place-items-center text-xs transition",
            notes
              ? "bg-amber-500/10 text-amber-700"
              : "text-muted-foreground hover:bg-muted",
          )}
          title={notes || "Agregar nota"}
        >
          <StickyNote size={14} />
        </button>
      </div>

      {!editing && notes && (
        <p
          onClick={() => setEditing(true)}
          className="ml-8 mt-1 text-[11px] text-muted-foreground italic cursor-text whitespace-pre-wrap break-words"
        >
          {notes}
        </p>
      )}

      {editing && (
        <div className="ml-8 mt-1.5 space-y-1">
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft(notes);
                setEditing(false);
              }
            }}
            rows={2}
            placeholder="Agrega una nota (Cmd/Ctrl+Enter para guardar)…"
            className="w-full text-xs bg-background border border-border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            maxLength={500}
            id={`notes-${item_key}`}
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{draft.length}/500</span>
            <span className="flex items-center gap-1">
              {saving && <RefreshCw size={10} className="animate-spin" />}
              {!saving && savedAt && Date.now() - savedAt < 3000 && (
                <>
                  <Check size={10} className="text-emerald-600" /> guardado
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
const Diario = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { data, isLoading, refetch, isRefetching, error, isError } = useDailySnapshot(
    currentOrg?.id,
  );

  const { txt: hello, Icon: HelloIcon } = useMemo(greeting, []);
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    ?? user?.email?.split("@")[0];

  // Plantilla de checklist según rol, con override manual persistido
  const suggested = useMemo(() => templateForRole(currentOrg?.role), [currentOrg?.role]);
  const [templateKey, setTemplateKey] = useState<string>(() => {
    if (typeof window === "undefined") return suggested.key;
    return localStorage.getItem(TEMPLATE_LS_KEY) ?? suggested.key;
  });
  // Si cambia el rol sugerido y el usuario no ha override-eado, sigue al sugerido
  useEffect(() => {
    if (!localStorage.getItem(TEMPLATE_LS_KEY)) setTemplateKey(suggested.key);
  }, [suggested.key]);
  const activeTemplate = getTemplateByKey(templateKey) ?? suggested;
  const onPickTemplate = (k: string) => {
    setTemplateKey(k);
    localStorage.setItem(TEMPLATE_LS_KEY, k);
  };

  const { items: checkItems, toggle, setNotes, doneCount, loading: checklistLoading } =
    useDailyChecklist(activeTemplate.items);


  const hasData = !!data;
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");

  // Acciones ordenadas por severidad (danger primero, luego warn) con datos reales
  const actions = useMemo<ActionEntry[]>(() => {
    if (!data) return [];
    const list: ActionEntry[] = [];

    if (data.einvoiceErrors > 0) {
      list.push({
        key: "einvoice",
        icon: FileCheck2,
        title: "Errores de facturación electrónica",
        description: `${data.einvoiceErrors} factura(s) DIAN en error en 24h`,
        badge: String(data.einvoiceErrors),
        severity: "danger",
        onClick: () => navigate("/admin/innapsis"),
        weight: 4 * data.einvoiceErrors,
        bulkKind: "einvoice",
      });
    }
    if (data.syncErrors > 0) {
      list.push({
        key: "sync",
        icon: RefreshCw,
        title: "Resolver errores de sincronización",
        description: `${data.syncErrors} error(es) en las últimas 24h`,
        badge: String(data.syncErrors),
        severity: "danger",
        onClick: () => navigate("/admin/health-logs"),
        weight: 3 * data.syncErrors,
      });
    }
    if (data.lowStockCount > 0) {
      list.push({
        key: "stock",
        icon: AlertTriangle,
        title: "Reabastecer stock bajo",
        description: data.lowStockSample[0]
          ? `${data.lowStockSample[0].name} (${data.lowStockSample[0].stock}) y ${Math.max(0, data.lowStockCount - 1)} más`
          : `${data.lowStockCount} productos en mínimo`,
        badge: String(data.lowStockCount),
        severity: data.lowStockCount > 10 ? "danger" : "warn",
        onClick: () => navigate("/admin?tab=products&filter=low-stock"),
        weight: (data.lowStockCount > 10 ? 3 : 2) * data.lowStockCount,
      });
    }
    if (data.pendingCount > 0) {
      list.push({
        key: "pending",
        icon: ShoppingCart,
        title: "Despachar pedidos pendientes",
        description: `${data.pendingCount} pedido(s) esperando confirmación`,
        badge: String(data.pendingCount),
        severity: "warn",
        onClick: () => navigate("/admin?tab=orders"),
        weight: 2 * data.pendingCount,
        bulkKind: "pending",
      });
    }

    const sevOrder: Record<Severity, number> = { danger: 0, warn: 1, info: 2, ok: 3 };
    return list.sort(
      (a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.weight - a.weight,
    );
  }, [data, navigate]);

  const counts = useMemo(
    () => ({
      danger: actions.filter((a) => a.severity === "danger").length,
      warn: actions.filter((a) => a.severity === "warn").length,
      info: actions.filter((a) => a.severity === "info").length,
    }),
    [actions],
  );
  const visibleActions = useMemo(
    () => (sevFilter === "all" ? actions : actions.filter((a) => a.severity === sevFilter)),
    [actions, sevFilter],
  );
  const totalAlerts = actions.length;
  const noActionsNeeded = hasData && totalAlerts === 0;

  const [bulkKind, setBulkKind] = useState<BulkKind | null>(null);
  const bulkOpen = bulkKind !== null;
  const [shareOpen, setShareOpen] = useState(false);


  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <AdminHeader />

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Saludo */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <HelloIcon size={14} />
              <span>{hello}{firstName ? `, ${firstName}` : ""}</span>
            </div>
            <h1 className="font-heading font-bold text-xl text-foreground tracking-tight">
              Tu día en {currentOrg?.name ?? "la tienda"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShareOpen(true)}
              disabled={!hasData}
              className="h-9 px-3 rounded-lg border border-border flex items-center gap-1.5 text-xs font-semibold text-foreground hover:bg-foreground hover:text-background disabled:opacity-50 transition"
              aria-label="Compartir resumen del día"
            >
              <Share2 size={14} />
              <span className="hidden xs:inline sm:inline">Compartir</span>
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

        {/* KPIs del día */}
        <section className="grid grid-cols-2 gap-3">
          <StatTile
            label="Ventas hoy"
            value={hasData ? COP.format(data.revenueToday) : "—"}
            hint={hasData ? `${data.ordersToday} pedido${data.ordersToday === 1 ? "" : "s"}` : undefined}
            loading={isLoading}
          />
          <StatTile
            label="Pendientes"
            value={hasData ? String(data.pendingCount) : "—"}
            hint={hasData && data.pendingCount > 0 ? "requieren acción" : "todo despachado"}
            loading={isLoading}
          />
        </section>

        {/* Panel resumen — métricas accionables */}
        {hasData && (
          <section className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSevFilter("danger")}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                sevFilter === "danger" ? "border-red-500 bg-red-500/5" : "border-border bg-card hover:border-foreground/20",
              )}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Errores</p>
              <p className="text-xl font-heading font-bold text-red-700 tabular-nums">
                {data.einvoiceErrors + data.syncErrors}
              </p>
              <p className="text-[10px] text-muted-foreground">DIAN + sync 24h</p>
            </button>
            <button
              onClick={() => setSevFilter("warn")}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                sevFilter === "warn" ? "border-amber-500 bg-amber-500/5" : "border-border bg-card hover:border-foreground/20",
              )}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Bajo stock</p>
              <p className="text-xl font-heading font-bold text-amber-700 tabular-nums">{data.lowStockCount}</p>
              <p className="text-[10px] text-muted-foreground">≤ 5 unidades</p>
            </button>
            <button
              onClick={() => setSevFilter("all")}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                sevFilter === "all" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/20",
              )}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total</p>
              <p className="text-xl font-heading font-bold text-foreground tabular-nums">{totalAlerts}</p>
              <p className="text-[10px] text-muted-foreground">acciones</p>
            </button>
          </section>
        )}

        {/* Estado de sincronización (colas con backoff) */}
        <SyncStatusPanel />



        {/* Acciones del día */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Acciones de hoy
            </h2>
            {hasData && totalAlerts > 0 && (
              <div className="flex items-center gap-1">
                {(["all", "danger", "warn", "info"] as const).map((s) => {
                  const label = s === "all" ? "Todo" : s === "danger" ? "Crítico" : s === "warn" ? "Alerta" : "Info";
                  const c = s === "all" ? totalAlerts : counts[s];
                  if (s !== "all" && c === 0) return null;
                  return (
                    <button
                      key={s}
                      onClick={() => setSevFilter(s)}
                      className={cn(
                        "text-[10px] font-semibold px-2 py-1 rounded-full border tabular-nums",
                        sevFilter === s
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      {label} {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="text-destructive shrink-0 mt-0.5" size={18} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  No pudimos cargar los datos del día
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {(error as Error)?.message ?? "Error desconocido"}
                </p>
                <button
                  onClick={() => refetch()}
                  className="mt-2 text-xs font-semibold text-destructive hover:underline"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {isLoading && !isError && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
          )}

          {hasData && noActionsNeeded && (
            <EmptyState
              icon={Sparkles}
              title="Todo al día"
              description="No hay pedidos pendientes, stock crítico ni errores. Buen trabajo."
              compact
            />
          )}

          {hasData && !noActionsNeeded && (
            <div className="space-y-2">
              {visibleActions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">
                  Sin acciones en este filtro.
                </p>
              ) : (
                visibleActions.map((a) => (
                  <ActionCard
                    key={a.key}
                    icon={a.icon}
                    title={a.title}
                    description={a.description}
                    badge={a.badge}
                    severity={a.severity}
                    onClick={a.onClick}
                    bulkLabel={a.bulkKind === "einvoice" ? "Reintentar" : a.bulkKind === "pending" ? "Confirmar" : undefined}
                    onBulk={a.bulkKind ? () => setBulkKind(a.bulkKind!) : undefined}
                  />
                ))
              )}
            </div>
          )}
        </section>

        {/* Atajos diarios */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Atajos
          </h2>
          <div className="space-y-2">
            <ActionCard
              icon={TrendingUp}
              title="Ir al POS"
              description="Empieza a vender ya"
              severity="ok"
              onClick={() => navigate("/pos/vender")}
            />
            <ActionCard
              icon={Wallet}
              title="Caja y cierre del día"
              description="Aperturas, cierres y cuadre"
              severity="info"
              onClick={() => navigate("/admin?tab=overview")}
            />
            <ActionCard
              icon={Tag}
              title="Actualizar precios"
              description="Cambios masivos por categoría o marca"
              severity="info"
              onClick={() => navigate("/admin?tab=products")}
            />
            <ActionCard
              icon={FileCheck2}
              title="Facturación DIAN (Innapsis)"
              description="Listado, reintentos y descargas"
              severity="info"
              onClick={() => navigate("/admin/innapsis")}
            />
          </div>
        </section>

        {/* Checklist diaria — plantilla por rol, persistido en Supabase */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Checklist del día
            </h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {doneCount}/{activeTemplate.items.length}
            </span>
          </div>

          {/* Selector de plantilla por rol */}
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {CHECKLIST_TEMPLATES.map((t) => {
              const isActive = t.key === activeTemplate.key;
              const isSuggested = t.key === suggested.key;
              return (
                <button
                  key={t.key}
                  onClick={() => onPickTemplate(t.key)}
                  className={cn(
                    "shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition flex items-center gap-1",
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:text-foreground",
                  )}
                  title={t.description}
                >
                  {t.label}
                  {isSuggested && (
                    <span
                      className={cn(
                        "text-[9px] uppercase font-bold tracking-wide px-1 rounded",
                        isActive ? "bg-background/20" : "bg-emerald-500/15 text-emerald-700",
                      )}
                    >
                      Tu rol
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">
            {activeTemplate.description}
          </p>

          <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
            {checklistLoading
              ? activeTemplate.items.map((c) => (
                  <Skeleton key={c.item_key} className="h-[52px] w-full rounded-none" />
                ))
              : activeTemplate.items.map((c) => (
                  <ChecklistRow
                    key={c.item_key}
                    item_key={c.item_key}
                    label={c.label}
                    checked={!!checkItems[c.item_key]?.done}
                    notes={checkItems[c.item_key]?.notes ?? ""}
                    onToggle={() => toggle(c.item_key)}
                    onSaveNotes={(v) => setNotes(c.item_key, v)}
                  />
                ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tu progreso se guarda en la nube y se reinicia cada día. Cada plantilla mantiene su propio avance.
          </p>
        </section>

        <HotkeyFooterHint />
      </main>

      <DiarioBulkSheet
        open={bulkOpen}
        onOpenChange={(o) => !o && setBulkKind(null)}
        kind={bulkKind}
        organizationId={currentOrg?.id}
        onAfterAction={() => refetch()}
      />

      <DiarioShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        data={data ?? null}
        orgName={currentOrg?.name ?? "Mi negocio"}
        userName={firstName}
        checklistDone={doneCount}
        checklistTotal={activeTemplate.items.length}
      />
    </div>

  );
};

export default Diario;
