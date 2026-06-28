// SistecPOS Public REST API (read-only) v1.
// Auth: Authorization: Bearer sk_<prefix>_<secret>
// Rate limit: 120 req/min per key (sliding 1-minute bucket).
// Routes (GET only):
//   /v1/pos-orders?limit=50&since=<iso>
//   /v1/electronic-invoices?limit=50&since=<iso>
//   /v1/products?limit=100
//   /v1/me            -> info de la key (org, scopes, límites)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_PER_MIN = 120;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json", ...extra },
  });
}

function errBody(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message, ...extra } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") {
    return json(errBody("METHOD_NOT_ALLOWED", "Only GET supported"), 405);
  }

  // ---- Auth ----
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(sk_[A-Za-z0-9]+_[A-Za-z0-9_-]+)$/);
  if (!m) return json(errBody("UNAUTHORIZED", "Missing or malformed Bearer token"), 401);
  const token = m[1];
  const parts = token.split("_"); // sk, <prefix>, <secret>
  if (parts.length < 3) return json(errBody("UNAUTHORIZED", "Malformed key"), 401);
  const prefix = `${parts[0]}_${parts[1]}`;
  const secret = parts.slice(2).join("_");
  const hash = await sha256Hex(secret);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: consume, error: rpcErr } = await sb.rpc("api_key_consume", {
    p_prefix: prefix, p_hash: hash, p_max_per_min: MAX_PER_MIN,
  });
  if (rpcErr) return json(errBody("INTERNAL", rpcErr.message), 500);
  const c = consume as { ok: boolean; reason?: string; organization_id?: string; scopes?: string[]; limit?: number; remaining?: number; reset_at?: string };

  const rlHeaders: Record<string, string> = c.limit
    ? {
        "x-ratelimit-limit": String(c.limit),
        "x-ratelimit-remaining": String(c.remaining ?? 0),
        "x-ratelimit-reset": c.reset_at ? String(Math.floor(new Date(c.reset_at).getTime() / 1000)) : "",
      }
    : {};

  if (!c.ok) {
    if (c.reason === "rate_limited") {
      return json(errBody("RATE_LIMIT_EXCEEDED", `Limit ${MAX_PER_MIN} req/min`, { retry_after_seconds: 60 }), 429, {
        ...rlHeaders, "retry-after": "60",
      });
    }
    return json(errBody("UNAUTHORIZED", `Key ${c.reason}`), 401);
  }

  const orgId = c.organization_id!;
  const scopes = c.scopes ?? [];

  // ---- Routing ----
  const url = new URL(req.url);
  // strip "/v1/..." prefix tolerant to functions base path
  const path = url.pathname.replace(/^.*\/public-api/, "").replace(/^\/v1/, "") || "/";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const since = url.searchParams.get("since");

  const need = (scope: string) => scopes.includes("*") || scopes.includes(scope);

  if (path === "/" || path === "/me") {
    return json({ organization_id: orgId, scopes, limit: c.limit, remaining: c.remaining, reset_at: c.reset_at }, 200, rlHeaders);
  }

  if (path === "/pos-orders") {
    if (!need("pos_orders:read")) return json(errBody("FORBIDDEN", "Missing scope pos_orders:read"), 403, rlHeaders);
    let q = sb.from("pos_orders").select("id,ticket_number,total,status,customer_name,customer_document,paid_at,created_at,location_id")
      .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error) return json(errBody("QUERY_ERROR", error.message), 500, rlHeaders);
    return json({ data }, 200, rlHeaders);
  }

  if (path === "/electronic-invoices") {
    if (!need("einvoices:read")) return json(errBody("FORBIDDEN", "Missing scope einvoices:read"), 403, rlHeaders);
    let q = sb.from("electronic_invoices").select("id,document_type,full_number,cufe,total,status,customer_identification,customer_name,issue_date,qr_url,pdf_url,xml_url")
      .eq("organization_id", orgId).order("issue_date", { ascending: false }).limit(limit);
    if (since) q = q.gte("issue_date", since);
    const { data, error } = await q;
    if (error) return json(errBody("QUERY_ERROR", error.message), 500, rlHeaders);
    return json({ data }, 200, rlHeaders);
  }

  if (path === "/products") {
    if (!need("products:read")) return json(errBody("FORBIDDEN", "Missing scope products:read"), 403, rlHeaders);
    const { data, error } = await sb.from("products")
      .select("id,name,sku,barcode,price,is_active,category_id,brand_id")
      .eq("organization_id", orgId).order("name").limit(limit);
    if (error) return json(errBody("QUERY_ERROR", error.message), 500, rlHeaders);
    return json({ data }, 200, rlHeaders);
  }

  return json(errBody("NOT_FOUND", `Unknown route ${path}`), 404, rlHeaders);
});
