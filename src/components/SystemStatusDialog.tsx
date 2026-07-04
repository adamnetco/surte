import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Wifi, WifiOff, CloudUpload, Printer, MonitorSmartphone,
  ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pendingCount, flushOutbox } from "@/modules/offline/lib/outbox";
import { isElectron, getWindowBridge } from "@/lib/electronBridge";
import { toast } from "sonner";

/**
 * SystemStatusDialog — panel de diagnóstico global.
 *
 * Abrir con: window.dispatchEvent(new CustomEvent("app:open-status"))
 *
 * Muestra:
 *   • Conectividad (online / offline)
 *   • Outbox pendiente (con botón Reintentar sync)
 *   • Salud DIAN (si hay organización activa)
 *   • Print-agent local (http://127.0.0.1:9101/health)
 *   • Runtime (Electron vs navegador)
 *
 * Autorefresca cada 15 s mientras está abierto. Cero costo cuando está cerrado.
 */

type Health = "ok" | "warn" | "off" | "unknown" | "loading";

interface Snapshot {
  online: boolean;
  outbox: { pending: number; loading: boolean };
  dian: { status: Health; hasContingency: boolean; org: string | null };
  printAgent: { status: Health; version?: string; port: number };
  runtime: { kind: "electron" | "browser"; ua: string };
}

const PRINT_AGENT_PORT = 9101;

