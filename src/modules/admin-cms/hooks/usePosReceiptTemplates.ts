import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import type { ReceiptChannel } from "../lib/receiptLayoutSchema";

export interface ReceiptTemplate {
  id: string;
  organization_id: string;
  name: string;
  channel: ReceiptChannel;
  is_default: boolean;
  paper_width_mm: number;
  font_size_pt: number;
  copies: number;
  show_logo: boolean;
  show_qr_pago: boolean;
  show_nit: boolean;
  header_text: string | null;
  footer_text: string | null;
  layout: { sections: any[] };
  created_at: string;
  updated_at: string;
}

export function useReceiptTemplates() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  return useQuery({
    queryKey: ["pos_receipt_templates", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_receipt_templates" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .order("channel", { ascending: true })
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReceiptTemplate[];
    },
  });
}

export function useResolveReceiptTemplate(channel: ReceiptChannel) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  return useQuery({
    queryKey: ["pos_receipt_template_resolve", orgId, channel],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_receipt_template_resolve" as any, {
        _org_id: orgId!,
        _channel: channel,
      });
      if (error) throw error;
      return data as unknown as ReceiptTemplate;
    },
  });
}

export function useUpdateReceiptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ReceiptTemplate> & { id: string }) => {
      const { id, created_at, updated_at, organization_id, ...rest } = patch as any;
      const { data, error } = await supabase
        .from("pos_receipt_templates" as any)
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ReceiptTemplate;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["pos_receipt_templates"] });
      qc.setQueryData(
        ["pos_receipt_template_resolve", data.organization_id, data.channel],
        data,
      );
    },
  });
}
