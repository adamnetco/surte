// Ola 5 · Slice 3 — Reintentos automáticos de facturación de comisión FX.
// Escaneado por pg_cron (cada 5 min). Selecciona fx_transactions con
// commission_invoice_status='failed' y commission_invoice_next_retry_at <= now()
// (o NULL legado), y reinvoca fx-emit-commission-invoice con bearer service-role.
// Backoff vive dentro de fx-emit-commission-invoice (1m → 5m → 30m → 2h → 12h, luego rinde).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_PER_RUN = 25;
const MAX_RETRIES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return j({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE);

  try {
    // Buscar candidatos: failed, con comisión > 0, retry_count < MAX, next_retry vencido o NULL.
    const nowIso = new Date().toISOString();
    const { data: candidates, error } = await admin
      .from("fx_transactions")
      .select("id, commission_amount, commission_invoice_retry_count, commission_invoice_next_retry_at")
      .eq("commission_invoice_status", "failed")
      .gt("commission_amount", 0)
      .lt("commission_invoice_retry_count", MAX_RETRIES)
      .or(`commission_invoice_next_retry_at.is.null,commission_invoice_next_retry_at.lte.${nowIso}`)
      .order("commission_invoice_next_retry_at", { ascending: true, nullsFirst: true })
      .limit(MAX_PER_RUN);
    if (error) throw error;

    const results: Array<{ id: string; ok: boolean; status?: number; error?: string }> = [];
    for (const tx of candidates ?? []) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/fx-emit-commission-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE}`,
            apikey: ANON,
          },
          body: JSON.stringify({ fx_transaction_id: tx.id }),
        });
        const ok = res.ok;
        const detail = await res.json().catch(() => ({}));
        results.push({ id: tx.id, ok, status: res.status, error: ok ? undefined : JSON.stringify(detail).slice(0, 200) });
      } catch (e: any) {
        results.push({ id: tx.id, ok: false, error: e?.message ?? String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return j({
      success: true,
      scanned: candidates?.length ?? 0,
      succeeded: okCount,
      failed: results.length - okCount,
      results,
    });
  } catch (e: any) {
    console.error("[fx-retry-commission-invoices]", e);
    return j({ error: "internal", message: e?.message ?? String(e) }, 500);
  }
});
