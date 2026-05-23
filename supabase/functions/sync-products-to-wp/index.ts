// Sincroniza productos de la organización del usuario hacia el WordPress
// configurado en tenant_wp_config, como Custom Post Types (default: "producto").
// Usa wp_app_user + wp_app_password (Application Password) vía REST API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { site_id, limit = 100 } = await req.json();
    if (!site_id) return new Response(JSON.stringify({ error: "site_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: cfg } = await supabase
      .from("tenant_wp_config")
      .select("*, tenant_sites!inner(organization_id)")
      .eq("site_id", site_id).maybeSingle();
    if (!cfg) return new Response(JSON.stringify({ error: "tenant_wp_config not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!cfg.wp_base_url || !cfg.wp_app_user || !cfg.wp_app_password) {
      return new Response(JSON.stringify({ error: "WP not fully configured (url + user + app password)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orgId = cfg.tenant_sites.organization_id;
    const cpt = cfg.product_cpt || "producto";

    // membership check
    const { data: m } = await supabase.from("organization_members").select("id")
      .eq("organization_id", orgId).eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
    if (!m) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: products } = await supabase
      .from("products")
      .select("id,name,slug,description,price,image_url,sku,gtin,brand,is_active,updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    const basicAuth = "Basic " + btoa(`${cfg.wp_app_user}:${cfg.wp_app_password}`);
    const wpRoot = cfg.wp_base_url.replace(/\/$/, "");
    let succeeded = 0, failed = 0;
    const errors: any[] = [];

    for (const p of products ?? []) {
      try {
        // 1) busca si ya existe (meta query por sku)
        const findRes = await fetch(`${wpRoot}/wp-json/wp/v2/${cpt}?slug=${encodeURIComponent(p.slug || p.id)}&per_page=1`, { headers: { Authorization: basicAuth } });
        const found = findRes.ok ? await findRes.json() : [];
        const exists = Array.isArray(found) && found.length > 0 ? found[0] : null;

        const payload = {
          title: p.name,
          status: "publish",
          slug: p.slug || p.id,
          content: p.description ?? "",
          meta: {
            supabase_id: p.id,
            sku: p.sku ?? null,
            gtin: p.gtin ?? null,
            brand: p.brand ?? null,
            price: p.price ?? null,
            image_url: p.image_url ?? null,
          },
        };

        const endpoint = exists ? `${wpRoot}/wp-json/wp/v2/${cpt}/${exists.id}` : `${wpRoot}/wp-json/wp/v2/${cpt}`;
        const res = await fetch(endpoint, {
          method: exists ? "POST" : "POST", // WP REST acepta POST en ambos
          headers: { Authorization: basicAuth, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const t = await res.text();
          failed++;
          errors.push({ product: p.id, status: res.status, body: t.slice(0, 200) });
        } else { succeeded++; }
      } catch (e) {
        failed++;
        errors.push({ product: p.id, error: String(e) });
      }
    }

    await supabase.from("tenant_wp_config").update({ last_sync_at: new Date().toISOString() }).eq("site_id", site_id);
    await supabase.from("tenant_sync_log").insert({
      site_id, organization_id: orgId, kind: "products",
      status: failed === 0 ? "ok" : (succeeded === 0 ? "failed" : "partial"),
      total: products?.length ?? 0, succeeded, failed,
      payload: { cpt, errors: errors.slice(0, 25) },
      error: failed > 0 ? `${failed} fallidos` : null,
    });

    return new Response(JSON.stringify({ total: products?.length ?? 0, succeeded, failed, errors: errors.slice(0, 10) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
