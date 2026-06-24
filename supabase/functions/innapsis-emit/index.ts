import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Defaults compartidos (Innapsis FacturaE v30). El client_secret SOLO viene
// de secretos — si falta, la función se cae con 500 (sin fallback hardcoded).
const INNAPSIS_CLIENT_ID = Deno.env.get("INNAPSIS_CLIENT_ID") ?? "b899c906-fe51-4eba-a054-62ca2220452f";
const INNAPSIS_CLIENT_SECRET = Deno.env.get("INNAPSIS_CLIENT_SECRET");
// API key global de partner Innapsis (fallback si el tenant no tiene una propia).
const INNAPSIS_PARTNER_API_KEY = Deno.env.get("INNAPSIS_PARTNER_API_KEY");
const INNAPSIS_DEFAULTS = {
  client_id: INNAPSIS_CLIENT_ID,
  policy: "B2C_1A_FE_CLIENT_CREDENTIALS_V30",
  scope: "https://facturaeb2c.onmicrosoft.com/client-api/.default",
  token_url: "https://facturaeb2c.b2clogin.com/facturaeb2c.onmicrosoft.com/oauth2/v2.0/token",
  base_dev: "https://rt9g83x6z0.execute-api.us-east-1.amazonaws.com",
  base_prod: "https://nc8sa9bmte.execute-api.us-east-1.amazonaws.com",
};

const tokenCache = new Map<string, { token: string; exp: number }>();

