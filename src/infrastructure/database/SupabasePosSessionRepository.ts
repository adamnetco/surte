/**
 * SupabasePosSessionRepository — implementa `IPosSessionRepository`
 * consultando `locations`, `cash_registers` y `cash_sessions`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  IPosSessionRepository,
  PosBootstrap,
  PosCashRegister,
  PosLocation,
  PosSession,
} from "@/core/ports/IPosSessionRepository";

export const supabasePosSessionRepository: IPosSessionRepository = {
  async loadBootstrap({ organizationId, userId }): Promise<PosBootstrap> {
    const [{ data: locs }, { data: regs }, { data: ses }] = await Promise.all([
      supabase
        .from("locations")
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("cash_registers")
        .select("id,name,location_id")
        .eq("organization_id", organizationId)
        .eq("is_active", true),
      supabase
        .from("cash_sessions")
        .select("id,location_id,cash_register_id,opening_amount,opened_at,status")
        .eq("organization_id", organizationId)
        .eq("opened_by", userId)
        .eq("status", "open")
        .maybeSingle(),
    ]);

    return {
      locations: (locs ?? []) as PosLocation[],
      registers: (regs ?? []) as PosCashRegister[],
      activeSession: (ses as PosSession | null) ?? null,
    };
  },
};
