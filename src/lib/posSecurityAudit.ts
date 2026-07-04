// Audit logger para eventos de seguridad del POS (bloqueo, desbloqueo, PIN gate).
// Escribe a `sync_logs` de forma fire-and-forget; nunca bloquea la UI.
// Resuelve la organización desde `profiles.primary_organization_id` y cachea
// el resultado para el resto de la sesión (evita round-trips en cada lock).
import { supabase } from "@/integrations/supabase/client";

export type PosSecurityEvent =
  | "pin_lock"           // caja bloqueada (manual, idle o Ctrl+L)
  | "pin_unlock"         // desbloqueo con PIN correcto
  | "pin_unlock_failed"  // intento con PIN incorrecto
  | "pin_configured"     // PIN nuevo configurado
  | "pin_gate_pass"      // acción crítica autorizada tras exigir PIN
  | "pin_gate_fail";     // acción crítica denegada

interface AuditContext {
  reason?: string;
  trigger?: "manual" | "idle" | "hotkey" | "gate";
  meta?: Record<string, unknown>;
}

let cachedOrgId: string | null | undefined = undefined; // undefined = sin resolver
let inflight: Promise<string | null> | null = null; // dedupe de resolución concurrente

async function resolveOrgId(): Promise<string | null> {
  if (cachedOrgId !== undefined) return cachedOrgId;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) { cachedOrgId = null; return null; }
      const { data } = await supabase
        .from("profiles")
        .select("primary_organization_id")
        .eq("id", uid)
        .maybeSingle();
      cachedOrgId = ((data as any)?.primary_organization_id as string | null) ?? null;
      return cachedOrgId;
    } catch {
      cachedOrgId = null;
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Registra un evento de seguridad del POS.
 * Fire-and-forget: nunca lanza y nunca bloquea al llamador.
 */
export function logPosSecurityEvent(event: PosSecurityEvent, ctx: AuditContext = {}): void {
  // Ejecución diferida para no penalizar el hilo del render.
  queueMicrotask(async () => {
    try {
      const orgId = await resolveOrgId();
      if (!orgId) return;
      const { data: userData } = await supabase.auth.getUser();
      const status =
        event === "pin_unlock_failed" || event === "pin_gate_fail" ? "warning" : "success";
      await (supabase as any).from("sync_logs").insert({
        organization_id: orgId,
        service_name: `pos_security_${event}`,
        status,
        payload: {
          user_id: userData?.user?.id ?? null,
          event,
          reason: ctx.reason ?? null,
          trigger: ctx.trigger ?? null,
          at: new Date().toISOString(),
          ...(ctx.meta ?? {}),
        },
      });
    } catch {
      /* fire-and-forget */
    }
  });
}

/** Limpia el cache — llamar en logout para no reutilizar org entre usuarios. */
export function resetPosSecurityAuditCache(): void {
  cachedOrgId = undefined;
}
