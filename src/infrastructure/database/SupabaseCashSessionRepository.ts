/**
 * SupabaseCashSessionRepository — implementa `ICashSessionRepository`
 * cubriendo snapshot de cierre, upload de foto de arqueo (Storage) y
 * cierre atómico (update + RPC close + RPC hash + fetch de sello).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CashDenomination,
  CashSessionCloseInput,
  CashSessionCloseResult,
  CashSessionCloseSnapshot,
  CashSessionOpenInput,
  CashSessionTotals,
  ICashSessionRepository,
  OpenedCashSession,
} from "@/core/ports/ICashSessionRepository";


export const supabaseCashSessionRepository: ICashSessionRepository = {
  async loadCloseSnapshot({ organizationId, sessionId }): Promise<CashSessionCloseSnapshot> {
    const [{ data: pays }, { count }, { data: dens }, { data: tipsRows }] = await Promise.all([
      supabase.from("pos_payments").select("method,amount")
        .eq("organization_id", organizationId).eq("cash_session_id", sessionId),
      supabase.from("pos_orders").select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId).eq("cash_session_id", sessionId).eq("status", "paid"),
      supabase.from("cash_denominations").select("id,value,kind")
        .eq("currency", "COP").eq("is_active", true).order("value", { ascending: false }),
      supabase.from("pos_orders").select("tip")
        .eq("organization_id", organizationId).eq("cash_session_id", sessionId).eq("status", "paid"),
    ]);

    const tipsTotal = (tipsRows ?? []).reduce(
      (s, r: { tip: number | null }) => s + Number(r.tip ?? 0),
      0,
    );
    const totals: CashSessionTotals = {
      cash: 0, card: 0, transfer: 0, other: 0,
      total: 0, count: count ?? 0, tips: tipsTotal,
    };
    (pays ?? []).forEach((p: any) => {
      const a = Number(p.amount);
      totals.total += a;
      if (p.method === "efectivo") totals.cash += a;
      else if (p.method?.startsWith("tarjeta")) totals.card += a;
      else if (["transferencia", "nequi", "daviplata"].includes(p.method)) totals.transfer += a;
      else totals.other += a;
    });

    return {
      totals,
      denominations: ((dens ?? []) as CashDenomination[]),
    };
  },

  async uploadArqueoPhoto({ organizationId, sessionId, file }): Promise<string> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `org-${organizationId}/sessions/${sessionId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cash-arqueo").upload(path, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (error) throw error;
    return path;
  },

  async close(input: CashSessionCloseInput): Promise<CashSessionCloseResult> {
    const {
      organizationId, sessionId, userId,
      expectedAmount, totals, denominationCounts,
      notes, blindMode, arqueoPhotoPath,
    } = input;

    const { error: upErr } = await supabase
      .from("cash_sessions")
      .update({
        expected_amount: expectedAmount,
        total_sales: totals.total,
        total_cash: totals.cash,
        total_card: totals.card,
        total_transfer: totals.transfer,
        total_other: totals.other,
        ticket_count: totals.count,
        notes,
        blind_count_enabled: blindMode,
        arqueo_photo_url: arqueoPhotoPath,
        arqueo_confirmed_at: new Date().toISOString(),
        arqueo_confirmed_by: userId,
      } as any)
      .eq("organization_id", organizationId)
      .eq("id", sessionId);
    if (upErr) throw upErr;

    const { error: rpcErr } = await supabase.rpc("close_cash_session_with_counts", {
      _session_id: sessionId,
      _counts: denominationCounts as any,
    });
    if (rpcErr) throw rpcErr;

    // Calcula y persiste hash determinístico del conteo (best-effort).
    const { data: hash } = await (supabase.rpc as any)("cash_session_compute_denom_hash", {
      p_session_id: sessionId,
    });
    if (hash) {
      await supabase.from("cash_sessions")
        .update({ denominations_hash: hash as string } as any)
        .eq("organization_id", organizationId)
        .eq("id", sessionId);
    }

    // Recupera sello fiscal emitido por trigger post-cierre.
    const { data: sealRow } = await supabase
      .from("cash_session_seals")
      .select("sequence,current_hash")
      .eq("cash_session_id", sessionId)
      .maybeSingle();

    return {
      sealSequence: sealRow?.sequence != null ? Number(sealRow.sequence) : null,
      sealHash: (sealRow?.current_hash as string | undefined) ?? null,
    };
  },
};
