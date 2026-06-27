import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";
import { Activity, Loader2, AlertTriangle, History, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auditedMutation } from "@/lib/audit/auditedMutation";
import { handleAuditError } from "@/lib/audit/handleCosign";
import { Skeleton } from "@/components/ui/skeleton";

export type LifecycleState =
  | "pending" | "trial" | "active" | "past_due" | "suspended" | "archived";

const STATE_META: Record<LifecycleState, { label: string; color: string; desc: string }> = {
  pending:   { label: "Pendiente",  color: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300", desc: "Onboarding sin completar. Login bloqueado." },
  trial:     { label: "Prueba",     color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",     desc: "Período de prueba activo." },
  active:    { label: "Activa",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", desc: "Operación normal." },
  past_due:  { label: "Pago vencido", color: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", desc: "Cobro pendiente. Acceso aún permitido." },
  suspended: { label: "Suspendida", color: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300", desc: "Bloqueada. Solo lectura." },
  archived:  { label: "Archivada",  color: "bg-destructive/10 text-destructive", desc: "Terminada. Conservada para auditoría." },
};

const ALLOWED: Record<LifecycleState, LifecycleState[]> = {
  pending:   ["trial", "active", "archived"],
  trial:     ["active", "past_due", "suspended", "archived"],
  active:    ["past_due", "suspended", "archived"],
  past_due:  ["active", "suspended", "archived"],
  suspended: ["active", "archived"],
  archived:  ["active"],
};

type AuditRow = { created_at: string; payload: any; actor_email: string | null };

export default function TenantLifecyclePanel() {
  const { currentOrg } = useOrganization();
  const [state, setState] = useState<LifecycleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState<LifecycleState | null>(null);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [{ data: org }, { data: log }] = await Promise.all([
      supabase.from("organizations").select("lifecycle_state").eq("id", currentOrg.id).maybeSingle(),
      supabase.from("tenant_audit_log")
        .select("created_at, payload, actor_email")
        .eq("organization_id", currentOrg.id)
        .eq("action", "lifecycle_transition")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    setState(((org as any)?.lifecycle_state as LifecycleState) ?? "active");
    setHistory((log as AuditRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  if (!currentOrg) return null;

  // Mapeo de transiciones críticas → action_type en el catálogo audit
  const CRITICAL_MAP: Partial<Record<LifecycleState, string>> = {
    archived: "tenant_archive",
    suspended: "tenant_suspend",
  };

  const runTransition = async (next: LifecycleState, reason: string) => {
    const { data, error } = await supabase.rpc("transition_tenant_lifecycle", {
      _org_id: currentOrg.id,
      _new_state: next,
      _reason: reason,
    });
    if (error) throw error;
    return data;
  };

  const transition = async (next: LifecycleState) => {
    const meta = STATE_META[next];
    const criticalKey = CRITICAL_MAP[next];
    const promptLabel = criticalKey
      ? `Acción CRÍTICA: ${meta.label}.\n${meta.desc}\n\nSe enviará al pipeline auditado${
          next === "archived" ? " (requiere co-firma de otro superadmin)" : ""
        }.\n\nJustificación (obligatoria):`
      : `Cambiar estado a "${meta.label}".\n${meta.desc}\n\nMotivo (obligatorio para auditoría):`;
    const reason = window.prompt(promptLabel, "");
    if (reason === null) return;
    if (!reason.trim()) return toast.error("Motivo requerido");

    setBusy(next);
    try {
      if (criticalKey) {
        const res = await auditedMutation({
          action: criticalKey,
          targetOrgId: currentOrg.id,
          payload: { from: state, to: next },
          justification: reason.trim(),
          run: () => runTransition(next, reason.trim()),
        });
        if (res.status === "executed") {
          toast.success(`Estado actualizado: ${meta.label}`);
          load();
        }
      } else {
        const data = await runTransition(next, reason.trim());
        if ((data as any)?.changed) {
          toast.success(`Estado actualizado: ${meta.label}`);
          load();
        } else {
          toast.info("Sin cambios");
        }
      }
    } catch (e) {
      handleAuditError(e);
    } finally {
      setBusy(null);
    }
  };

  const meta = state ? STATE_META[state] : null;
  const allowed = state ? ALLOWED[state] : [];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Activity size={14} className="text-primary" />
        <h3 className="font-heading font-semibold text-sm">Ciclo de vida del tenant</h3>
      </div>

      <div className="p-4 space-y-4">
        {loading || !meta ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Estado actual</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{state}</span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1.5 max-w-md">{meta.desc}</p>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Transiciones permitidas
              </div>
              {allowed.length === 0 ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Estado terminal. No hay transiciones disponibles.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allowed.map((next) => {
                    const m = STATE_META[next];
                    const danger = next === "archived" || next === "suspended";
                    const critical = !!CRITICAL_MAP[next];
                    return (
                      <Button
                        key={next}
                        size="sm"
                        variant={danger ? "destructive" : "outline"}
                        disabled={busy !== null}
                        onClick={() => transition(next)}
                        title={critical ? "Acción crítica auditada" : undefined}
                      >
                        {busy === next ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : critical ? <ShieldAlert className="h-3.5 w-3.5 mr-1" /> : null}
                        → {m.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <History size={11} /> Últimos cambios
                </div>
                <ul className="space-y-1.5 text-xs">
                  {history.map((h, i) => {
                    const from = h.payload?.from;
                    const to = h.payload?.to;
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 border-l-2 border-border pl-2">
                        <div className="min-w-0">
                          <span className="font-mono">{from}</span>
                          {" → "}
                          <span className="font-mono font-medium">{to}</span>
                          {h.payload?.reason && (
                            <span className="text-muted-foreground"> · {h.payload.reason}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground shrink-0 text-right">
                          <div>{new Date(h.created_at).toLocaleString()}</div>
                          {h.actor_email && <div className="truncate max-w-[160px]">{h.actor_email}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
