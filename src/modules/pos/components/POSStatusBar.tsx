import { useEffect, useRef, useState, useMemo } from "react";
import { Printer, Wifi, WifiOff, Globe, Wallet, CircleDot, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { pingAgent } from "@/modules/printing/drivers/agent";
import { cn } from "@/lib/utils";
import { useHealthSnapshot, type HealthStatus } from "@/modules/pos/hooks/useHealthSnapshot";
import { StatusPill } from "@/modules/pos/components/StatusPill";
import { useStatusTimeline } from "@/modules/pos/hooks/useStatusTimeline";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Props {
  organizationId: string;
  session?: { opening_amount: number; opened_at: string } | null;
  className?: string;
}

/**
 * POS status bar — 4 indicators (printer · core · web · session). All polling
 * for core/sites/wp is collapsed into a single edge function (`health-snapshot`)
 * to reduce DB hits. Printer is local-only (agent ping) and uses a small
 * consecutive-failure counter to avoid toast spam.
 *
 * Accessibility: container exposes `role="status"` and `aria-live="polite"`;
 * each pill is a real `<button>` with `aria-label`, focus ring, and Popover
 * with retry + resolution actions.
 */
export default function POSStatusBar({ organizationId, session, className }: Props) {
  const qc = useQueryClient();
  const { data: health, refetch, isError, error } = useHealthSnapshot(organizationId);

  // ----- Local printer agent (not server-pollable) -----
  const [printer, setPrinter] = useState<HealthStatus>("unknown");
  const failsRef = useRef(0);
  const toastedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const ok = await pingAgent().catch(() => false);
      if (cancelled) return;
      if (ok) {
        failsRef.current = 0;
        toastedRef.current = false;
        setPrinter("ok");
      } else {
        failsRef.current += 1;
        if (failsRef.current >= 3) {
          setPrinter("off");
          if (!toastedRef.current) {
            toastedRef.current = true;
            logger.warn("printer agent offline", { fails: failsRef.current });
          }
        } else {
          setPrinter((p) => (p === "ok" ? "warn" : p));
        }
      }
    };
    tick();
    // Backoff: 30s when ok, 60s when failing repeatedly.
    const id = setInterval(tick, failsRef.current >= 3 ? 60_000 : 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Surface a single toast when health flips to error after success.
  const lastErrSig = useRef<string | null>(null);
  useEffect(() => {
    if (!isError) { lastErrSig.current = null; return; }
    const sig = String((error as Error)?.message ?? "err");
    if (sig !== lastErrSig.current) {
      lastErrSig.current = sig;
      toast.error("No se pudo refrescar el estado del sistema", { description: sig });
    }
  }, [isError, error]);

  const onRetry = () => {
    qc.invalidateQueries({ queryKey: ["health-snapshot", organizationId] });
    refetch();
  };

  // Derive pill data with memo so unchanged pills don't re-render.
  const corePill = useMemo(() => {
    const c = health?.core;
    const status: HealthStatus = isError ? "off" : (c?.status as HealthStatus) ?? "unknown";
    return {
      status,
      icon: status === "off" ? WifiOff : Wifi,
      hint: c?.latency_ms != null ? `Latencia ${c.latency_ms} ms` : "Sin medición",
      description: status === "off"
        ? "No hay conexión con SistecPOS Core. Verifica tu red o reintenta."
        : status === "warn"
        ? `Conexión lenta a Core (${c?.latency_ms} ms). Las operaciones pueden ralentizarse.`
        : `Core operativo · ${c?.latency_ms ?? "?"} ms.`,
    };
  }, [health?.core, isError]);

  const sitesPill = useMemo(() => {
    const s = health?.sites;
    const total = s?.total ?? 0;
    const published = s?.published ?? 0;
    const status: HealthStatus = total === 0 ? "unknown" : published > 0 ? "ok" : "warn";
    return {
      status,
      label: total > 0 ? `Web ${published}/${total}` : "Web",
      hint: total === 0 ? "Sin sitios configurados" : `${published} publicado(s)`,
      description: total === 0
        ? "Esta organización aún no tiene sitios web. Crea uno desde Sitios."
        : status === "ok"
        ? `${published} de ${total} sitio(s) publicado(s). Último sync ${s?.last_sync_at ? new Date(s.last_sync_at).toLocaleString("es-CO") : "—"}.`
        : `Ningún sitio publicado. Revisa la configuración para publicar.`,
    };
  }, [health?.sites]);

  const wpPill = useMemo(() => {
    const w = health?.wp;
    const status: HealthStatus = !w ? "unknown" : w.connected ? "ok" : w.errors.length > 0 ? "warn" : "unknown";
    return {
      status,
      hint: w?.connected ? "WordPress OK" : `${w?.errors.length ?? 0} aviso(s)`,
      description: w?.connected
        ? "Todos los sitios publicados tienen WordPress conectado."
        : (w?.errors[0] ?? "WordPress aún no configurado en uno o más sitios."),
      events: w?.errors,
    };
  }, [health?.wp]);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Estado del sistema"
      className={cn("flex items-center gap-1.5 flex-wrap", className)}
    >
      <StatusPill
        icon={Printer}
        label="Impresora"
        status={printer}
        hint={printer === "ok" ? "Agente conectado" : "Agente no detectado"}
        description={
          printer === "ok"
            ? "Agente de impresión local respondiendo en 127.0.0.1:9101."
            : printer === "warn"
            ? "El agente de impresión tardó en responder. Reintentando…"
            : "No hay agente de impresión. Verifica que la aplicación de escritorio esté abierta."
        }
        actionHref="/admin?tab=printers"
        actionLabel="Configurar impresoras"
        onRetry={() => { failsRef.current = 0; setPrinter("unknown"); }}
      />
      <StatusPill
        icon={corePill.icon}
        label="Core"
        status={corePill.status}
        hint={corePill.hint}
        description={corePill.description}
        onRetry={onRetry}
      />
      <StatusPill
        icon={Globe}
        label={sitesPill.label}
        status={sitesPill.status}
        hint={sitesPill.hint}
        description={sitesPill.description}
        actionHref="/sitios"
        actionLabel="Ir a Sitios"
        onRetry={onRetry}
      />
      <StatusPill
        icon={FileText}
        label="WP"
        status={wpPill.status}
        hint={wpPill.hint}
        description={wpPill.description}
        events={wpPill.events}
        actionHref="/sitios"
        actionLabel="Configurar WP"
        onRetry={onRetry}
      />
      {session ? (
        <StatusPill
          icon={Wallet}
          label={`Caja ${fmtMoney(session.opening_amount)}`}
          status="ok"
          hint={`Abierta ${new Date(session.opened_at).toLocaleTimeString("es-CO")}`}
          description={`Turno abierto desde ${new Date(session.opened_at).toLocaleString("es-CO")} con base ${fmtMoney(session.opening_amount)}.`}
        />
      ) : (
        <StatusPill
          icon={CircleDot}
          label="Sin turno"
          status="warn"
          hint="Sin sesión de caja"
          description="No hay sesión de caja abierta. Abre caja antes de registrar ventas."
          actionHref="/pos/vender?caja=1"
          actionLabel="Abrir caja"
        />
      )}
    </div>
  );
}
