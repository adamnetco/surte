import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Wifi, WifiOff, Globe, Wallet, CircleDot } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { pingAgent } from "@/modules/printing/drivers/agent";
import { cn } from "@/lib/utils";

interface Props {
  organizationId: string;
  /** Sesión de caja abierta (opcional — solo aparece en POS, no en hub) */
  session?: { opening_amount: number; opened_at: string } | null;
  className?: string;
  compact?: boolean;
}

type Status = "ok" | "warn" | "off" | "unknown";

const dotColor: Record<Status, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  off: "bg-rose-500",
  unknown: "bg-muted-foreground/40",
};

function Pill({
  icon: Icon,
  label,
  hint,
  status,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  status: Status;
  to?: string;
}) {
  const body = (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[11px] leading-none transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={hint ?? label}
    >
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotColor[status])}>
        {status === "ok" && (
          <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
        )}
      </span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="font-medium text-foreground hidden sm:inline">{label}</span>
    </span>
  );
  return to ? <Link to={to} aria-label={`${label}: ${hint ?? status}`}>{body}</Link> : body;
}

/** Barra compacta con 4 indicadores: impresora · core · sitios web · caja. */
export default function POSStatusBar({ organizationId, session, className }: Props) {
  // ---- 1) Impresora (agente local) ----
  const [printer, setPrinter] = useState<Status>("unknown");
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const ok = await pingAgent().catch(() => false);
        if (!cancelled) setPrinter(ok ? "ok" : "off");
      } catch {
        if (!cancelled) setPrinter("off");
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // ---- 2) Conexión a SistecPOS Core ----
  const [core, setCore] = useState<{ status: Status; latency?: number }>({ status: "unknown" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!navigator.onLine) { if (!cancelled) setCore({ status: "off" }); return; }
      const t0 = performance.now();
      try {
        const { error } = await supabase.from("organizations").select("id", { head: true, count: "exact" }).limit(1);
        const lat = Math.round(performance.now() - t0);
        if (cancelled) return;
        if (error) setCore({ status: "warn", latency: lat });
        else setCore({ status: lat > 800 ? "warn" : "ok", latency: lat });
      } catch {
        if (!cancelled) setCore({ status: "off" });
      }
    };
    check();
    const id = setInterval(check, 20_000);
    const on = () => check();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);

  // ---- 3) Sitios web (Astro + WP) publicados ----
  const { data: sites } = useQuery({
    queryKey: ["pos-status-sites", organizationId],
    enabled: !!organizationId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_sites")
        .select("id,is_published,updated_at")
        .eq("organization_id", organizationId);
      return data ?? [];
    },
  });
  const published = sites?.filter((s: any) => s.is_published).length ?? 0;
  const total = sites?.length ?? 0;
  const sitesStatus: Status = total === 0 ? "unknown" : published > 0 ? "ok" : "off";
  const lastSync = sites?.reduce<string | null>((acc, s: any) => {
    const v = s.updated_at;
    if (!v) return acc;
    return !acc || v > acc ? v : acc;
  }, null);
  // (consume below)
  void lastSync;
  const _lastSync = sites?.reduce<string | null>((acc, s: any) => {
    if (!s.last_sync_at) return acc;
    return !acc || s.last_sync_at > acc ? s.last_sync_at : acc;
  }, null);

  // ---- 4) Sesión / turno ----
  const sessionStatus: Status = session ? "ok" : "unknown";

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  return (
    <div
      role="status"
      aria-label="Estado del sistema"
      className={cn("flex items-center gap-1.5 flex-wrap", className)}
    >
      <Pill
        icon={Printer}
        label="Impresora"
        hint={printer === "ok" ? "Agente de impresión conectado" : "Agente de impresión no detectado"}
        status={printer}
      />
      <Pill
        icon={core.status === "off" ? WifiOff : Wifi}
        label="Core"
        hint={
          core.status === "off"
            ? "Sin conexión a SistecPOS Core"
            : `SistecPOS Core${core.latency ? ` · ${core.latency} ms` : ""}`
        }
        status={core.status}
      />
      <Pill
        icon={Globe}
        label={total > 0 ? `Web ${published}/${total}` : "Web"}
        hint={
          total === 0
            ? "Sin sitios web configurados"
            : `${published} publicado(s)${lastSync ? ` · último sync ${new Date(lastSync).toLocaleString("es-CO")}` : ""}`
        }
        status={sitesStatus}
        to="/sitios"
      />
      {session && (
        <Pill
          icon={Wallet}
          label={`Caja ${fmtMoney(session.opening_amount)}`}
          hint={`Turno abierto desde ${new Date(session.opened_at).toLocaleTimeString("es-CO")}`}
          status={sessionStatus}
        />
      )}
      {!session && (
        <Pill
          icon={CircleDot}
          label="Sin turno"
          hint="No hay sesión de caja abierta"
          status="warn"
        />
      )}
    </div>
  );
}
