/**
 * SupabaseHardBlockPolicyRepository — adaptador Supabase para
 * IHardBlockPolicyRepository.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import type {
  HardBlockOverrideAuditPayload,
  IHardBlockPolicyRepository,
} from "@/core/ports/IHardBlockPolicyRepository";

const asAny = supabase as any;

export const supabaseHardBlockPolicyRepository: IHardBlockPolicyRepository = {
  async getHardBlockFlag(organizationId) {
    const { data } = await supabase
      .from("einvoice_configs")
      .select("hard_block_when_dian_down")
      .eq("organization_id", organizationId)
      .eq("environment", "prod")
      .maybeSingle();
    return !!(data as any)?.hard_block_when_dian_down;
  },

  subscribeHardBlockFlag(organizationId, onChange) {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(uniqueTopic(`hard-block-${organizationId}`))
        .on(
          "postgres_changes" as any,
          {
            event: "UPDATE",
            schema: "public",
            table: "einvoice_configs",
            filter: `organization_id=eq.${organizationId}`,
          },
          (payload: any) =>
            onChange(!!(payload.new as any)?.hard_block_when_dian_down),
        )
        .subscribe();
    } catch (err) {
      console.warn("[SupabaseHardBlockPolicyRepository] subscribe failed", err);
    }
    return () => safeRemoveChannel(channel);
  },

  async logOverrideActivation(
    organizationId: string,
    payload: HardBlockOverrideAuditPayload,
  ) {
    await asAny.from("sync_logs").insert({
      organization_id: organizationId,
      service_name: "pos_hard_block_override",
      status: "warning",
      payload,
    });
  },

  async getCurrentUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  },
};
