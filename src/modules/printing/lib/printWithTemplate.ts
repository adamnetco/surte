// Helper de alto nivel para imprimir un ticket usando la plantilla declarativa
// guardada en pos_receipt_templates para el canal dado. Si la RPC falla o no
// hay layout, cae al builder hardcoded (backward compatible).
import { supabase } from "@/integrations/supabase/client";
import { buildReceipt } from "./ticketBuilder";
import type { TicketData } from "./ticketBuilder";
import type { ReceiptChannel, Layout } from "@/modules/admin-cms/lib/receiptLayoutSchema";

export interface PrintWithTemplateArgs {
  orgId: string;
  channel: ReceiptChannel;
  ticket: TicketData;
  paperMm?: 58 | 80;
}

export async function buildReceiptForChannel({
  orgId,
  channel,
  ticket,
  paperMm = 80,
}: PrintWithTemplateArgs) {
  let layout: Layout | undefined;
  let templateId: string | undefined;
  try {
    const { data, error } = await supabase.rpc("pos_receipt_template_resolve" as any, {
      _org_id: orgId,
      _channel: channel,
    });
    if (!error && data) {
      const tpl = data as any;
      templateId = tpl.id;
      const sections = tpl?.layout?.sections;
      if (Array.isArray(sections) && sections.length > 0) {
        layout = { sections } as Layout;
      }
      if (paperMm === 80 && tpl?.paper_width_mm === 58) paperMm = 58;
    }
  } catch {
    // ignore — fallback al builder por defecto
  }
  const builder = buildReceipt(ticket, paperMm, layout);
  return { builder, templateId, paperMm };
}
