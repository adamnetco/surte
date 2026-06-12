/**
 * Pipeline de mutaciones auditadas + co-firma.
 *
 * Flujo:
 *   1. UI llama `auditedMutation({ action, target, payload, justification, run })`
 *   2. Se crea solicitud en `critical_actions` vía `request_critical_action`.
 *   3. Si NO requiere co-firma → status='approved', se ejecuta `run()` y se marca `executed`.
 *   4. Si SÍ requiere co-firma → status='pending', se lanza error `cosign_required`
 *      con el `actionId`; la UI muestra "Pendiente de co-firma" y otro superadmin
 *      la aprueba desde la cola.
 *   5. Una vez aprobada, el solicitante reintenta y se ejecuta.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AuditedMutationOpts<T> {
  action: string;
  targetOrgId?: string | null;
  payload?: Record<string, unknown>;
  justification: string;
  /** Función que ejecuta la mutación real (solo se llama si la acción está aprobada). */
  run: () => Promise<T>;
  /** Si ya tienes una acción aprobada (porque era pending y ahora se reintenta). */
  approvedActionId?: string;
}

export interface AuditedMutationResult<T> {
  actionId: string;
  status: "executed" | "pending";
  /** Solo presente cuando status='executed'. */
  result?: T;
}

export class CosignRequiredError extends Error {
  actionId: string;
  constructor(actionId: string) {
    super("cosign_required");
    this.name = "CosignRequiredError";
    this.actionId = actionId;
  }
}

export async function auditedMutation<T>(
  opts: AuditedMutationOpts<T>
): Promise<AuditedMutationResult<T>> {
  if (!opts.justification?.trim()) {
    throw new Error("Justificación obligatoria para acciones críticas.");
  }

  let actionId = opts.approvedActionId ?? null;
  let needsCosign = false;

  if (!actionId) {
    const { data, error } = await supabase.rpc("request_critical_action", {
      _action_type: opts.action,
      _target_org: opts.targetOrgId ?? null,
      _payload: (opts.payload ?? {}) as any,
      _justification: opts.justification,
    });
    if (error) throw error;
    const resp = data as { action_id: string; status: string; requires_cosign: boolean };
    actionId = resp.action_id;
    needsCosign = resp.status === "pending";
  }

  if (needsCosign) {
    throw new CosignRequiredError(actionId!);
  }

  // status='approved' → ejecutar
  const result = await opts.run();

  const { error: execErr } = await supabase.rpc("mark_critical_action_executed", {
    _action_id: actionId!,
    _result: ((result ?? {}) as unknown) as any,
  });
  if (execErr) {
    // La mutación ya corrió; reportamos pero no la revertimos automáticamente.
    console.error("[auditedMutation] no se pudo marcar como ejecutada:", execErr);
  }

  return { actionId: actionId!, status: "executed", result };
}