async function checkPrintAgent(): Promise<Snapshot["printAgent"]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(`http://127.0.0.1:${PRINT_AGENT_PORT}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return { status: "warn", port: PRINT_AGENT_PORT };
    const j = await res.json().catch(() => ({}));
    return { status: "ok", version: j.version, port: PRINT_AGENT_PORT };
  } catch {
    return { status: "off", port: PRINT_AGENT_PORT };
  }
}

async function checkDian(): Promise<Snapshot["dian"]> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) return { status: "unknown", hasContingency: false, org: null };

    const { data: prof } = await supabase
      .from("profiles")
      .select("primary_organization_id")
      .eq("id", uid)
      .maybeSingle();
    const orgId = (prof as any)?.primary_organization_id as string | null;
    if (!orgId) return { status: "unknown", hasContingency: false, org: null };

    const [{ data: cfg }, { data: org }] = await Promise.all([
      supabase.from("einvoice_configs").select("dian_health_status, contingency_range").eq("organization_id", orgId).maybeSingle(),
      supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    ]);
    const raw = ((cfg as any)?.dian_health_status ?? "unknown") as string;
    const status: Health =
      raw === "online" ? "ok" : raw === "degraded" ? "warn" : raw === "offline" ? "off" : "unknown";
    const range = (cfg as any)?.contingency_range;
    return {
      status,
      hasContingency: !!(range && typeof range === "object" && (range.from ?? range.current ?? range.to)),
      org: (org as any)?.name ?? null,
    };
  } catch {
    return { status: "unknown", hasContingency: false, org: null };
  }
}

const EMPTY: Snapshot = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  outbox: { pending: 0, loading: true },
  dian: { status: "loading", hasContingency: false, org: null },
  printAgent: { status: "loading", port: PRINT_AGENT_PORT },
  runtime: {
    kind: isElectron() ? "electron" : "browser",
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
  },
};

export default function SystemStatusDialog() {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [pending, dian, printAgent] = await Promise.all([
      pendingCount().catch(() => 0),
      checkDian(),
      checkPrintAgent(),
    ]);
    setSnap((s) => ({
      ...s,
      online: navigator.onLine,
      outbox: { pending, loading: false },
      dian,
      printAgent,
    }));
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("app:open-status", onOpen);
    return () => window.removeEventListener("app:open-status", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const id = window.setInterval(refresh, 15_000);
    const onOnline = () => setSnap((s) => ({ ...s, online: true }));
    const onOffline = () => setSnap((s) => ({ ...s, online: false }));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [open, refresh]);

  const forceSync = async () => {
    if (!navigator.onLine) {
      toast.error("Estás sin conexión — no se puede sincronizar aún");
      return;
    }
    setRefreshing(true);
    const res = await flushOutbox();
    await refresh();
    toast.success(`Sync: ${res.sent} enviados · ${res.failed} fallidos · ${res.skipped} en espera`);
  };

  const bridge = getWindowBridge();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Estado del sistema
          </DialogTitle>
          <DialogDescription>
            Diagnóstico rápido de conectividad, sincronización y hardware.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-1">
          <StatusRow
            icon={snap.online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            title="Conexión a Internet"
            subtitle={snap.online ? "En línea" : "Sin conexión — trabajando en modo offline"}
            health={snap.online ? "ok" : "off"}
          />

          <StatusRow
            icon={<CloudUpload className="w-4 h-4" />}
            title="Sincronización (outbox)"
            subtitle={
              snap.outbox.loading
                ? "Consultando cola local…"
                : snap.outbox.pending === 0
                  ? "Todo sincronizado"
                  : `${snap.outbox.pending} operación${snap.outbox.pending === 1 ? "" : "es"} pendiente${snap.outbox.pending === 1 ? "" : "s"}`
            }
            health={snap.outbox.loading ? "loading" : snap.outbox.pending === 0 ? "ok" : "warn"}
            action={
              snap.outbox.pending > 0 ? (
                <Button size="sm" variant="outline" onClick={forceSync} disabled={refreshing}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                  Reintentar
                </Button>
              ) : null
            }
          />

          <StatusRow
            icon={<ShieldCheck className="w-4 h-4" />}
            title="Facturación DIAN"
            subtitle={
              snap.dian.status === "loading"
                ? "Consultando…"
                : snap.dian.org
                  ? `${snap.dian.org} · ${labelDian(snap.dian.status)}${snap.dian.hasContingency ? " · rango de contingencia disponible" : ""}`
                  : "Sin organización activa"
            }
            health={snap.dian.status === "loading" ? "loading" : snap.dian.status}
          />

          <StatusRow
            icon={<Printer className="w-4 h-4" />}
            title="Agente de impresión local"
            subtitle={
              snap.printAgent.status === "loading"
                ? `Verificando 127.0.0.1:${snap.printAgent.port}…`
                : snap.printAgent.status === "ok"
                  ? `Activo${snap.printAgent.version ? ` · v${snap.printAgent.version}` : ""} · 127.0.0.1:${snap.printAgent.port}`
                  : `No responde en 127.0.0.1:${snap.printAgent.port}`
            }
            health={snap.printAgent.status === "loading" ? "loading" : snap.printAgent.status}
          />

          <StatusRow
            icon={<MonitorSmartphone className="w-4 h-4" />}
            title="Entorno de ejecución"
            subtitle={
              snap.runtime.kind === "electron"
                ? "Aplicación de escritorio (Electron) — GPU acelerada"
                : "Navegador web"
            }
            health="ok"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            Actualización automática cada 15 s
          </p>
          <div className="flex gap-2">
            {snap.runtime.kind === "electron" && bridge && (
              <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
                Recargar ventana
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function labelDian(h: Health): string {
  switch (h) {
    case "ok": return "en línea";
    case "warn": return "degradada";
    case "off": return "fuera de línea";
    default: return "sin datos";
  }
}

function StatusRow({
  icon, title, subtitle, health, action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  health: Health;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors">
      <div className="shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center text-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <HealthBadge h={health} />
      {action}
    </div>
  );
}

function HealthBadge({ h }: { h: Health }) {
  if (h === "loading") {
    return <Badge variant="outline" className="text-[10px]">…</Badge>;
  }
  if (h === "ok") {
    return (
      <Badge className="bg-success/15 text-success border-success/30 text-[10px] gap-1" variant="outline">
        <CheckCircle2 className="w-3 h-3" /> OK
      </Badge>
    );
  }
  if (h === "warn") {
    return (
      <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] gap-1" variant="outline">
        <AlertTriangle className="w-3 h-3" /> Aviso
      </Badge>
    );
  }
  if (h === "off") {
    return (
      <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] gap-1" variant="outline">
        <XCircle className="w-3 h-3" /> Caído
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">N/A</Badge>;
}
