// Edge function: import-trm
// Fetches the latest TRM (Tasa Representativa del Mercado USD/COP) from datos.gov.co
// and returns it. Optionally publishes it for the caller's organization if pair_id provided.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TRM_ENDPOINT = "https://www.datos.gov.co/resource/32sa-8pi3.json";

interface TrmRow {
  valor: string;
  unidad: string;
  vigenciadesde: string;
  vigenciahasta: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(TRM_ENDPOINT);
    // Pull last 1, ordered desc by vigenciadesde
    url.searchParams.set("$order", "vigenciadesde DESC");
    url.searchParams.set("$limit", "1");

    const resp = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) throw new Error(`Banrep responded ${resp.status}`);
    const rows = (await resp.json()) as TrmRow[];
    if (!rows.length) throw new Error("Sin datos TRM");

    const row = rows[0];
    const trm = Number(row.valor);
    if (!Number.isFinite(trm) || trm <= 0) throw new Error("TRM inválida");

    const result = {
      trm,
      effective_from: row.vigenciadesde,
      effective_to: row.vigenciahasta,
      source: "datos.gov.co (Banco de la República)",
    };

    // Optional publish
    let publishedRateId: string | null = null;
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    if (body?.pair_id && body?.publish) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: pricingRules } = await supabase
        .from("fx_pricing_rules")
        .select("*")
        .eq("pair_id", body.pair_id)
        .maybeSingle();

      let buy = trm * 0.995;
      let sell = trm * 1.005;
      if (pricingRules) {
        buy = trm * (1 - Number(pricingRules.spread_buy_pct) / 100);
        sell = trm * (1 + Number(pricingRules.spread_sell_pct) / 100);
        if (pricingRules.min_buy && buy < pricingRules.min_buy) buy = pricingRules.min_buy;
        if (pricingRules.max_buy && buy > pricingRules.max_buy) buy = pricingRules.max_buy;
        if (pricingRules.min_sell && sell < pricingRules.min_sell) sell = pricingRules.min_sell;
        if (pricingRules.max_sell && sell > pricingRules.max_sell) sell = pricingRules.max_sell;
      }

      const { data: rateId, error } = await supabase.rpc("fx_publish_rate", {
        _pair_id: body.pair_id,
        _buy_rate: Number(buy.toFixed(2)),
        _sell_rate: Number(sell.toFixed(2)),
        _source: "trm_banrep",
        _base_rate: trm,
      });
      if (error) throw new Error(error.message);
      publishedRateId = rateId as string;
    }

    return new Response(
      JSON.stringify({ ...result, published_rate_id: publishedRateId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
