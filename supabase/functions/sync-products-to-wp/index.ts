// Sincroniza productos hacia WordPress como Custom Post Types.
// - Credenciales SOLO desde Deno.env / tenant_wp_config (nunca frontend).
// - Idempotente: busca por slug antes de crear; usa el ID existente para update.
// - Exponential backoff (1s/5s/30s) por request transitorio (5xx/429/red).
// - Auditoría completa via sync_logs (RPC log_sync_event).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  adminClient,
  startSyncLog,
  finishSyncLog,
  withRetry,
  isTransientHttpError,
} from "../_shared/syncLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

class HttpError extends Error {
  constructor(public status: number, message: string, public body?: string) {
    super(message);
  }
}

async function wpFetch(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(res.status, `WP ${res.status} ${res.statusText}`, body.slice(0, 300));
  }
  return res.json().catch(() => null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sbAdmin = adminClient();
  let logHandle: Awaited<ReturnType<typeof startSyncLog>> | null = null;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const { site_id, limit = 100 } = await req.json();
    if (!site_id) return json({ error: "site_id required" }, 400);

    const { data: cfg } = await supabase
      .from("tenant_wp_config")
      .select("*, tenant_sites!inner(organization_id)")
      .eq("site_id", site_id).maybeSingle();
    if (!cfg) return json({ error: "tenant_wp_config not found" }, 404);
    if (!cfg.wp_base_url || !cfg.wp_app_user || !cfg.wp_app_password) {
      return json({ error: "WP not fully configured (url + user + app password)" }, 400);
    }

    const orgId = cfg.tenant_sites.organization_id;
    const cpt = cfg.product_cpt || "producto";

    // membership check
    const { data: m } = await supabase.from("organization_members").select("id")
      .eq("organization_id", orgId).eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
    if (!m) return json({ error: "forbidden" }, 403);

    logHandle = await startSyncLog(sbAdmin, "sync-products-to-wp", orgId, { site_id, cpt, limit });

    // Etapa 30: filtrar por organization_id explícitamente (service_role bypassa RLS)
    const { data: products } = await supabase
      .from("products")
      .select("id,name,slug,description,price,image_url,sku,gtin,brand,is_active,updated_at")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    const basicAuth = "Basic " + btoa(`${cfg.wp_app_user}:${cfg.wp_app_password}`);
    const wpRoot = cfg.wp_base_url.replace(/\/$/, "");
    let succeeded = 0, failed = 0, totalAttempts = 0;
    const errors: any[] = [];

    for (const p of products ?? []) {
      try {
        // 1) IDEMPOTENCIA: ¿ya existe el post con ese slug?
        const found = await withRetry(
          () => wpFetch(
            `${wpRoot}/wp-json/wp/v2/${cpt}?slug=${encodeURIComponent(p.slug || p.id)}&per_page=1`,
            { headers: { Authorization: basicAuth } },
          ),
          {
            shouldRetry: (e) => e instanceof HttpError ? isTransientHttpError(e) : true,
            onRetry: (e, a, d) => console.warn(`[wp GET retry ${a}] ${(e as Error).message} (next ${d}ms)`),
          },
        );
        totalAttempts += found.attempts;
        const exists = Array.isArray(found.value) && found.value.length > 0 ? found.value[0] : null;

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

        const endpoint = exists
          ? `${wpRoot}/wp-json/wp/v2/${cpt}/${exists.id}`
          : `${wpRoot}/wp-json/wp/v2/${cpt}`;

        // 2) UPSERT con reintento exponencial
        const writeRes = await withRetry(
          () => wpFetch(endpoint, {
            method: "POST",
            headers: { Authorization: basicAuth, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
          {
            shouldRetry: (e) => e instanceof HttpError ? isTransientHttpError(e) : true,
            onRetry: (e, a, d) => console.warn(`[wp POST retry ${a}] ${(e as Error).message} (next ${d}ms)`),
          },
        );
        totalAttempts += writeRes.attempts;
        succeeded++;
      } catch (e) {
        failed++;
        const err = e as HttpError;
        const detail = err instanceof HttpError
          ? { status: err.status, body: err.body }
          : { error: String(e) };

        errors.push({ product: p.id, ...detail });

        // Encolar para reintento posterior (resiliencia diferida via sync_outbox)
        await sbAdmin.from("sync_outbox").insert({
          target: "wp_product",
          payload: { site_id, product_id: p.id, cpt },
          organization_id: orgId,
          status: "failed",
          last_error: (err.message ?? String(e)).slice(0, 500),
          next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        }).then(() => {}, (err2) => console.warn("outbox enqueue failed", err2));
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

    const finalStatus = failed === 0 ? "success" : (succeeded === 0 ? "error" : "partial");
    if (logHandle) {
      logHandle.attempts = totalAttempts;
      await finishSyncLog(sbAdmin, logHandle, finalStatus, {
        error: failed > 0 ? `${failed} fallidos de ${products?.length ?? 0}` : null,
        payload: { total: products?.length ?? 0, succeeded, failed, sample_errors: errors.slice(0, 5) },
      });
    }

    return json({ total: products?.length ?? 0, succeeded, failed, errors: errors.slice(0, 10) });
  } catch (e) {
    if (logHandle) {
      await finishSyncLog(sbAdmin, logHandle, "error", { error: String(e) });
    }
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
