import { supabase } from "@/integrations/supabase/client";

/**
 * Registra un click "Mejorar/Ver plan" desde una denial o banner.
 * Silencioso si el tenant no está disponible.
 */
export async function logUpgradeClick(
  organizationId: string | null | undefined,
  context: { kind: "limit" | "module" | "subscription"; key: string; from?: string },
) {
  if (!organizationId) return;
  try {
    await supabase.rpc("log_upgrade_click" as any, {
      p_org_id: organizationId,
      p_context: context as any,
    });
  } catch {
    /* no-op: telemetría no debe romper UX */
  }
}
