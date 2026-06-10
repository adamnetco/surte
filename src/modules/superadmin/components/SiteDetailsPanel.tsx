import { useEffect, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ExternalLink, Send, ShieldCheck, ShieldAlert, Shield,
  Globe, Loader2, CheckCircle2, AlertTriangle, Clock, Copy, RefreshCw,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DcvRecord {
  name?: string;
  type?: string;
  value?: string;
}

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
  }>;
  tenant_wp_config?: Array<{ wp_base_url?: string; wp_app_password?: string | null }>;
}

interface Props {
  site: Site;
  onSync: () => void;
  onTogglePublish: () => void;
  onConfigWp: () => void;
}

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

function StatusChip({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: string; tone: ChipTone }) {
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-normal py-1 px-2 ${TONE_CLASS[tone]}`}
      role="status"
      aria-label={`${label}: ${value}`}
    >
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
        last_checked_at: new Date().toISOString(),
      }));
      startedAt.current = Date.now();
      toast.success("Reaprovisionamiento solicitado. Cloudflare reemitirá el certificado.");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo reaprovisionar");
    } finally {
      setReprovisioning(false);
    }
  };

  const checkHttps = async () => {
    if (!local?.hostname) return;
    try {
      // no-cors: solo confirma conectividad TLS, no leemos el body
      await fetch(`https://${local.hostname}/?_hc=${Date.now()}`, { mode: "no-cors", cache: "no-store" });
      setHttpsOk("ok");
    } catch {
      setHttpsOk("fail");
    }
  };

  // Polling cada 15s mientras SSL no esté activo (máx 5 min para propagación rápida)
  useEffect(() => {
    if (!local?.hostname) return;
    const tone = sslTone(local.cf_ssl_status);
    if (tone === "ok") { checkHttps(); return; }
    if (tone === "idle") return;
    const id = setInterval(() => {
      if (Date.now() - startedAt.current > 5 * 60 * 1000) { clearInterval(id); return; }
      runVerify(true);
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.hostname, local?.cf_ssl_status]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const sslT = sslTone(local?.cf_ssl_status);
  const cfT = cfTone(local?.cf_status);
  const dcv = local?.cf_ownership_verification;

  return (
    <div className="space-y-4">
      {local?.hostname && (
        <section aria-labelledby={`prov-${site.id}`} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 id={`prov-${site.id}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aprovisionamiento
            </h4>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => runVerify(false)} disabled={verifying}
                className="h-7 px-2 text-xs" aria-label="Reverificar DNS y SSL">
                {verifying ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                Verificar
              </Button>
              <Button size="sm" variant="ghost" onClick={runReprovision}
                disabled={reprovisioning || sslT === "idle"} className="h-7 px-2 text-xs"
                aria-label="Forzar reaprovisionamiento SSL">
                {reprovisioning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Reprovisionar
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-live="polite">
            <StatusChip
              icon={cfT === "ok" ? CheckCircle2 : cfT === "error" ? AlertTriangle : Clock}
              label="DNS" value={local.cf_status ?? "—"} tone={cfT}
            />
            <StatusChip
              icon={sslT === "ok" ? Shield : sslT === "error" ? ShieldAlert : Clock}
              label="SSL" value={local.cf_ssl_status ?? "—"} tone={sslT}
            />
            <StatusChip
              icon={httpsOk === "ok" ? CheckCircle2 : httpsOk === "fail" ? AlertTriangle : Clock}
              label="HTTPS"
              value={httpsOk === "ok" ? "alcanzable" : httpsOk === "fail" ? "no responde" : "—"}
              tone={httpsOk === "ok" ? "ok" : httpsOk === "fail" ? "error" : "idle"}
            />
          </div>

          {dcv?.value && sslT !== "ok" && (
            <div className="mt-2 rounded-md border bg-background p-2 space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                  TXT de validación (DCV)
                </span>
                <button onClick={() => copy(dcv.value!, "Valor TXT")}
                  className="text-[10px] inline-flex items-center gap-1 hover:text-primary">
                  <Copy className="h-3 w-3" /> copiar valor
                </button>
              </div>
              <div className="grid grid-cols-[60px_1fr] gap-1 font-mono break-all">
                <span className="text-muted-foreground">name:</span><code>{dcv.name}</code>
                <span className="text-muted-foreground">type:</span><code>{(dcv.type ?? "txt").toUpperCase()}</code>
                <span className="text-muted-foreground">value:</span><code>{dcv.value}</code>
              </div>
            </div>
          )}

          {sslT === "pending" && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Emisión en curso. Verificando cada 15s (máx 5 min). Si no propaga, usa Reprovisionar.
            </p>
          )}
          {sslT === "error" && (
            <p className="mt-2 text-[11px] text-destructive">
              Falló el aprovisionamiento. Confirma que el TXT esté publicado y reintenta con Reprovisionar.
            </p>
          )}
          {httpsOk === "fail" && sslT === "ok" && (
            <p className="mt-2 text-[11px] text-destructive">
              SSL activo pero el host no responde por HTTPS. Revisa que A @/www apunten a 185.158.133.1.
            </p>
          )}
          {local.last_checked_at && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Última verificación: {rel(local.last_checked_at)}
            </p>
          )}
        </section>
      )}

      {/* Metadata */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Última actualización</dt>
        <dd className="font-medium" title={site.updated_at ?? ""}>{rel(site.updated_at)}</dd>

        <dt className="text-muted-foreground">Publicación</dt>
        <dd className="font-medium">{site.is_published ? "Publicado" : "Borrador"}</dd>

        <dt className="text-muted-foreground">Dominio</dt>
        <dd className="font-mono truncate" title={local?.hostname ?? ""}>{local?.hostname ?? "—"}</dd>

        <dt className="text-muted-foreground">WordPress</dt>
        <dd className="truncate">
          {wp?.wp_base_url ? new URL(wp.wp_base_url).hostname : "Sin configurar"}
        </dd>
      </dl>

      {/* Acciones */}
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

/**
 * Panel de detalles por card. En móvil se abre como Sheet lateral; en
 * desktop se expande in-place vía Collapsible para mantener la card compacta.
 */
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
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-between text-xs"
          aria-expanded={open}
          aria-label={`${open ? "Ocultar" : "Ver"} detalles de ${props.site.name}`}
        >
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
