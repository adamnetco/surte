// Public endpoint. WordPress calls this on publish/update.
// Hardened with HMAC SHA-256 signature (X-Sistecpos-Signature) using WP_REVALIDATE_SECRET.
// Per-tenant revalidate_token kept as legacy fallback.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wp-signature, x-sistecpos-signature",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const HMAC_SECRET = Deno.env.get("WP_REVALIDATE_SECRET") || "";

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get("site_id");
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    // 1) Validate HMAC signature against WP_REVALIDATE_SECRET
    if (HMAC_SECRET) {
      const provided = (req.headers.get("x-sistecpos-signature") || "").trim().toLowerCase();
      if (!provided) {
        return new Response(JSON.stringify({ error: "missing_signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expected = (await hmacHex(HMAC_SECRET, rawBody)).toLowerCase();
      const candidate = provided.startsWith("sha256=") ? provided.slice(7) : provided;
      if (!timingSafeEq(expected, candidate)) {
        return new Response(JSON.stringify({ error: "bad_signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2) Resolve tenant
    let cfg: any = null;
    if (siteId) {
      const { data } = await supabase
        .from("tenant_wp_config")
        .select("*, tenant_sites!inner(id,organization_id,slug)")
        .eq("site_id", siteId)
        .maybeSingle();
      cfg = data;
    } else if (body?.wp_base_url) {
      const host = new URL(body.wp_base_url).hostname;
      const { data } = await supabase
        .from("tenant_wp_config")
        .select("*, tenant_sites!inner(id,organization_id,slug)")
        .ilike("wp_base_url", `%${host}%`)
        .maybeSingle();
      cfg = data;
    }
    if (!cfg) {
      return new Response(JSON.stringify({ error: "tenant_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Legacy per-tenant token fallback (only when HMAC is not configured)
    if (!HMAC_SECRET) {
      const sigHeader = req.headers.get("x-wp-signature");
      if (
        cfg.revalidate_token &&
        sigHeader !== cfg.revalidate_token &&
        url.searchParams.get("token") !== cfg.revalidate_token
      ) {
        return new Response(JSON.stringify({ error: "bad_token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4) Forward revalidate to the tenant's target site
    let revalidateStatus: number | null = null;
    let revalidateError: string | null = null;
    if (cfg.revalidate_url) {
      try {
        const r = await fetch(cfg.revalidate_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Revalidate-Token": cfg.revalidate_token ?? "",
          },
          body: JSON.stringify({
            event: body?.action ?? "wp_update",
            post: body?.post ?? null,
            site_id: cfg.site_id,
          }),
        });
        revalidateStatus = r.status;
        if (!r.ok) revalidateError = await r.text();
      } catch (e) {
        revalidateError = String(e);
      }
    }

    // 5) Persist log + enqueue retry on failure
    await supabase.from("tenant_sync_log").insert({
      site_id: cfg.site_id,
      organization_id: cfg.tenant_sites.organization_id,
      kind: "revalidate",
      status: revalidateError ? "failed" : "ok",
      payload: { wp_action: body?.action ?? null, revalidate_status: revalidateStatus },
      error: revalidateError,
    });

    if (revalidateError && cfg.revalidate_url) {
      await supabase.from("sync_outbox").insert({
        target: "wp_revalidate",
        organization_id: cfg.tenant_sites.organization_id,
        payload: {
          revalidate_url: cfg.revalidate_url,
          revalidate_token: cfg.revalidate_token ?? null,
          site_id: cfg.site_id,
          event: body?.action ?? "wp_update",
          post: body?.post ?? null,
        },
        last_error: revalidateError,
      });
    }

    return new Response(
      JSON.stringify({ ok: !revalidateError, revalidate_status: revalidateStatus, error: revalidateError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
