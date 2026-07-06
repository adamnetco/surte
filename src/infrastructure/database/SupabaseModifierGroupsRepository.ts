/**
 * SupabaseModifierGroupsRepository — adaptador Supabase para
 * IModifierGroupsRepository. Encapsula lecturas y realtime sobre
 * `modifier_groups`.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import type { IModifierGroupsRepository } from "@/core/ports/IModifierGroupsRepository";

const asAny = supabase as any;

export const supabaseModifierGroupsRepository: IModifierGroupsRepository = {
  async listProductIdsWithActiveGroups(organizationId: string): Promise<string[]> {
    const { data, error } = await asAny
      .from("modifier_groups")
      .select("product_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    if (error) throw error;
    return ((data ?? []) as Array<{ product_id: string | null }>)
      .map((r) => r.product_id)
      .filter((v): v is string => !!v);
  },

  subscribeGroupChanges(organizationId, onChange) {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(uniqueTopic(`mods-${organizationId}`))
        .on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table: "modifier_groups",
            filter: `organization_id=eq.${organizationId}`,
          },
          () => onChange(),
        )
        .subscribe();
    } catch (err) {
      console.warn("[SupabaseModifierGroupsRepository] subscribe failed", err);
    }
    return () => safeRemoveChannel(channel);
  },
};
