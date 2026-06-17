import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2, AlertCircle, Clock, RefreshCw, Receipt, Key, ToggleRight,
  Store, ExternalLink, Activity, Globe, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import TenantLifecyclePanel from "./TenantLifecyclePanel";

type Check = {
  id: string;
  label: string;
  status: "ok" | "warn" | "pending";
  detail?: string;
  to?: string;
};

const StatusIcon = ({ s }: { s: Check["status"] }) =>
  s === "ok" ? <CheckCircle2 size={16} className="text-success" />
  : s === "warn" ? <AlertCircle size={16} className="text-destructive" />
  : <Clock size={16} className="text-muted-foreground" />;

export default function TenantHealth() {
  const { currentOrg } = useOrganization();
  const [checks, setChecks] = useState<Check[]>([]);
  const [stats, setStats] = useState<{ syncPending: number; syncFailed: number; orders24h: number }>({
    syncPending: 0, syncFailed: 0, orders24h: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const orgId = currentOrg.id;
      const base = `/superadmin/t/${currentOrg.slug}`;

      // Paralelo
      const [modulesRes, fiscalRes, licRes, syncRes, ordersRes, sitesRes, domainsRes] = await Promise.all([
        (supabase as any).from("organization_modules").select("module_key,enabled").eq("organization_id", orgId),
        (supabase as any).from("fiscal_settings").select("id").eq("organization_id", orgId).maybeSingle(),
        (supabase as any).from("organization_licenses").select("plan,expires_at,status").eq("organization_id", orgId).maybeSingle(),
        (supabase as any).from("sync_status").select("status").eq("organization_id", orgId),
        (supabase as any).from("pos_orders").select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
        (supabase as any).from("tenant_sites").select("id,is_published").eq("organization_id", orgId),
        (supabase as any).from("tenant_domains").select("id,verified_at,cf_ssl_status").eq("organization_id", orgId),
      ]);

      const modulesEnabled = (modulesRes.data ?? []).filter((m: any) => m.enabled).length;
      const fiscalOk = !!fiscalRes.data;
      const lic = licRes.data;
      const licOk = !!lic && lic.status === "active";
      const licExpiring = lic?.expires_at && (new Date(lic.expires_at).getTime() - Date.now() < 7 * 86400000);
      const syncRows = (syncRes.data ?? []) as any[];
      const pending = syncRows.filter((r) => r.status === "pending" || r.status === "running").length;
      const failed = syncRows.filter((r) => r.status === "error" || r.status === "failed").length;
      const sitesAll = (sitesRes.data ?? []) as any[];
      const sitesPublished = sitesAll.filter((s) => s.is_published).length;
      const domainsAll = (domainsRes.data ?? []) as any[];
      const domainsVerified = domainsAll.filter((d) => !!d.verified_at).length;
      const sslActive = domainsAll.filter((d) => d.cf_ssl_status === "active").length;

      if (cancelled) return;

      setStats({ syncPending: pending, syncFailed: failed, orders24h: ordersRes.count ?? 0 });
      setChecks([
        {
          id: "modules", label: "Módulos activos",
          status: modulesEnabled > 0 ? "ok" : "pending",
          detail: modulesEnabled > 0 ? `${modulesEnabled} habilitados` : "Sin módulos habilitados",
          to: `${base}/modulos`,
        },
        {
          id: "fiscal", label: "Configuración fiscal (DIAN)",
          status: fiscalOk ? "ok" : "pending",
          detail: fiscalOk ? "Resolución cargada" : "Falta resolución y RUT",
          to: `${base}/fiscal`,
        },
        {
          id: "license", label: "Licencia",
          status: licOk ? (licExpiring ? "warn" : "ok") : "pending",
          detail: lic ? `${lic.plan ?? "—"} · ${lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : "sin vencimiento"}` : "Sin licencia activa",
          to: `${base}/licencia`,
        },
        {
          id: "sync", label: "Sincronización",
          status: failed > 0 ? "warn" : pending > 0 ? "pending" : "ok",
          detail: failed > 0 ? `${failed} con error` : pending > 0 ? `${pending} en cola` : "Al día",
          to: `${base}/sync`,
        },
        {
          id: "sites", label: "Sitios web",
          status: sitesAll.length === 0 ? "pending" : sitesPublished > 0 ? "ok" : "warn",
          detail: sitesAll.length === 0
            ? "Sin sitios — crea el primero"
            : `${sitesPublished}/${sitesAll.length} publicados`,
          to: `${base}/sitios?tab=sites`,
        },
        {
          id: "domains", label: "Dominios y SSL",
          status: domainsAll.length === 0 ? "pending" : (domainsVerified === domainsAll.length && sslActive === domainsAll.length) ? "ok" : "warn",
          detail: domainsAll.length === 0
            ? "Sin dominios conectados"
            : `${domainsVerified}/${domainsAll.length} verificados · SSL ${sslActive}/${domainsAll.length} activo`,
          to: `${base}/sitios?tab=domains`,
        },
      ]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [currentOrg]);

  if (!currentOrg) return null;

  const completed = checks.filter((c) => c.status === "ok").length;
  const progress = checks.length ? Math.round((completed / checks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-5 rounded-xl border border-border bg-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Store size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tienda activa</p>
              <h2 className="font-heading font-bold text-lg truncate">{currentOrg.name}</h2>
              <p className="text-xs text-muted-foreground truncate">{currentOrg.slug}.sistecpos.com</p>
            </div>
          </div>
          <a
            href={`https://${currentOrg.slug}.sistecpos.com/admin`}
            target="_blank" rel="noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
          >
            Abrir admin del tenant <ExternalLink size={12} />
          </a>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Completitud de configuración</span>
            <span className="font-semibold">{completed}/{checks.length} · {progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Pedidos (24h)" value={stats.orders24h} icon={Activity} />
        <KPI label="Sync en cola" value={stats.syncPending} icon={Clock} tone={stats.syncPending ? "warn" : "ok"} />
        <KPI label="Sync con error" value={stats.syncFailed} icon={AlertCircle} tone={stats.syncFailed ? "bad" : "ok"} />
      </div>

      {/* Lifecycle */}
      <TenantLifecyclePanel />

      {/* Checklist */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        <div className="px-5 py-3 flex items-center justify-between">
          <h3 className="font-heading font-bold text-sm">Estado de la tienda</h3>
          {loading && <RefreshCw size={14} className="animate-spin text-muted-foreground" />}
        </div>
        {checks.map((c) => {
          const Row = (
            <div className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
              <StatusIcon s={c.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.label}</p>
                <p className="text-xs text-muted-foreground truncate">{c.detail}</p>
              </div>
              {c.to && <span className="text-xs text-primary">Configurar →</span>}
            </div>
          );
          return c.to ? <Link key={c.id} to={c.to}>{Row}</Link> : <div key={c.id}>{Row}</div>;
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLink to={`/superadmin/t/${currentOrg.slug}/modulos`} icon={ToggleRight} label="Módulos" />
        <QuickLink to={`/superadmin/t/${currentOrg.slug}/fiscal`} icon={Receipt} label="Fiscal" />
        <QuickLink to={`/superadmin/t/${currentOrg.slug}/sync`} icon={RefreshCw} label="Sincronización" />
        <QuickLink to={`/superadmin/t/${currentOrg.slug}/licencia`} icon={Key} label="Licencia" />
      </div>
    </div>
  );
}

const KPI = ({ label, value, icon: Icon, tone = "ok" as "ok" | "warn" | "bad" }) => (
  <div className="p-4 rounded-xl border border-border bg-card">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
      <Icon size={13} /> {label}
    </div>
    <p className={`font-heading font-bold text-2xl ${
      tone === "bad" ? "text-destructive" : tone === "warn" ? "text-accent" : "text-foreground"
    }`}>{value}</p>
  </div>
);

const QuickLink = ({ to, icon: Icon, label }: any) => (
  <Link to={to} className="p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors flex items-center gap-2 text-sm">
    <Icon size={15} className="text-primary" /> {label}
  </Link>
);
