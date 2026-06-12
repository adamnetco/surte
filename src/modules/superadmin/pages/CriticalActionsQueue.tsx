import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Clock, ShieldAlert, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Status = "pending" | "approved" | "rejected" | "executed" | "expired" | "cancelled";

interface ActionRow {
  id: string;
  action_type: string;
  status: Status;
  justification: string;
  payload: Record<string, unknown>;
  requested_by: string;
  requested_by_email: string | null;
  cosigned_by_email: string | null;
  cosign_reason: string | null;
  cancelled_reason: string | null;
  expires_at: string;
  created_at: string;
  target_org_id: string | null;
}

const statusStyle: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-blue-100 text-blue-900",
  executed: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  expired: "bg-gray-200 text-gray-700",
  cancelled: "bg-gray-200 text-gray-700",
};

export default function CriticalActionsQueue() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Status | "all">("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["critical-actions", filter],
    queryFn: async () => {
      let q = supabase.from("critical_actions").select("*").order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ActionRow[];
    },
  });

  const counters = useMemo(() => {
    const arr = data ?? [];
    return {
      pending: arr.filter((a) => a.status === "pending").length,
      approved: arr.filter((a) => a.status === "approved").length,
    };
  }, [data]);

  const cosign = async (row: ActionRow, decision: "approve" | "reject") => {
    if (row.requested_by === user?.id) {
      toast.error("No puedes co-firmar tus propias solicitudes.");
      return;
    }
    let reason: string | null = null;
    if (decision === "reject") {
      reason = window.prompt("Motivo del rechazo (obligatorio):");
      if (!reason?.trim()) return;
    } else {
      reason = window.prompt("Comentario de aprobación (opcional):") ?? null;
    }
    try {
      const { error } = await supabase.rpc("cosign_critical_action", {
        _action_id: row.id,
        _decision: decision,
        _reason: reason,
      });
      if (error) throw error;
      toast.success(decision === "approve" ? "Acción aprobada." : "Acción rechazada.");
      qc.invalidateQueries({ queryKey: ["critical-actions"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo procesar.");
    }
  };

  const cancel = async (row: ActionRow) => {
    if (row.requested_by !== user?.id) {
      toast.error("Solo el solicitante puede cancelar.");
      return;
    }
    const reason = window.prompt("Motivo de cancelación:") ?? "";
    try {
      const { error } = await supabase.rpc("cancel_critical_action", {
        _action_id: row.id,
        _reason: reason,
      });
      if (error) throw error;
      toast.success("Solicitud cancelada.");
      qc.invalidateQueries({ queryKey: ["critical-actions"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cancelar.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" /> Cola de acciones críticas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprobaciones de doble firma para operaciones de alto riesgo (archivar tiendas, cambios
          masivos de módulos, borrado definitivo).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(["pending", "approved", "executed", "rejected", "expired", "cancelled", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md border transition ${
              filter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
            }`}
          >
            {s} {s === "pending" && counters.pending > 0 ? `(${counters.pending})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 bg-muted animate-pulse rounded" />
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Sin solicitudes en este estado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.map((row) => {
            const isExpired = row.status === "pending" && new Date(row.expires_at) < new Date();
            const minsLeft = Math.max(
              0,
              Math.round((new Date(row.expires_at).getTime() - Date.now()) / 60000)
            );
            return (
              <Card key={row.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base">{row.action_type}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Solicitado por <span className="font-medium">{row.requested_by_email ?? "—"}</span>{" "}
                        · {new Date(row.created_at).toLocaleString("es-CO")}
                      </p>
                    </div>
                    <Badge className={statusStyle[row.status]}>{row.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Justificación</p>
                    <p className="mt-1">{row.justification}</p>
                  </div>

                  {Object.keys(row.payload ?? {}).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver payload
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-[11px]">
                        {JSON.stringify(row.payload, null, 2)}
                      </pre>
                    </details>
                  )}

                  {row.cosigned_by_email && (
                    <p className="text-xs text-muted-foreground">
                      Co-firmado por <span className="font-medium">{row.cosigned_by_email}</span>
                      {row.cosign_reason && <> — "{row.cosign_reason}"</>}
                    </p>
                  )}

                  {row.status === "pending" && (
                    <p className="text-xs flex items-center gap-1 text-amber-700">
                      <Clock className="h-3 w-3" />
                      {isExpired ? "Expirada" : `Expira en ~${minsLeft} min`}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {row.status === "pending" && !isExpired && row.requested_by !== user?.id && (
                      <>
                        <Button size="sm" onClick={() => cosign(row, "approve")}>
                          <Check className="h-4 w-4 mr-1" /> Aprobar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => cosign(row, "reject")}>
                          <X className="h-4 w-4 mr-1" /> Rechazar
                        </Button>
                      </>
                    )}
                    {["pending", "approved"].includes(row.status) && row.requested_by === user?.id && (
                      <Button size="sm" variant="outline" onClick={() => cancel(row)}>
                        <Ban className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
