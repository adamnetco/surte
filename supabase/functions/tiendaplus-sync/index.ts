// tiendaplus-sync — Conector de doble vía con "Tienda Plus by SistecPOS".
//
// La llave `tp_pos_...` vive SOLO aquí (columna `api_key`, sin GRANT para
// authenticated). El navegador nunca la ve: solo el prefijo enmascarado.
//
// Acciones (POST { action, organization_id, ... }):
//   save_credentials | ping | set_flags | set_exposure
//   push_catalog | pull_catalog | pull_orders | charge | charge_status
import {
  corsHeaders,
  jsonResponse,
  serviceClient,
  requireAuth,
  requireMembership,
} from "../_shared/tenant-guard.ts";

type Json = Record<string, unknown>;

const DEFAULT_BASE = "https://tiendasysbopos.lovable.app";

interface ConnRow {
  id: string;
  organization_id: string;
  base_url: string;
  api_key: string | null;
  api_key_prefix: string | null;
  scopes: string[];
  enabled: boolean;
  exposed: boolean;
  allow_owner_manage: boolean;
  sync_catalog: boolean;
  sync_orders: boolean;
  sync_payments: boolean;
  orders_cursor: string | null;
  catalog_cursor: string | null;
}

function normalizeBase(url: string): string {
  const raw = (url || DEFAULT_BASE).trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(raw)) throw new Error("base_url_must_be_https");
  return raw;
}

