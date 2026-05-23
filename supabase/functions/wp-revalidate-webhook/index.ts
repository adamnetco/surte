// Public endpoint. WordPress llama aquí al publicar/actualizar contenido.
// Resuelve el tenant a partir del Host del WP o un `site_id` query y dispara
// el revalidate_url configurado (Astro/Vercel/Netlify) del cliente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wp-signature",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get("site_id");
    const body = await req.json().catch(() => ({} as any));

    let cfg: any = null;
    if (siteId) {
      const { data } = await supabase.from("tenant_wp_config").select("*, tenant_sites!inner(id,organization_id,slug)").eq("site_id", siteId).maybeSingle();
      cfg = data;
    } else if (body?.wp_base_url) {
      const host = new URL(body.wp_base_url).hostname;
      const { data } = await supabase.from("tenant_wp_config").select("*, tenant_sites!inner(id,organization_id,slug)").ilike("wp_base_url", `%${host}%`).maybeSingle();
      cfg = data;
    }
    if (!cfg) return new Response(JSON.stringify({ error: "tenant_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // valida token compartido (opcional)
    const sigHeader = req.headers.get("x-wp-signature");
    if (cfg.revalidate_token && sigHeader !== cfg.revalidate_token && url.searchParams.get("token") !== cfg.revalidate_token) {
      return new Response(JSON.stringify({ error: "bad_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let revalidateStatus: number | null = null;
    let revalidateError: string | null = null;
    if (cfg.revalidate_url) {
      try {
        const r = await fetch(cfg.revalidate_url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Revalidate-Token": cfg.revalidate_token ?? "" },
          body: JSON.stringify({ event: body?.action ?? "wp_update", post: body?.post ?? null, site_id: cfg.site_id }),
        });
        revalidateStatus = r.status;
        if (!r.ok) revalidateError = await r.text();
      } catch (e) { revalidateError = String(e); }
    }

    await supabase.from("tenant_sync_log").insert({
      site_id: cfg.site_id,
      organization_id: cfg.tenant_sites.organization_id,
      kind: "revalidate",
      status: revalidateError ? "failed" : "ok",
      payload: { wp_action: body?.action ?? null, revalidate_status: revalidateStatus },
      error: revalidateError,
    });

    return new Response(JSON.stringify({ ok: !revalidateError, revalidate_status: revalidateStatus, error: revalidateError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
