// Resuelve un host a su tenant. Público (sin JWT) para que el Astro de cada cliente lo consuma.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const host = (url.searchParams.get("host") ?? req.headers.get("x-forwarded-host") ?? "")
      .toLowerCase().replace(/^www\./, "");
    if (!host) return json({ error: "host required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.rpc("resolve_tenant_by_host", { _host: host });
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "tenant_not_found", host }, 404);
    return json(data, 200, 300); // cache 5 min CDN
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function json(b: unknown, status = 200, cache = 0) {
  return new Response(JSON.stringify(b), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(cache ? { "Cache-Control": `public, s-maxage=${cache}, stale-while-revalidate=60` } : {}),
    },
  });
}