async function getToken(nit: string, apiKey: string): Promise<string> {
  const key = `${nit}:${apiKey}`;
  const cached = tokenCache.get(key);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const url = `${INNAPSIS_DEFAULTS.token_url}?p=${INNAPSIS_DEFAULTS.policy}&saasTenantId=${encodeURIComponent(nit)}&apiKey=${encodeURIComponent(apiKey)}`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: INNAPSIS_DEFAULTS.client_id,
    client_secret: INNAPSIS_CLIENT_SECRET!,
    scope: INNAPSIS_DEFAULTS.scope,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Innapsis auth failed [${res.status}]: ${JSON.stringify(json)}`);
  }
  tokenCache.set(key, { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

// ===== Mapping helpers (Innapsis XML v1.9) =====
const r2 = (n: number) => Math.round(n * 100) / 100;

// Algoritmo DV DIAN (mod 11). Usado cuando el config no trae DV pre-calculado.
function calcDv(nit: string): string {
  const factors = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digits = nit.replace(/\D/g, "").split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * factors[i];
  const mod = sum % 11;
  return String(mod >= 2 ? 11 - mod : mod);
}

// Tipo identificación DIAN (13.2.1): 13 CC, 31 NIT, 22 Cédula extranjería, 41 Pasaporte
function detectTipoId(doc: string | null | undefined): string {
  if (!doc) return "13";
  const clean = doc.replace(/\D/g, "");
  if (clean.length >= 9) return "31"; // NIT
  return "13"; // CC por defecto
}

// Medio de pago DIAN 13.3.4.2
function mapMedioPago(method: string | null | undefined): string {
  switch ((method ?? "").toLowerCase()) {
    case "cash":
    case "efectivo": return "10";
    case "card":
    case "credit":
    case "debit":
    case "tarjeta": return "48";
    case "transfer":
    case "transferencia": return "42";
    case "nequi":
    case "daviplata":
    case "wallet": return "47";
    default: return "10";
  }
}

interface BuildInput {
  cfg: any;
  org: any;
  location: any | null;
  order: any;
  items: any[];
  payments: any[];
  number: number;
  trackId: string;
  documentType: "invoice" | "credit_note" | "debit_note";
}

function buildInnapsisPayload(input: BuildInput) {
  const { cfg, org, location, order, items, payments, number, trackId, documentType } = input;
  const now = new Date();
  const iso = now.toISOString();
  const fecha = iso.slice(0, 10);
  const hora = iso.slice(11, 19) + "-05:00";

  // Tipo documento Innapsis (no es el DIAN 380): 1=venta, 6=NC, 5=ND
  const tipoDoc = documentType === "credit_note" ? "6" : documentType === "debit_note" ? "5" : "1";

  const extra = cfg.extra ?? {};
  const locSettings = location?.settings ?? {};

  // ----- Emisor -----
  const emisorNit = String(cfg.nit ?? org.tax_id ?? "").replace(/\D/g, "");
  const emisorDv = cfg.dv ?? calcDv(emisorNit);
  const emisor = {
    TipoOrganizacion: String(extra.tipo_organizacion ?? "1"), // 1=Jurídica, 2=Natural
    TipoIdentificacion: "31", // NIT
    Identificacion: emisorNit,
    Dv: String(emisorDv),
    RazonSocial: cfg.razon_social ?? org.legal_name ?? org.name,
    Regimen: String(extra.regimen ?? "49"), // 49=No responsable IVA, 48=Responsable
    IdMunicipio: String(locSettings.municipio_code ?? extra.municipio_code ?? "68001"),
    Ciudad: location?.city ?? extra.ciudad ?? "Bucaramanga",
    CodigoPostal: String(locSettings.codigo_postal ?? extra.codigo_postal ?? "680001"),
    Departamento: locSettings.departamento ?? extra.departamento ?? "Santander",
    IdDepartamento: String(locSettings.departamento_code ?? extra.departamento_code ?? "68"),
    Direccion: location?.address ?? extra.direccion ?? "N/A",
    CodigoPais: "CO",
    Pais: "Colombia",
    Email: cfg.contact_email ?? org.support_email ?? "",
  };

  // ----- Receptor -----
  const customerDoc = String(order.customer_document ?? "222222222222").replace(/\D/g, "");
  const isFinalConsumer = customerDoc === "222222222222" || !order.customer_document;
  const tipoIdReceptor = isFinalConsumer ? "13" : detectTipoId(customerDoc);
  const dvReceptor = tipoIdReceptor === "31" ? calcDv(customerDoc) : null;
  const receptor: Record<string, unknown> = {
    TipoOrganizacion: tipoIdReceptor === "31" ? "1" : "2",
    TipoIdentificacion: tipoIdReceptor,
    Identificacion: customerDoc,
    RazonSocial: order.customer_name ?? "Consumidor Final",
    Regimen: "49",
    IdMunicipio: emisor.IdMunicipio,
    Ciudad: emisor.Ciudad,
    CodigoPostal: emisor.CodigoPostal,
    Departamento: emisor.Departamento,
    IdDepartamento: emisor.IdDepartamento,
    Direccion: order.customer_address ?? "N/A",
    CodigoPais: "CO",
    Pais: "Colombia",
    Email: order.customer_email ?? "",
  };
  if (dvReceptor !== null) receptor.Dv = dvReceptor;

  // ----- Detalles + agregación TaxTotal -----
  const taxByRate = new Map<number, { base: number; valor: number }>();
  const detalles = items.map((it: any, idx: number) => {
    const cantidad = Number(it.quantity ?? 1);
    const valorUnit = Number(it.unit_price ?? 0);
    const descuento = Number(it.discount ?? 0);
    const baseLinea = r2(cantidad * valorUnit - descuento);
    const tasaIva = Number(it.tax_rate ?? 0);
    const valorIva = Number(it.tax_amount ?? r2(baseLinea * tasaIva / 100));
    const totalLinea = r2(baseLinea + valorIva);
    const itemAfecto = tasaIva > 0;

    if (itemAfecto) {
      const prev = taxByRate.get(tasaIva) ?? { base: 0, valor: 0 };
      taxByRate.set(tasaIva, { base: r2(prev.base + baseLinea), valor: r2(prev.valor + valorIva) });
    }

    return {
      NumeroLinea: idx + 1,
      CodigoItem: it.sku ?? it.product_id ?? `LIN-${idx + 1}`,
      CantidadItem: cantidad,
      UnidadCantidad: "NIU",
      UnidadMedida: "NIU",
      DescripcionItem: it.product_name ?? it.name ?? "Item",
      TextoItem: it.product_name ?? it.name ?? "Item",
      MonedaItem: "COP",
      ValorItem: valorUnit,
      ItemAfecto: itemAfecto,
      CodImpuesto: "01", // IVA
      ValorImpuesto: valorIva,
      PorcentajeImpuesto: tasaIva,
      DescuentoItem: descuento || undefined,
      TotalItem: totalLinea,
    };
  });

  const taxTotal = Array.from(taxByRate.entries()).map(([porc, agg]) => ({
    BaseTaxTotal: agg.base,
    CodigoTax: "01",
    NombreTax: "IVA",
    PorcTax: porc,
    ValorTax: agg.valor,
  }));

  // ----- Totales -----
  const subtotal = Number(order.subtotal ?? detalles.reduce((s, d) => s + (d.ValorItem * d.CantidadItem), 0));
  const descuentoTotal = Number(order.discount ?? 0);
  const totalIva = Number(order.tax ?? taxTotal.reduce((s, t) => s + t.ValorTax, 0));
  const total = Number(order.total ?? r2(subtotal - descuentoTotal + totalIva));
  const baseAfecta = r2(taxTotal.reduce((s, t) => s + t.BaseTaxTotal, 0));
  const baseExcluida = r2(subtotal - descuentoTotal - baseAfecta);

  // ----- Pago -----
  const medioPago = mapMedioPago(payments[0]?.method);

  const fe = {
    Encabezado: {
      FechaEmision: fecha,
      HoraEmision: hora,
      TipoDocumento: tipoDoc,
      Prefijo: cfg.resolution_prefix ?? "",
      FolioAutorizado: number,
      Operacion: "10",
      FechaEntrega: fecha,
      HoraEntrega: hora,
    },
    CondicionesDePago: {
      FechaVencimiento: fecha,
      DescripcionDePago: "Contado",
      CondicionPago: "1",
      MedioDePago: medioPago,
    },
    Emisor: emisor,
    Receptor: receptor,
    Totales: {
      BaseAfecta: baseAfecta,
      BaseExcluida: baseExcluida > 0 ? baseExcluida : 0,
      Descuento: descuentoTotal || undefined,
      Moneda: "COP",
      TotalIva: totalIva,
      TotalFactura: total,
      TotalaPagar: total,
    },
    TaxTotal: taxTotal,
    Detalles: detalles,
  };

  return {
    trackId,
    Fe: fe,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!INNAPSIS_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "INNAPSIS_CLIENT_SECRET not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const reqBody = await req.json();
    const {
      organization_id: bodyOrgId,
      pos_order_id,
      order_id,
      document_type = "invoice",
      contingency_mode: contingencyModeRaw,
      transmit_invoice_id,
    } = reqBody;
    if (!bodyOrgId && !transmit_invoice_id) {
      return new Response(JSON.stringify({ error: "organization_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!transmit_invoice_id && !pos_order_id && !order_id) {
      return new Response(JSON.stringify({ error: "pos_order_id u order_id requeridos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // === Branch A: retransmisión de factura de contingencia (AC12) ===
    // Cuando DIAN se restaura, einvoice-contingency-flush invoca con transmit_invoice_id
    // para enviar la factura previamente emitida en contingencia, sin generar nueva numeración.
    let effectiveOrgId: string = bodyOrgId;
    let effectivePosOrderId: string | undefined = pos_order_id;
    let effectiveOrderId: string | undefined = order_id;
    let existingInvoice: any = null;

    if (transmit_invoice_id) {
      const { data: existing } = await admin
        .from("electronic_invoices")
        .select("*")
        .eq("id", transmit_invoice_id)
        .maybeSingle();
      if (!existing) {
        return new Response(JSON.stringify({ error: "invoice_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!existing.is_contingency || existing.transmitted_at) {
        return new Response(JSON.stringify({ error: "not_a_pending_contingency_invoice" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      existingInvoice = existing;
      effectiveOrgId = existing.organization_id;
      effectivePosOrderId = existing.pos_order_id ?? undefined;
      effectiveOrderId = existing.order_id ?? undefined;
    }

    // 0) Membresía (no aplica para retransmisión disparada por cron service-role)
    const { data: membership } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", effectiveOrgId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) Config activa + organización
    const [{ data: cfg }, { data: org }] = await Promise.all([
      admin.from("einvoice_configs").select("*").eq("organization_id", effectiveOrgId).eq("is_active", true).maybeSingle(),
      admin.from("organizations").select("id, name, legal_name, tax_id, support_email, city, region").eq("id", effectiveOrgId).single(),
    ]);

    if (!cfg) {
      return new Response(JSON.stringify({ error: "No hay configuración Innapsis activa para esta organización" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Orden + items + pagos + location
    let order: any = null;
    let items: any[] = [];
    let payments: any[] = [];
    if (effectivePosOrderId) {
      const [oRes, itRes, payRes] = await Promise.all([
        admin.from("pos_orders").select("*").eq("id", effectivePosOrderId).single(),
        admin.from("pos_order_items").select("*").eq("pos_order_id", effectivePosOrderId),
        admin.from("pos_payments").select("*").eq("pos_order_id", effectivePosOrderId),
      ]);
      order = oRes.data; items = itRes.data ?? []; payments = payRes.data ?? [];
    } else {
      const [oRes, itRes] = await Promise.all([
        admin.from("orders").select("*").eq("id", effectiveOrderId).single(),
        admin.from("order_items").select("*").eq("order_id", effectiveOrderId),
      ]);
      order = oRes.data; items = itRes.data ?? [];
    }
    if (!order) {
      return new Response(JSON.stringify({ error: "Orden no encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let location: any = null;
    if (order.location_id) {
      const { data: loc } = await admin.from("locations").select("*").eq("id", order.location_id).maybeSingle();
      location = loc;
    }

    // === Decide modo de emisión ===
    // contingencyMode = explícito por caller (offline real-time) o auto si el cron ya marcó offline.
    const contingencyRange = (cfg.contingency_range ?? null) as
      | { from?: number; to?: number; current?: number; prefix?: string }
      | null;
    const dianHealth = (cfg.dian_health_status ?? "online") as string;
    const requestedContingency = contingencyModeRaw === true;
    const autoContingency = dianHealth === "offline" && !!contingencyRange && !transmit_invoice_id;
    const useContingency = !transmit_invoice_id && (requestedContingency || autoContingency);

    // === Numeración ===
    let nextNumber: number;
    let usedPrefix: string;
    if (transmit_invoice_id) {
      nextNumber = Number(existingInvoice.number);
      usedPrefix = String(existingInvoice.prefix ?? "");
    } else if (useContingency) {
      if (!contingencyRange) {
        return new Response(JSON.stringify({ error: "contingency_range_not_configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cur = Number(contingencyRange.current ?? contingencyRange.from ?? 1);
      const max = Number(contingencyRange.to ?? Number.MAX_SAFE_INTEGER);
      if (cur > max) {
        return new Response(JSON.stringify({ error: "contingency_range_exhausted" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      nextNumber = cur;
      usedPrefix = String(contingencyRange.prefix ?? "SETC");
    } else {
      nextNumber = (cfg.resolution_current ?? cfg.resolution_from ?? 1) as number;
      usedPrefix = String(cfg.resolution_prefix ?? "");
    }
    const fullNumber = `${usedPrefix}${nextNumber}`;
    const trackId = transmit_invoice_id ? String(existingInvoice.track_id ?? crypto.randomUUID()) : crypto.randomUUID();

    const payload = buildInnapsisPayload({
      cfg: { ...cfg, resolution_prefix: usedPrefix },
      org, location, order, items, payments,
      number: nextNumber, trackId, documentType: document_type,
    });
    // Marca el XML para que Innapsis lo procese como contingencia (campo a confirmar con Innapsis v1.9).
    if (useContingency || (transmit_invoice_id && existingInvoice?.is_contingency)) {
      (payload.Fe.Encabezado as any).Contingencia = true;
    }

    // === Branch B: emisión en contingencia (AC11) — registra y NO llama a Innapsis ===
    if (useContingency) {
      const { data: cInv, error: cErr } = await admin.from("electronic_invoices").insert({
        organization_id: effectiveOrgId,
        location_id: order.location_id ?? null,
        document_type,
        pos_order_id: effectivePosOrderId ?? null,
        order_id: effectiveOrderId ?? null,
        prefix: usedPrefix,
        number: nextNumber,
        full_number: fullNumber,
        customer_identification: payload.Fe.Receptor.Identificacion,
        customer_name: payload.Fe.Receptor.RazonSocial,
        customer_email: (payload.Fe.Receptor as any).Email ?? null,
        subtotal: payload.Fe.Totales.BaseAfecta,
        tax_total: payload.Fe.Totales.TotalIva,
        total: payload.Fe.Totales.TotalaPagar,
        track_id: trackId,
        status: "contingency",
        is_contingency: true,
        contingency_emitted_at: new Date().toISOString(),
        request_payload: payload,
        environment: cfg.environment,
        created_by: userId,
      }).select().single();
      if (cErr) throw cErr;

      // Incrementar puntero del rango de contingencia
      await admin.from("einvoice_configs").update({
        contingency_range: { ...contingencyRange, current: nextNumber + 1 },
      }).eq("id", cfg.id);

      await admin.from("einvoice_events").insert({
        organization_id: effectiveOrgId,
        invoice_id: cInv.id,
        event_type: "contingency_emitted",
        status: "contingency",
        message: `Emitida en contingencia ${fullNumber} (DIAN ${dianHealth}). Pendiente transmisión.`,
        payload,
        performed_by: userId,
      });

      return new Response(JSON.stringify({
        success: true,
        contingency: true,
        invoice_id: cInv.id,
        full_number: fullNumber,
        track_id: trackId,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4) Registro pending — modo normal o retransmisión
    let inv: any;
    if (transmit_invoice_id) {
      const { data: upd, error: uErr } = await admin.from("electronic_invoices")
        .update({ status: "sending", request_payload: payload })
        .eq("id", transmit_invoice_id)
        .select()
        .single();
      if (uErr) throw uErr;
      inv = upd;
    } else {
      const { data: ins, error: invErr } = await admin.from("electronic_invoices").insert({
        organization_id: effectiveOrgId,
        location_id: order.location_id ?? null,
        document_type,
        pos_order_id: effectivePosOrderId ?? null,
        order_id: effectiveOrderId ?? null,
        prefix: usedPrefix,
        number: nextNumber,
        full_number: fullNumber,
        customer_identification: payload.Fe.Receptor.Identificacion,
        customer_name: payload.Fe.Receptor.RazonSocial,
        customer_email: (payload.Fe.Receptor as any).Email ?? null,
        subtotal: payload.Fe.Totales.BaseAfecta,
        tax_total: payload.Fe.Totales.TotalIva,
        total: payload.Fe.Totales.TotalaPagar,
        track_id: trackId,
        status: "sending",
        request_payload: payload,
        environment: cfg.environment,
        created_by: userId,
      }).select().single();
      if (invErr) throw invErr;
      inv = ins;
    }

    // 5) Llamada Innapsis
    try {
      const token = await getToken(cfg.nit, cfg.api_key || INNAPSIS_PARTNER_API_KEY || "");
      const baseUrl = cfg.environment === "prod" ? INNAPSIS_DEFAULTS.base_prod : INNAPSIS_DEFAULTS.base_dev;
      const endpoint = `${baseUrl}/api/v1/emision/emision/envieDocumento`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseJson = await res.json().catch(() => ({}));

      // 5xx => retry-eligible. 4xx => permanent error (no retry). 2xx => sent.
      const retryable = !res.ok && res.status >= 500;
      const status = res.ok ? "sent" : (retryable ? "retrying" : "error");

      let outboxId: string | null = null;
      if (retryable) {
        // Encolar retry server-side con backoff exponencial vía sync-outbox-flush.
        const { data: outbox } = await admin.from("sync_outbox").insert({
          organization_id: effectiveOrgId,
          target: "einvoice_emit_retry",
          payload: { invoice_id: inv.id, organization_id: effectiveOrgId },
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
          last_error: `HTTP ${res.status}`,
        }).select("id").maybeSingle();
        outboxId = outbox?.id ?? null;
      }

      await admin.from("electronic_invoices").update({
        status,
        dian_response: responseJson,
        last_error: res.ok ? null : `HTTP ${res.status}`,
        retry_count: retryable ? 0 : undefined,
        next_retry_at: retryable ? new Date(Date.now() + 60_000).toISOString() : null,
        outbox_id: outboxId,
        cufe: responseJson?.cufe ?? responseJson?.Cufe ?? null,
        qr_url: responseJson?.qr_url ?? responseJson?.QrUrl ?? null,
        xml_url: responseJson?.xml_url ?? responseJson?.XmlUrl ?? null,
        pdf_url: responseJson?.pdf_url ?? responseJson?.PdfUrl ?? null,
        transmitted_at: res.ok && transmit_invoice_id ? new Date().toISOString() : undefined,
      }).eq("id", inv.id);

      // Solo avanzar la resolución cuando NO sea retransmisión de contingencia
      // (la contingencia ya consumió su propio rango contingency_range.current).
      if (res.ok && !transmit_invoice_id) {
        await admin.from("einvoice_configs").update({
          resolution_current: nextNumber + 1,
        }).eq("id", cfg.id);
      }

      await admin.from("einvoice_events").insert({
        organization_id: effectiveOrgId,
        invoice_id: inv.id,
        event_type: retryable ? "emit_retry_scheduled" : "emit",
        status,
        message: res.ok
          ? "Documento enviado a Innapsis"
          : retryable
            ? `Innapsis HTTP ${res.status} — reintento encolado (1m, 5m, 30m, 2h, 12h)`
            : `Error HTTP ${res.status}`,
        payload,
        response: responseJson,
        performed_by: userId,
      });

      return new Response(JSON.stringify({
        success: res.ok,
        invoice_id: inv.id,
        track_id: trackId,
        retrying: retryable,
        response: responseJson,
      }), {
        status: res.ok ? 200 : (retryable ? 202 : 502),
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      // Error de red → tratamos como retryable
      const { data: outbox } = await admin.from("sync_outbox").insert({
        organization_id: effectiveOrgId,
        target: "einvoice_emit_retry",
        payload: { invoice_id: inv.id, organization_id: effectiveOrgId },
        status: "pending",
        attempts: 0,
        max_attempts: 5,
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        last_error: e.message,
      }).select("id").maybeSingle();

      await admin.from("electronic_invoices").update({
        status: "retrying",
        last_error: e.message,
        next_retry_at: new Date(Date.now() + 60_000).toISOString(),
        outbox_id: outbox?.id ?? null,
      }).eq("id", inv.id);

      await admin.from("einvoice_events").insert({
        organization_id: effectiveOrgId,
        invoice_id: inv.id,
        event_type: "emit_retry_scheduled",
        status: "retrying",
        message: `Error de red — reintento encolado: ${e.message}`,
        payload,
        performed_by: userId,
      });

      return new Response(JSON.stringify({
        success: false,
        invoice_id: inv.id,
        track_id: trackId,
        retrying: true,
        error: e.message,
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err: any) {
    console.error("innapsis-emit error", err);
    return new Response(JSON.stringify({ error: err.message ?? "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
