import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, RefreshCw, ShieldCheck, ShieldX, ShieldAlert, KeyRound, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lista los últimos eventos de seguridad del POS (sync_logs) para auditoría rápida
 * desde el panel Admin. Reactivo a nuevos inserts vía Realtime.
 */

interface AuditRow {
  id: string;
  service_name: string;
  status: string;
  created_at: string;
  payload: any;
}

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pos_security_pin_lock:          { label: "Bloqueo",              icon: <LockKeyhole className="w-3.5 h-3.5" />,  className: "text-muted-foreground" },
  pos_security_pin_unlock:        { label: "Desbloqueo",           icon: <ShieldCheck className="w-3.5 h-3.5" />, className: "text-success" },
  pos_security_pin_unlock_failed: { label: "PIN incorrecto",       icon: <ShieldX className="w-3.5 h-3.5" />,      className: "text-destructive" },
  pos_security_pin_configured:    { label: "PIN configurado",      icon: <KeyRound className="w-3.5 h-3.5" />,     className: "text-primary" },
  pos_security_pin_gate_pass:     { label: "PIN OK antes de cobro",icon: <ShieldCheck className="w-3.5 h-3.5" />, className: "text-success" },
  pos_security_pin_gate_fail:     { label: "Cobro denegado",       icon: <ShieldAlert className="w-3.5 h-3.5" />, className: "text-warning" },
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

function triggerLabel(t: string | null | undefined): string | null {
  if (!t) return null;
  return { idle: "por inactividad", manual: "manual", hotkey: "Ctrl+L", gate: "acción crítica" }[t] ?? t;
}

export default function POSSecurityAuditList() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles").select("primary_organization_id").eq("id", uid).maybeSingle();
      setOrgId(((prof as any)?.primary_organization_id as string | null) ?? null);
    });
  }, []);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("sync_logs")
      .select("id, service_name, status, created_at, payload")
      .eq("organization_id", orgId)
      .like("service_name", "pos_security_%")
      .order("created_at", { ascending: false })
      .limit(15);
    setRows((data as AuditRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (orgId) load(); }, [orgId]);

  // Realtime: refresca al recibir nuevos inserts para esta org.
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`pos-security-audit-${orgId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "sync_logs", filter: `organization_id=eq.${orgId}` },
        (payload) => {
          const svc = (payload.new as any)?.service_name as string | undefined;
          if (svc?.startsWith("pos_security_")) load();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (!orgId) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Actividad de seguridad reciente</h3>
          <p className="text-[11px] text-muted-foreground">
            Últimos 15 eventos (bloqueos, desbloqueos, intentos fallidos) de esta organización.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {rows === null ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
          Sin eventos aún. Bloquea o desbloquea el POS para verlos aquí.
        </div>
      ) : (
        <ul className="divide-y border rounded-md overflow-hidden">
          {rows.map((r) => {
            const meta = EVENT_META[r.service_name] ?? {
              label: r.service_name.replace("pos_security_", ""),
              icon: <ShieldCheck className="w-3.5 h-3.5" />,
              className: "text-muted-foreground",
            };
            const trigger = triggerLabel(r.payload?.trigger);
            const reason = r.payload?.reason as string | undefined;
            return (
              <li key={r.id} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/40">
                <span className={cn("shrink-0", meta.className)}>{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    <span className={meta.className}>{meta.label}</span>
                    {trigger && <span className="text-muted-foreground font-normal"> · {trigger}</span>}
                  </p>
                  {reason && <p className="text-[10px] text-muted-foreground truncate">{reason}</p>}
                </div>
                <time className="text-[10px] text-muted-foreground tabular-nums shrink-0" dateTime={r.created_at}>
                  {fmtTime(r.created_at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