async function remote(
  conn: Pick<ConnRow, "base_url" | "api_key">,
  path: string,
  init: { method?: string; body?: Json; query?: Record<string, string> } = {},
): Promise<{ status: number; body: any; unsupported: boolean }> {
  const base = normalizeBase(conn.base_url);
  const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : "";
  const res = await fetch(`${base}${path}${qs}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": conn.api_key ?? "",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 500) }; }
  return { status: res.status, body, unsupported: res.status === 404 || res.status === 501 };
}

async function log(
  svc: any,
  organization_id: string,
  entry: {
    direction: "push" | "pull" | "payment";
    entity: string;
    status: "success" | "error" | "partial" | "unsupported";
    items?: number;
    ok_count?: number;
    failed_count?: number;
    detail?: Json;
  },
) {
  await svc.from("tiendaplus_sync_log").insert({
    organization_id,
    direction: entry.direction,
    entity: entry.entity,
    status: entry.status,
    items: entry.items ?? 0,
    ok_count: entry.ok_count ?? 0,
    failed_count: entry.failed_count ?? 0,
    detail: entry.detail ?? {},
  });
}

async function getConn(svc: any, orgId: string): Promise<ConnRow | null> {
  const { data } = await svc
    .from("tiendaplus_connections")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return (data as ConnRow) ?? null;
}

async function isSuperadmin(svc: any, userId: string, isServiceRole: boolean) {
  if (isServiceRole) return true;
  const { data: master } = await svc.rpc("is_master_superadmin", { _user_id: userId });
  if (master === true) return true;
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", userId);
  return Boolean(roles?.some((r: any) => r.role === "superadmin"));
}

/** Un tenant solo puede autogestionarse si el superadmin lo expuso y delegó. */
function ownerCanManage(conn: ConnRow | null): boolean {
  return Boolean(conn?.exposed && conn?.allow_owner_manage);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const svc = serviceClient();
  const body = (await req.json().catch(() => ({}))) as Json;
  const action = String(body.action ?? "");
  const orgId = String(body.organization_id ?? "");
  if (!orgId) return jsonResponse({ error: "organization_id_required" }, 400);

  const member = await requireMembership(svc, auth.userId, orgId, auth.isServiceRole);
  if (member !== true) return member;

  const superadmin = await isSuperadmin(svc, auth.userId, auth.isServiceRole);
  let conn = await getConn(svc, orgId);

  const requireManage = () => {
    if (superadmin) return null;
    if (!ownerCanManage(conn)) return jsonResponse({ error: "forbidden_owner_manage_disabled" }, 403);
    return null;
  };

  const requireReady = (scope: "catalog" | "sales" | "payments") => {
    if (!conn?.api_key) return jsonResponse({ ok: false, error: "missing_api_key" }, 400);
    if (!conn.exposed) return jsonResponse({ ok: false, error: "store_not_exposed" }, 403);
    if (!conn.enabled) return jsonResponse({ ok: false, error: "integration_disabled" }, 409);
    if (!(conn.scopes ?? []).includes(scope)) {
      return jsonResponse({ ok: false, error: `missing_scope_${scope}` }, 403);
    }
    return null;
  };

  try {
    switch (action) {
      /* ------------------------------ configuración ----------------------------- */
      case "set_exposure": {
        if (!superadmin) return jsonResponse({ error: "forbidden" }, 403);
        const patch: Json = { organization_id: orgId };
        if (typeof body.exposed === "boolean") patch.exposed = body.exposed;
        if (typeof body.allow_owner_manage === "boolean") patch.allow_owner_manage = body.allow_owner_manage;
        const { error } = await svc
          .from("tiendaplus_connections")
          .upsert(patch, { onConflict: "organization_id" });
        if (error) return jsonResponse({ ok: false, error: error.message }, 500);
        return jsonResponse({ ok: true });
      }

      case "set_flags": {
        const denied = requireManage();
        if (denied) return denied;
        const patch: Json = {};
        for (const k of ["enabled", "sync_catalog", "sync_orders", "sync_payments"]) {
          if (typeof body[k] === "boolean") patch[k] = body[k];
        }
        if (!Object.keys(patch).length) return jsonResponse({ ok: true });
        const { error } = await svc
          .from("tiendaplus_connections")
          .upsert({ organization_id: orgId, ...patch }, { onConflict: "organization_id" });
        if (error) return jsonResponse({ ok: false, error: error.message }, 500);
        return jsonResponse({ ok: true });
      }

      case "save_credentials": {
        const denied = requireManage();
        if (denied) return denied;
        const baseUrl = normalizeBase(String(body.base_url ?? conn?.base_url ?? DEFAULT_BASE));
        const apiKey = typeof body.api_key === "string" && body.api_key.trim()
          ? body.api_key.trim()
          : conn?.api_key ?? null;
        if (!apiKey) return jsonResponse({ ok: false, error: "missing_api_key" }, 400);
        if (!apiKey.startsWith("tp_pos_")) {
          return jsonResponse({ ok: false, error: "invalid_key_prefix" }, 400);
        }

        const ping = await remote({ base_url: baseUrl, api_key: apiKey }, "/api/public/pos/ping");
        if (ping.status !== 200 || ping.body?.ok === false) {
          const error = ping.body?.error ?? `ping_failed_${ping.status}`;
          await svc.from("tiendaplus_connections").upsert(
            { organization_id: orgId, base_url: baseUrl, last_error: String(error) },
            { onConflict: "organization_id" },
          );
          await log(svc, orgId, { direction: "pull", entity: "ping", status: "error", detail: { error } });
          return jsonResponse({ ok: false, error: String(error) }, 400);
        }

        const company = ping.body?.company ?? {};
        const scopes = Array.isArray(ping.body?.scopes) ? ping.body.scopes : [];
        const { error } = await svc.from("tiendaplus_connections").upsert(
          {
            organization_id: orgId,
            base_url: baseUrl,
            api_key: apiKey,
            api_key_prefix: `${apiKey.slice(0, 11)}…${apiKey.slice(-4)}`,
            scopes,
            remote_company_id: company?.id ?? null,
            company_name: company?.name ?? null,
            currency_code: company?.currency ?? ping.body?.currency ?? "COP",
            last_ping_at: new Date().toISOString(),
            last_error: null,
          },
          { onConflict: "organization_id" },
        );
        if (error) return jsonResponse({ ok: false, error: error.message }, 500);
        await log(svc, orgId, { direction: "pull", entity: "ping", status: "success", detail: { scopes } });
        return jsonResponse({
          ok: true,
          companyName: company?.name ?? null,
          currencyCode: company?.currency ?? "COP",
          scopes,
          gateway: ping.body?.gateway ?? null,
        });
      }

      case "ping": {
        if (!conn?.api_key) return jsonResponse({ ok: false, error: "missing_api_key" }, 400);
        const ping = await remote(conn, "/api/public/pos/ping");
        const ok = ping.status === 200 && ping.body?.ok !== false;
        const scopes = Array.isArray(ping.body?.scopes) ? ping.body.scopes : conn.scopes;
        await svc.from("tiendaplus_connections").update({
          last_ping_at: new Date().toISOString(),
          scopes,
          company_name: ping.body?.company?.name ?? null,
          last_error: ok ? null : String(ping.body?.error ?? ping.status),
        }).eq("organization_id", orgId);
        await log(svc, orgId, {
          direction: "pull", entity: "ping",
          status: ok ? "success" : "error", detail: { status: ping.status },
        });
        return jsonResponse({
          ok,
          scopes,
          companyName: ping.body?.company?.name ?? null,
          currencyCode: ping.body?.company?.currency ?? conn.scopes ? undefined : undefined,
          gateway: ping.body?.gateway ?? null,
          error: ok ? undefined : String(ping.body?.error ?? `http_${ping.status}`),
        });
      }

      /* -------------------------------- catálogo -------------------------------- */
      case "push_catalog": {
        const notReady = requireReady("catalog");
        if (notReady) return notReady;
        const full = body.full === true;
        let q = svc
          .from("products")
          .select("id, name, price, sku, gtin, stock, is_active, image_url, updated_at")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: true })
          .limit(500);
        if (!full && conn!.catalog_cursor) q = q.gt("updated_at", conn!.catalog_cursor);
        const { data: products, error: prodErr } = await q;
        if (prodErr) return jsonResponse({ ok: false, error: prodErr.message }, 500);

        const items = (products ?? []).map((p: any) => ({
          externalId: p.id,
          name: String(p.name ?? "").trim(),
          price: Math.max(0, Math.round(Number(p.price ?? 0))),
          sku: p.sku ?? null,
          barcode: p.gtin ?? null,
          stock: Math.max(0, Math.trunc(Number(p.stock ?? 0))),
          active: p.is_active !== false,
          imageUrl: p.image_url ?? null,
          updatedAt: p.updated_at ?? null,
        }));
        if (!items.length) {
          await log(svc, orgId, { direction: "push", entity: "catalog", status: "success", detail: { note: "sin_cambios" } });
          return jsonResponse({ ok: true, pushed: 0 });
        }

        let pushed = 0, failed = 0, unsupported = false, lastError: string | null = null;
        for (let i = 0; i < items.length; i += 100) {
          const batch = items.slice(i, i + 100);
          const res = await remote(conn!, "/api/public/pos/catalog", {
            method: "POST",
            body: { items: batch },
          });
          if (res.unsupported) { unsupported = true; break; }
          if (res.status >= 200 && res.status < 300) pushed += batch.length;
          else { failed += batch.length; lastError = String(res.body?.error ?? `http_${res.status}`); }
        }

        const cursor = items[items.length - 1]?.updatedAt ?? null;
        await svc.from("tiendaplus_connections").update({
          catalog_cursor: unsupported ? conn!.catalog_cursor : cursor,
          last_sync_at: new Date().toISOString(),
          last_error: unsupported ? "catalog_endpoint_unsupported" : lastError,
        }).eq("organization_id", orgId);

        await log(svc, orgId, {
          direction: "push", entity: "catalog",
          status: unsupported ? "unsupported" : failed ? (pushed ? "partial" : "error") : "success",
          items: items.length, ok_count: pushed, failed_count: failed,
          detail: { error: lastError },
        });
        return jsonResponse({ ok: !failed && !unsupported, unsupported, pushed, failed, error: lastError ?? undefined });
      }

      case "pull_catalog": {
        const notReady = requireReady("catalog");
        if (notReady) return notReady;
        const res = await remote(conn!, "/api/public/pos/catalog", {
          query: conn!.catalog_cursor ? { updatedSince: conn!.catalog_cursor } : undefined,
        });
        if (res.unsupported) {
          await log(svc, orgId, { direction: "pull", entity: "catalog", status: "unsupported" });
          return jsonResponse({ ok: false, unsupported: true });
        }
        const remoteItems: any[] = Array.isArray(res.body?.items) ? res.body.items : [];
        let applied = 0;
        for (const it of remoteItems) {
          const price = Number(it.price ?? 0);
          const sku = it.sku ?? null;
          if (!sku) continue;
          const { error } = await svc
            .from("products")
            .update({ price })
            .eq("organization_id", orgId)
            .eq("sku", sku);
          if (!error) applied += 1;
        }
        await log(svc, orgId, {
          direction: "pull", entity: "catalog", status: "success",
          items: remoteItems.length, ok_count: applied,
        });
        return jsonResponse({ ok: true, pulled: applied });
      }

      /* --------------------------------- pedidos -------------------------------- */
      case "pull_orders": {
        const notReady = requireReady("sales");
        if (notReady) return notReady;
        const res = await remote(conn!, "/api/public/pos/sales", {
          query: conn!.orders_cursor ? { since: conn!.orders_cursor } : undefined,
        });
        if (res.unsupported) {
          await log(svc, orgId, { direction: "pull", entity: "orders", status: "unsupported" });
          return jsonResponse({ ok: false, unsupported: true });
        }
        if (res.status < 200 || res.status >= 300) {
          const error = String(res.body?.error ?? `http_${res.status}`);
          await log(svc, orgId, { direction: "pull", entity: "orders", status: "error", detail: { error } });
          return jsonResponse({ ok: false, error }, 502);
        }

        const orders: any[] = Array.isArray(res.body?.orders)
          ? res.body.orders
          : Array.isArray(res.body?.sales) ? res.body.sales : [];
        let inserted = 0, failed = 0, maxCreated = conn!.orders_cursor;

        for (const o of orders) {
          const ref = `TP:${o.id}`;
          const { data: exists } = await svc
            .from("orders")
            .select("id")
            .eq("organization_id", orgId)
            .eq("whatsapp_ref", ref)
            .maybeSingle();
          if (exists) continue;

          const items = (o.items ?? []).map((it: any) => {
            const quantity = Math.max(1, Math.trunc(Number(it.quantity ?? 1)));
            const unit = Math.max(0, Math.round(Number(it.unitPrice ?? it.unit_price ?? 0)));
            return {
              product_name: String(it.name ?? "Artículo").trim(),
              quantity,
              unit_price: unit,
              total_price: unit * quantity,
              organization_id: orgId,
            };
          });
          const subtotal = items.reduce((a: number, i: any) => a + i.total_price, 0);

          const { data: order, error } = await svc.from("orders").insert({
            organization_id: orgId,
            customer_name: String(o.customerName ?? o.customer_name ?? "Cliente Tienda Plus").trim(),
            customer_phone: String(o.customerPhone ?? o.customer_phone ?? "").trim(),
            customer_address: o.customerAddress ?? o.customer_address ?? null,
            subtotal,
            total: Math.max(0, Math.round(Number(o.total ?? subtotal))),
            status: "pendiente",
            whatsapp_ref: ref,
            notes: o.notes ?? "Pedido importado de Tienda Plus",
            external_sync_status: "sent",
            external_sync_sent_at: new Date().toISOString(),
          }).select("id").single();

          if (error || !order) { failed += 1; continue; }
          if (items.length) {
            await svc.from("order_items").insert(items.map((i: any) => ({ ...i, order_id: order.id })));
          }
          inserted += 1;
          const created = o.createdAt ?? o.created_at ?? null;
          if (created && (!maxCreated || created > maxCreated)) maxCreated = created;
        }

        await svc.from("tiendaplus_connections").update({
          orders_cursor: maxCreated,
          last_sync_at: new Date().toISOString(),
          last_error: failed ? `orders_failed_${failed}` : null,
        }).eq("organization_id", orgId);

        await log(svc, orgId, {
          direction: "pull", entity: "orders",
          status: failed ? (inserted ? "partial" : "error") : "success",
          items: orders.length, ok_count: inserted, failed_count: failed,
        });
        return jsonResponse({ ok: !failed, pulled: inserted, failed });
      }

      /* --------------------------------- cobros --------------------------------- */
      case "charge": {
        const notReady = requireReady("payments");
        if (notReady) return notReady;
        const amount = Math.round(Number(body.amount ?? 0));
        const reference = String(body.reference ?? "").trim();
        if (!amount || amount <= 0) return jsonResponse({ ok: false, error: "invalid_amount" }, 400);
        if (!reference) return jsonResponse({ ok: false, error: "reference_required" }, 400);

        const res = await remote(conn!, "/api/public/pos/payments", {
          method: "POST",
          body: {
            amount,
            referencia: reference,
            descripcion: body.description ?? "Cobro SistecPOS",
            idempotency_key: body.idempotency_key ?? reference,
          },
        });
        const ok = res.status >= 200 && res.status < 300;
        await log(svc, orgId, {
          direction: "payment", entity: "charge",
          status: ok ? "success" : "error",
          items: 1, ok_count: ok ? 1 : 0, failed_count: ok ? 0 : 1,
          detail: { reference, amount, status: res.status },
        });
        return jsonResponse({
          ok,
          reference,
          status: res.body?.estado ?? res.body?.status ?? (ok ? "pendiente" : "error"),
          externalId: res.body?.id ?? null,
          duplicated: res.body?.duplicated === true,
          error: ok ? undefined : String(res.body?.error ?? `http_${res.status}`),
        }, ok ? 200 : 502);
      }

      case "charge_status": {
        const notReady = requireReady("payments");
        if (notReady) return notReady;
        const reference = String(body.reference ?? "").trim();
        if (!reference) return jsonResponse({ ok: false, error: "reference_required" }, 400);
        const res = await remote(conn!, `/api/public/pos/payments/${encodeURIComponent(reference)}`);
        const ok = res.status >= 200 && res.status < 300;
        return jsonResponse({
          ok,
          reference,
          status: res.body?.estado ?? res.body?.status ?? "error",
          externalId: res.body?.id ?? null,
          error: ok ? undefined : String(res.body?.error ?? `http_${res.status}`),
        }, ok ? 200 : 502);
      }

      default:
        return jsonResponse({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("tiendaplus-sync failed:", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
