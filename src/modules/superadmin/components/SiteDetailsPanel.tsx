import { useEffect, useMemo, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ExternalLink, Send, ShieldCheck, ShieldAlert, Shield,
  Globe, Loader2, CheckCircle2, AlertTriangle, Clock, Copy, RefreshCw, Download,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DcvRecord { name?: string; type?: string; value?: string; }
interface SslValidationRecord { txt_name?: string; txt_value?: string; http_url?: string; http_body?: string; status?: string; }

interface Site {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  updated_at?: string;
  tenant_domains?: Array<{
    hostname: string;
    is_primary?: boolean;
    cf_status?: string | null;
    cf_ssl_status?: string | null;
    verified_at?: string | null;
    last_checked_at?: string | null;
    cf_ownership_verification?: DcvRecord | null;
    cf_ssl_validation_records?: SslValidationRecord[] | null;
    dns_mode?: string | null;
    cname_target?: string | null;
  }>;
  tenant_wp_config?: Array<{ wp_base_url?: string; wp_app_password?: string | null }>;
}

interface Props {
  site: Site;
  onSync: () => void;
  onTogglePublish: () => void;
  onConfigWp: () => void;
}

const CF_EDGE_IP = "185.158.133.1";

function rel(ts?: string | null) {
  if (!ts) return "Nunca";
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

type ChipTone = "ok" | "pending" | "error" | "idle";
const TONE_CLASS: Record<ChipTone, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  idle: "bg-muted text-muted-foreground border-border",
};

function StatusChip({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: ChipTone }) {
  return (
    <Badge variant="outline" className={`gap-1.5 font-normal py-1 px-2 ${TONE_CLASS[tone]}`} role="status" aria-label={`${label}: ${value}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="font-medium">{value}</span>
    </Badge>
  );
}

function sslTone(s?: string | null): ChipTone {
  if (!s) return "idle";
  if (s === "active") return "ok";
  if (s === "pending_validation" || s === "pending_deployment" || s === "initializing") return "pending";
  return "error";
}
function cfTone(s?: string | null): ChipTone {
  if (!s) return "idle";
  if (s === "active") return "ok";
  if (s === "pending" || s === "pending_validation") return "pending";
  return "error";
}

type DnsRow = {
  key: string;
  type: "A" | "TXT";
  name: string;
  value: string;
  required: boolean;
  done: boolean;
  hint: string;
};

function buildDnsPlan(hostname: string, dcv: DcvRecord | null | undefined, acme: SslValidationRecord[] | null | undefined, cfStatus?: string | null, sslStatus?: string | null): DnsRow[] {
  const rows: DnsRow[] = [];
  rows.push({
    key: "a-root", type: "A", name: hostname, value: CF_EDGE_IP, required: true,
    done: cfStatus === "active" || sslStatus === "active",
    hint: "Apunta el subdominio al edge SaaS",
  });
  if (dcv?.name && dcv?.value) {
    rows.push({
      key: "txt-cf", type: "TXT", name: dcv.name, value: dcv.value, required: true,
      done: cfStatus === "active",
      hint: "Pre-validación de propiedad (Cloudflare SaaS)",
    });
  }
  (acme ?? []).forEach((r, i) => {
    if (r.txt_name && r.txt_value) {
      rows.push({
        key: `acme-${i}`, type: "TXT", name: r.txt_name, value: r.txt_value, required: true,
        done: r.status === "active" || sslStatus === "active",
        hint: "DCV ACME — libera la emisión del certificado SSL",
      });
    }
  });
  rows.push({
    key: "a-www", type: "A", name: `www.${hostname}`, value: CF_EDGE_IP, required: false,
    done: false,
    hint: "Opcional. Sólo si quieres servir también www.",
  });
  return rows;
}

function toCsv(rows: DnsRow[]): string {
  const head = "Tipo,Nombre,Valor,TTL,Obligatorio";
  const body = rows.map(r => [r.type, r.name, `"${r.value}"`, "Auto", r.required ? "sí" : "no"].join(","));
  return [head, ...body].join("\n");
}
function toBindZone(rows: DnsRow[]): string {
  const lines = rows.map(r => {
    if (r.type === "A") return `${r.name}.\t300\tIN\tA\t${r.value}`;
    return `${r.name}.\t300\tIN\tTXT\t"${r.value.replace(/"/g, '\\"')}"`;
  });
  return ["; Zona generada por SistecPOS Core", ...lines, ""].join("\n");
}
function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DnsChecklist({ rows, onCopyAll, onExportCsv, onExportBind }: {
  rows: DnsRow[]; onCopyAll: () => void; onExportCsv: () => void; onExportBind: () => void;
}) {
  const pending = rows.filter(r => r.required && !r.done).length;
  const total = rows.filter(r => r.required).length;
  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copiado`); };

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Registros DNS · {total - pending}/{total} listos
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCopyAll} aria-label="Copiar todos los registros como tabla">
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar todo
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onExportCsv} aria-label="Descargar registros en CSV">
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onExportBind} aria-label="Descargar zona BIND">
            <Download className="h-3.5 w-3.5 mr-1" /> .zone
          </Button>
        </div>
      </div>
      <ul role="list" className="divide-y">
        {rows.map((r) => (
          <li key={r.key} className="px-3 py-2 text-[11px] flex items-start gap-2">
            <div className="pt-0.5" aria-hidden>
              {r.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : r.required ? <Clock className="h-4 w-4 text-amber-600" />
                : <span className="block h-4 w-4 rounded-full border border-dashed border-muted-foreground/40" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{r.type}</span>
                <code className="font-mono break-all">{r.name}</code>
                {!r.required && <Badge variant="outline" className="text-[9px] py-0 px-1">opcional</Badge>}
                {r.done && <Badge variant="outline" className="text-[9px] py-0 px-1 bg-emerald-500/10 text-emerald-700 border-emerald-500/30">detectado</Badge>}
              </div>
              <div className="font-mono text-muted-foreground break-all mt-0.5">→ {r.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{r.hint}</div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => copy(r.name, "Nombre")} className="text-[10px] inline-flex items-center gap-1 hover:text-primary" aria-label={`Copiar nombre ${r.name}`}>
                <Copy className="h-3 w-3" /> name
              </button>
              <button onClick={() => copy(r.value, "Valor")} className="text-[10px] inline-flex items-center gap-1 hover:text-primary" aria-label={`Copiar valor de ${r.name}`}>
                <Copy className="h-3 w-3" /> value
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailsBody({ site, onSync, onTogglePublish, onConfigWp }: Props) {
  const primary = site.tenant_domains?.find((d) => d.is_primary) ?? site.tenant_domains?.[0];
  const wp = site.tenant_wp_config?.[0];
  const [verifying, setVerifying] = useState(false);
  const [reprovisioning, setReprovisioning] = useState(false);
  const [httpsOk, setHttpsOk] = useState<"unknown" | "ok" | "fail">("unknown");
  const [local, setLocal] = useState(primary);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => { setLocal(primary); }, [primary?.hostname, primary?.cf_ssl_status, primary?.cf_status]);

  const runVerify = async (silent = false) => {
    if (!local?.hostname) return;
    if (!silent) setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-domain-status", {
        body: { hostname: local.hostname },
      });
      if (error) throw error;
      setLocal((prev) => prev && ({
        ...prev,
        cf_status: data?.status ?? prev.cf_status,
        cf_ssl_status: data?.ssl_status ?? prev.cf_ssl_status,
        cf_ownership_verification: data?.result?.ownership_verification ?? prev.cf_ownership_verification,
        cf_ssl_validation_records: data?.ssl_validation_records ?? data?.result?.ssl?.validation_records ?? prev.cf_ssl_validation_records,
        last_checked_at: new Date().toISOString(),
        verified_at: data?.status === "active" ? new Date().toISOString() : prev.verified_at,
      }));
      if (!silent) toast.success(`Estado: ${data?.status ?? "—"} · SSL: ${data?.ssl_status ?? "—"}`);
    } catch (e: any) {
      if (!silent) toast.error(e.message ?? "No se pudo verificar");
    } finally {
      if (!silent) setVerifying(false);
    }
  };

  const runReprovision = async () => {
    if (!local?.hostname) return;
    if (!window.confirm(`Forzar reaprovisionamiento SSL para ${local.hostname}?`)) return;
    setReprovisioning(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-domain-reprovision", {
        body: { hostname: local.hostname },
      });
      if (error) throw error;
      setLocal((prev) => prev && ({
        ...prev,
        cf_status: data?.status ?? prev.cf_status,
        cf_ssl_status: data?.ssl_status ?? "initializing",
        cf_ownership_verification: data?.ownership_verification ?? prev.cf_ownership_verification,
        cf_ssl_validation_records: data?.ssl_validation_records ?? prev.cf_ssl_validation_records,
        last_checked_at: new Date().toISOString(),
      }));
      startedAt.current = Date.now();
      toast.success("Reaprovisionamiento solicitado. Publica los TXT _acme-challenge y espera 2–10 min.");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo reaprovisionar");
    } finally {
      setReprovisioning(false);
    }
  };

  const checkHttps = async () => {
    if (!local?.hostname) return;
    try {
      await fetch(`https://${local.hostname}/?_hc=${Date.now()}`, { mode: "no-cors", cache: "no-store" });
      setHttpsOk("ok");
    } catch {
      setHttpsOk("fail");
    }
  };

  // Polling extendido a 30 min con backoff (15s → 60s tras 5 min)
  useEffect(() => {
    if (!local?.hostname) return;
    const tone = sslTone(local.cf_ssl_status);
    if (tone === "ok") { checkHttps(); return; }
    if (tone === "idle") return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt.current;
      if (elapsed > 30 * 60 * 1000) return;
      await runVerify(true);
      const next = elapsed > 5 * 60 * 1000 ? 60_000 : 15_000;
      if (!cancelled) setTimeout(tick, next);
    };
    const id = setTimeout(tick, 15_000);
    return () => { cancelled = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.hostname, local?.cf_ssl_status]);

  const sslT = sslTone(local?.cf_ssl_status);
  const cfT = cfTone(local?.cf_status);

  const dnsRows = useMemo(
    () => local?.hostname ? buildDnsPlan(local.hostname, local.cf_ownership_verification, local.cf_ssl_validation_records, local.cf_status, local.cf_ssl_status) : [],
    [local?.hostname, local?.cf_status, local?.cf_ssl_status, local?.cf_ownership_verification, local?.cf_ssl_validation_records],
  );
  const pendingCount = dnsRows.filter(r => r.required && !r.done).length;

  const copyAll = () => {
    const txt = dnsRows.map(r => `${r.type}\t${r.name}\t${r.value}`).join("\n");
    navigator.clipboard.writeText(txt);
    toast.success(`${dnsRows.length} registros copiados (TSV)`);
  };
  const exportCsv = () => download(`dns-${local?.hostname}.csv`, toCsv(dnsRows), "text/csv");
  const exportBind = () => download(`${local?.hostname}.zone`, toBindZone(dnsRows), "text/plain");

  return (
    <div className="space-y-4">
      {local?.hostname && (
        <section aria-labelledby={`prov-${site.id}`} className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 id={`prov-${site.id}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aprovisionamiento
            </h4>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => runVerify(false)} disabled={verifying} className="h-7 px-2 text-xs" aria-label="Reverificar DNS y SSL">
                {verifying ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                Verificar
              </Button>
              <Button size="sm" variant="ghost" onClick={runReprovision} disabled={reprovisioning} className="h-7 px-2 text-xs" aria-label="Forzar reaprovisionamiento SSL">
                {reprovisioning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Reprovisionar
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" aria-live="polite">
            <StatusChip icon={cfT === "ok" ? CheckCircle2 : cfT === "error" ? AlertTriangle : Clock} label="DNS" value={local.cf_status ?? "—"} tone={cfT} />
            <StatusChip icon={sslT === "ok" ? Shield : sslT === "error" ? ShieldAlert : Clock} label="SSL" value={local.cf_ssl_status ?? "—"} tone={sslT} />
            <StatusChip
              icon={httpsOk === "ok" ? CheckCircle2 : httpsOk === "fail" ? AlertTriangle : Clock}
              label="HTTPS"
              value={httpsOk === "ok" ? "alcanzable" : httpsOk === "fail" ? "no responde" : "—"}
              tone={httpsOk === "ok" ? "ok" : httpsOk === "fail" ? "error" : "idle"}
            />
          </div>

          <DnsChecklist rows={dnsRows} onCopyAll={copyAll} onExportCsv={exportCsv} onExportBind={exportBind} />

          {pendingCount > 0 && sslT !== "ok" && (!local.cf_ssl_validation_records || local.cf_ssl_validation_records.length === 0) && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
              Faltan los TXT <code className="font-mono">_acme-challenge</code>. Pulsa <strong>Reprovisionar</strong> para que Cloudflare los genere y aparezcan arriba.
            </div>
          )}
          {sslT === "pending" && (
            <p className="text-[11px] text-muted-foreground">
              Emisión en curso. Verificando cada 15–60s (máx 30 min). Si no propaga, usa Reprovisionar.
            </p>
          )}
          {sslT === "error" && (
            <p className="text-[11px] text-destructive">
              Falló el aprovisionamiento. Confirma que los TXT estén publicados y reintenta con Reprovisionar.
            </p>
          )}
          {httpsOk === "fail" && sslT === "ok" && (
            <p className="text-[11px] text-destructive">
              SSL activo pero el host no responde por HTTPS. Revisa que el A apunte a {CF_EDGE_IP}.
            </p>
          )}
          {local.last_checked_at && (
            <p className="text-[10px] text-muted-foreground">Última verificación: {rel(local.last_checked_at)}</p>
          )}
        </section>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Última actualización</dt>
        <dd className="font-medium" title={site.updated_at ?? ""}>{rel(site.updated_at)}</dd>
        <dt className="text-muted-foreground">Publicación</dt>
        <dd className="font-medium">{site.is_published ? "Publicado" : "Borrador"}</dd>
        <dt className="text-muted-foreground">Dominio</dt>
        <dd className="font-mono truncate" title={local?.hostname ?? ""}>{local?.hostname ?? "—"}</dd>
        <dt className="text-muted-foreground">WordPress</dt>
        <dd className="truncate">{wp?.wp_base_url ? new URL(wp.wp_base_url).hostname : "Sin configurar"}</dd>
      </dl>

      <div className="flex flex-wrap gap-2 pt-1 border-t">
        <Button size="sm" variant="outline" onClick={onSync} disabled={!wp?.wp_app_password} aria-label="Sincronizar productos con WordPress">
          <Send className="h-3.5 w-3.5 mr-1" aria-hidden /> Sincronizar
        </Button>
        <Button size="sm" variant="outline" onClick={onTogglePublish} aria-label={site.is_published ? "Despublicar sitio" : "Publicar sitio"}>
          <Globe className="h-3.5 w-3.5 mr-1" aria-hidden /> {site.is_published ? "Despublicar" : "Publicar"}
        </Button>
        <Button size="sm" variant="outline" onClick={onConfigWp} aria-label="Configurar WordPress">
          Configurar WP
        </Button>
        {local?.hostname && (
          <Button size="sm" variant="ghost" asChild>
            <a href={`https://${local.hostname}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${local.hostname} en nueva pestaña`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden /> Abrir
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SiteDetailsPanel(props: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm" variant="ghost" className="w-full justify-between" aria-label={`Ver detalles de ${props.site.name}`}>
            Detalles <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85dvh] overflow-y-auto">
          <SheetHeader><SheetTitle>{props.site.name}</SheetTitle></SheetHeader>
          <div className="mt-4"><DetailsBody {...props} /></div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button size="sm" variant="ghost" className="w-full justify-between text-xs" aria-expanded={open} aria-label={`${open ? "Ocultar" : "Ver"} detalles de ${props.site.name}`}>
          {open ? "Ocultar detalles" : "Ver detalles"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 border-t mt-2">
        <DetailsBody {...props} />
      </CollapsibleContent>
    </Collapsible>
  );
}
