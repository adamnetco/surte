// SistecPOS Public REST API v1.
// Auth: Authorization: Bearer sk_<prefix>_<secret>
// Rate limit: 120 req/min per key (sliding 1-minute bucket).
//
// GET routes (read-only):
//   /v1/me
//   /v1/pos-orders?limit=50&since=<iso>
//   /v1/electronic-invoices?limit=50&since=<iso>
//   /v1/products?limit=100
//
// POST routes (write):
//   /v1/pos-orders                       scope: pos_orders:write
//     body: { customer_name?, customer_document?, location_id, cash_session_id,
//             items: [{ product_name, sku?, quantity, unit_price, tax_rate?, discount? }],
//             payment_method?, notes?, external_ref? }
//   /v1/pos-orders/:id/emit-invoice      scope: einvoices:write
//     body: { document_type?: "invoice" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MAX_PER_MIN = 120;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...corsHeaders, "content-type": "application/json", ...extra };
  const code = (body as any)?.error?.code;
  if (code) headers["x-internal-error-code"] = String(code);
  return new Response(JSON.stringify(body), { status, headers });
}

function errBody(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message, ...extra } };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = performance.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  const logCtx: { orgId?: string; keyId?: string; prefix?: string; path?: string } = {};
  const sbLog = createClient(SUPABASE_URL, SERVICE_KEY);
  const writeLog = async (status: number, errorCode?: string) => {
    if (!logCtx.orgId) return;
    try {
      await sbLog.from("api_request_logs").insert({
        organization_id: logCtx.orgId,
        api_key_id: logCtx.keyId ?? null,
        key_prefix: logCtx.prefix ?? null,
        method: req.method,
        path: logCtx.path ?? new URL(req.url).pathname,
        status_code: status,
        latency_ms: Math.round(performance.now() - t0),
        ip, user_agent: ua,
        error_code: errorCode ?? null,
      });
    } catch { /* never break the response on log failure */ }
  };
  const respond = async (res: Response, errorCode?: string) => {
    await writeLog(res.status, errorCode);
    return res;
  };
  if (req.method !== "GET" && req.method !== "POST") {
    return respond(json(errBody("METHOD_NOT_ALLOWED", "Only GET and POST supported"), 405), "METHOD_NOT_ALLOWED");
  }
  logCtx.path = new URL(req.url).pathname;

  // ---- Auth ----
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(sk_[A-Za-z0-9]+_[A-Za-z0-9_-]+)$/);
  if (!m) return respond(json(errBody("UNAUTHORIZED", "Missing or malformed Bearer token"), 401), "UNAUTHORIZED");
  const token = m[1];
  const parts = token.split("_");
  if (parts.length < 3) return respond(json(errBody("UNAUTHORIZED", "Malformed key"), 401), "UNAUTHORIZED");
  const prefix = `${parts[0]}_${parts[1]}`;
  const secret = parts.slice(2).join("_");
  const hash = await sha256Hex(secret);
  logCtx.prefix = prefix;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: consume, error: rpcErr } = await sb.rpc("api_key_consume", {
    p_prefix: prefix, p_hash: hash, p_max_per_min: MAX_PER_MIN,
  });
  if (rpcErr) return respond(json(errBody("INTERNAL", rpcErr.message), 500), "INTERNAL");
  const c = consume as { ok: boolean; reason?: string; organization_id?: string; scopes?: string[]; limit?: number; remaining?: number; reset_at?: string };

  const rlHeaders: Record<string, string> = c.limit
    ? {
        "x-ratelimit-limit": String(c.limit),
        "x-ratelimit-remaining": String(c.remaining ?? 0),
        "x-ratelimit-reset": c.reset_at ? String(Math.floor(new Date(c.reset_at).getTime() / 1000)) : "",
      }
    : {};

  if (c.organization_id) {
    logCtx.orgId = c.organization_id;
    // Look up key id (best-effort) for per-key analytics
    const { data: keyRow } = await sb.from("api_keys").select("id").eq("prefix", prefix).maybeSingle();
    if (keyRow) logCtx.keyId = keyRow.id;
  }

  if (!c.ok) {
    if (c.reason === "rate_limited") {
      return respond(json(errBody("RATE_LIMIT_EXCEEDED", `Limit ${MAX_PER_MIN} req/min`, { retry_after_seconds: 60 }), 429, {
        ...rlHeaders, "retry-after": "60",
      }), "RATE_LIMIT_EXCEEDED");
    }
    return respond(json(errBody("UNAUTHORIZED", `Key ${c.reason}`), 401), "UNAUTHORIZED");
  }

  const orgId = c.organization_id!;
  const scopes = c.scopes ?? [];
  const need = (scope: string) => scopes.includes("*") || scopes.includes(scope);

  // ---- Routing (wrapped so we can log every response) ----
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/public-api/, "").replace(/^\/v1/, "") || "/";
  logCtx.path = path;

  const response = await (async (): Promise<Response> => {

  // -------- GET --------
  if (req.method === "GET") {

    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
    const since = url.searchParams.get("since");

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
  }

  // -------- POST --------
  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  // POST /pos-orders -> create a sale
  if (path === "/pos-orders") {
    if (!need("pos_orders:write")) return json(errBody("FORBIDDEN", "Missing scope pos_orders:write"), 403, rlHeaders);

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return json(errBody("VALIDATION_ERROR", "items[] required (>=1)"), 422, rlHeaders);
    }
    if (!body.location_id || !body.cash_session_id) {
      return json(errBody("VALIDATION_ERROR", "location_id and cash_session_id are required"), 422, rlHeaders);
    }

    // Validate session belongs to org
    const { data: sess, error: sessErr } = await sb.from("cash_sessions")
      .select("id,status,cashier_id,organization_id,location_id")
      .eq("id", body.cash_session_id).maybeSingle();
    if (sessErr || !sess) return json(errBody("VALIDATION_ERROR", "cash_session not found"), 422, rlHeaders);
    if (sess.organization_id !== orgId) return json(errBody("FORBIDDEN", "Session belongs to another org"), 403, rlHeaders);
    if (sess.status !== "open") return json(errBody("VALIDATION_ERROR", "cash_session is not open"), 422, rlHeaders);
    if (sess.location_id !== body.location_id) return json(errBody("VALIDATION_ERROR", "location_id does not match session"), 422, rlHeaders);

    // Compute totals from items (server-side; trust nothing from client)
    let subtotal = 0, tax = 0, discount = 0;
    const norm = items.map((it: any, i: number) => {
      const qty = Number(it.quantity ?? 0);
      const price = Number(it.unit_price ?? 0);
      const rate = Number(it.tax_rate ?? 0);
      const disc = Number(it.discount ?? 0);
      if (!it.product_name || qty <= 0 || price < 0) {
        throw new Error(`item[${i}] invalid (product_name, quantity>0, unit_price>=0)`);
      }
      const lineGross = qty * price;
      const lineNet = Math.max(0, lineGross - disc);
      const lineTax = Math.round(lineNet * rate) / 100; // rate as % integer or decimal — accept both
      subtotal += lineNet;
      discount += disc;
      tax += lineTax;
      return {
        organization_id: orgId,
        product_name: String(it.product_name).slice(0, 200),
        sku: it.sku ? String(it.sku).slice(0, 80) : null,
        quantity: qty,
        unit_price: price,
        discount: disc,
        tax_rate: rate,
        tax_amount: lineTax,
        total: lineNet + lineTax,
      };
    });
    let validatedItems: any[];
    try { validatedItems = norm; } catch (e) {
      return json(errBody("VALIDATION_ERROR", (e as Error).message), 422, rlHeaders);
    }
    const total = Math.round((subtotal + tax) * 100) / 100;
    const method = String(body.payment_method ?? "cash");

    // Idempotency: client may pass external_ref; we map it to client_uuid (deterministic UUIDv5-like via SHA-1 not available, so use a namespaced prefix). To stay safe we accept a raw uuid in external_ref.
    const externalRef = body.external_ref ? String(body.external_ref).trim() : null;
    const isUuid = externalRef && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalRef);
    const clientUuid = isUuid ? externalRef : null;
    if (clientUuid) {
      const { data: dup } = await sb.from("pos_orders").select("id,ticket_number,total")
        .eq("organization_id", orgId)
        .eq("client_uuid", clientUuid).maybeSingle();
      if (dup) {
        return json({ ...dup, idempotent: true }, 200, rlHeaders);
      }
    }


    const { data: order, error: oErr } = await sb.from("pos_orders").insert({
      organization_id: orgId,
      location_id: body.location_id,
      cash_session_id: body.cash_session_id,
      cashier_id: sess.cashier_id,
      customer_document: body.customer_document ?? null,
      customer_name: body.customer_name ?? "Consumidor Final",
      subtotal,
      discount,
      tax,
      tip: 0,
      total,
      amount_paid: total,
      change_due: 0,
      status: "completed",
      sale_mode: "api",
      paid_at: new Date().toISOString(),
      notes: body.notes ?? null,
      client_uuid: clientUuid,
      metadata: { source: "public-api", key_prefix: prefix, external_ref: externalRef },

    }).select("id,ticket_number").single();

    if (oErr || !order) {
      return json(errBody("INSERT_ERROR", oErr?.message ?? "insert failed"), 500, rlHeaders);
    }

    const itemsPayload = validatedItems.map((it) => ({ ...it, pos_order_id: order.id }));
    const { error: itErr } = await sb.from("pos_order_items").insert(itemsPayload);
    if (itErr) {
      await sb.from("pos_orders").delete().eq("id", order.id);
      return json(errBody("INSERT_ERROR", `items: ${itErr.message}`), 500, rlHeaders);
    }

    await sb.from("pos_payments").insert({
      organization_id: orgId,
      pos_order_id: order.id,
      method,
      amount: total,
    });

    return json({ id: order.id, ticket_number: order.ticket_number, total, subtotal, tax, discount }, 201, rlHeaders);
  }

  // POST /pos-orders/:id/emit-invoice
  const emitMatch = path.match(/^\/pos-orders\/([0-9a-f-]{36})\/emit-invoice$/);
  if (emitMatch) {
    if (!need("einvoices:write")) return json(errBody("FORBIDDEN", "Missing scope einvoices:write"), 403, rlHeaders);
    const posOrderId = emitMatch[1];

    const { data: ord, error: ordErr } = await sb.from("pos_orders")
      .select("id,organization_id,status").eq("id", posOrderId).maybeSingle();
    if (ordErr || !ord) return json(errBody("NOT_FOUND", "pos_order not found"), 404, rlHeaders);
    if (ord.organization_id !== orgId) return json(errBody("FORBIDDEN", "Order belongs to another org"), 403, rlHeaders);

    const docType = String(body.document_type ?? "invoice");

    const emitRes = await fetch(`${SUPABASE_URL}/functions/v1/innapsis-emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({
        organization_id: orgId,
        pos_order_id: posOrderId,
        document_type: docType,
      }),
    });
    const emitJson = await emitRes.json().catch(() => ({}));
    if (!emitRes.ok) {
      return json(errBody("EMIT_FAILED", emitJson?.error ?? `HTTP ${emitRes.status}`, { provider: emitJson }), 502, rlHeaders);
    }
    return json({ ok: true, pos_order_id: posOrderId, result: emitJson }, 200, rlHeaders);
  }

  return json(errBody("NOT_FOUND", `Unknown route ${path}`), 404, rlHeaders);
});
