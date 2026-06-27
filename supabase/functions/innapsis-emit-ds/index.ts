// Innapsis - Emit Documento Soporte DIAN (TipoDocumento "11")
// Para compras a NO obligados a facturar electrónicamente (proveedores sin RUT FE).
// Nuestra organización es Emisor (acquirer) y el proveedor es Receptor (vendedor no-obligado).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INNAPSIS_CLIENT_ID = Deno.env.get("INNAPSIS_CLIENT_ID") ?? "b899c906-fe51-4eba-a054-62ca2220452f";
const INNAPSIS_CLIENT_SECRET = Deno.env.get("INNAPSIS_CLIENT_SECRET");
const INNAPSIS_PARTNER_API_KEY = Deno.env.get("INNAPSIS_PARTNER_API_KEY");
const TOKEN_URL = "https://facturaeb2c.b2clogin.com/facturaeb2c.onmicrosoft.com/oauth2/v2.0/token";
const SCOPE = "https://facturaeb2c.onmicrosoft.com/client-api/.default";
const POLICY = "B2C_1A_FE_CLIENT_CREDENTIALS_V30";
const BASE_DEV = "https://rt9g83x6z0.execute-api.us-east-1.amazonaws.com";
const BASE_PROD = "https://nc8sa9bmte.execute-api.us-east-1.amazonaws.com";

const r2 = (n: number) => Math.round(n * 100) / 100;

function calcDv(nit: string): string {
  const factors = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digits = nit.replace(/\D/g, "").split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * factors[i];
  const mod = sum % 11;
  return String(mod >= 2 ? 11 - mod : mod);
}

async function getToken(nit: string, apiKey: string): Promise<string> {
  const url = `${TOKEN_URL}?p=${POLICY}&saasTenantId=${encodeURIComponent(nit)}&apiKey=${encodeURIComponent(apiKey)}`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: INNAPSIS_CLIENT_ID,
    client_secret: INNAPSIS_CLIENT_SECRET!,
    scope: SCOPE,
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
  return json.access_token;
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
    const bearerToken = authHeader.replace("Bearer ", "");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceCall = bearerToken === SERVICE_KEY;

    let userId: string | null = null;
    if (!isServiceCall) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData, error: authErr } = await userClient.auth.getUser(bearerToken);
      if (authErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = userData.user.id;
    }

    const body = await req.json();
    const { purchase_order_id } = body ?? {};
    if (!purchase_order_id) {
      return new Response(JSON.stringify({ error: "purchase_order_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY);

    // 1) PO + items + supplier
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("*")
      .eq("id", purchase_order_id)
      .single();
    if (poErr || !po) {
      return new Response(JSON.stringify({ error: "PO no encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (po.ds_invoice_id) {
      return new Response(JSON.stringify({ error: "DS ya emitido", ds_invoice_id: po.ds_invoice_id }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orgId = po.organization_id;

    // Membresía
    if (!isServiceCall) {
      const { data: mem } = await admin
        .from("organization_members")
        .select("id, role")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (!mem) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const [{ data: items }, { data: supplier }, { data: org }, { data: cfg }] = await Promise.all([
      admin.from("purchase_order_items").select("*").eq("purchase_order_id", purchase_order_id),
      admin.from("suppliers").select("*").eq("id", po.supplier_id).single(),
      admin.from("organizations").select("id, name, legal_name, tax_id, support_email, city, region").eq("id", orgId).single(),
      admin.from("einvoice_configs").select("*").eq("organization_id", orgId).eq("is_active", true).maybeSingle(),
    ]);

    if (!supplier) {
      return new Response(JSON.stringify({ error: "Proveedor no encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!cfg) {
      return new Response(JSON.stringify({ error: "Config Innapsis no activa para esta organización" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Numeración DS (rango independiente). Lo guardamos en cfg.extra.ds_range = { prefix, from, to, current }
    const extra = (cfg.extra ?? {}) as Record<string, any>;
    const dsRange = extra.ds_range ?? { prefix: "DS", from: 1, to: 99999, current: 0 };
    const nextNumber = Number(dsRange.current ?? 0) + 1;
    if (nextNumber > Number(dsRange.to ?? 0)) {
      return new Response(JSON.stringify({ error: "Rango DS agotado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const prefix = String(dsRange.prefix ?? "DS");
    const trackId = `${prefix}${nextNumber}-${crypto.randomUUID().slice(0, 8)}`;

    // 3) Build payload Innapsis DS (TipoDocumento "11")
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const hora = now.toISOString().slice(11, 19) + "-05:00";

    const emisorNit = String(cfg.nit ?? org.tax_id ?? "").replace(/\D/g, "");
    const emisorDv = cfg.dv ?? calcDv(emisorNit);
    const emisor = {
      TipoOrganizacion: String(extra.tipo_organizacion ?? "1"),
      TipoIdentificacion: "31",
      Identificacion: emisorNit,
      Dv: String(emisorDv),
      RazonSocial: cfg.razon_social ?? org.legal_name ?? org.name,
      Regimen: String(extra.regimen ?? "48"),
      IdMunicipio: String(extra.municipio_code ?? "68001"),
      Ciudad: extra.ciudad ?? "Bucaramanga",
      CodigoPostal: String(extra.codigo_postal ?? "680001"),
      Departamento: extra.departamento ?? "Santander",
      IdDepartamento: String(extra.departamento_code ?? "68"),
      Direccion: extra.direccion ?? "N/A",
      CodigoPais: "CO",
      Pais: "Colombia",
      Email: cfg.contact_email ?? org.support_email ?? "",
    };

    const supDoc = String(supplier.tax_id ?? "").replace(/\D/g, "") || "222222222222";
    const tipoIdSup = (supplier.document_type_code ?? "CC") as string;
    const tipoIdMap: Record<string, string> = { CC: "13", CE: "22", PA: "41", TI: "12", NIT: "31" };
    const tipoIdReceptor = tipoIdMap[tipoIdSup] ?? "13";
    const receptor: Record<string, unknown> = {
      TipoOrganizacion: supplier.is_natural_person === false ? "1" : "2",
      TipoIdentificacion: tipoIdReceptor,
      Identificacion: supDoc,
      RazonSocial: supplier.name ?? "Proveedor",
      Regimen: String(supplier.regimen ?? "49"),
      IdMunicipio: emisor.IdMunicipio,
      Ciudad: supplier.city ?? emisor.Ciudad,
      CodigoPostal: emisor.CodigoPostal,
      Departamento: emisor.Departamento,
      IdDepartamento: emisor.IdDepartamento,
      Direccion: supplier.address ?? "N/A",
      CodigoPais: "CO",
      Pais: "Colombia",
      Email: supplier.email ?? "",
    };
    if (tipoIdReceptor === "31") (receptor as any).Dv = calcDv(supDoc);

    const detalles = (items ?? []).map((it: any, idx: number) => {
      const cantidad = Number(it.quantity_received ?? it.quantity_ordered ?? 1);
      const valorUnit = Number(it.unit_cost ?? 0);
      const totalLinea = r2(cantidad * valorUnit);
      return {
        NumeroLinea: idx + 1,
        CodigoItem: it.supplier_sku ?? it.product_id ?? `LIN-${idx + 1}`,
        CantidadItem: cantidad,
        UnidadCantidad: "NIU",
        UnidadMedida: "NIU",
        DescripcionItem: it.description ?? "Item",
        TextoItem: it.description ?? "Item",
        MonedaItem: po.currency ?? "COP",
        ValorItem: valorUnit,
        ItemAfecto: false,
        CodImpuesto: "01",
        ValorImpuesto: 0,
        PorcentajeImpuesto: 0,
        TotalItem: totalLinea,
      };
    });

    const subtotal = Number(po.subtotal ?? detalles.reduce((s, d) => s + d.TotalItem, 0));
    const totalIva = Number(po.tax ?? 0);
    const total = Number(po.total ?? r2(subtotal + totalIva));

    const fe = {
      Encabezado: {
        FechaEmision: fecha,
        HoraEmision: hora,
        TipoDocumento: "11", // Documento Soporte
        Prefijo: prefix,
        FolioAutorizado: nextNumber,
        Operacion: "10",
        FechaEntrega: fecha,
        HoraEntrega: hora,
      },
      CondicionesDePago: {
        FechaVencimiento: fecha,
        DescripcionDePago: "Contado",
        CondicionPago: "1",
        MedioDePago: "10",
      },
      Emisor: emisor,
      Receptor: receptor,
      Totales: {
        BaseAfecta: 0,
        BaseExcluida: subtotal,
        Moneda: po.currency ?? "COP",
        TotalIva: totalIva,
        TotalFactura: total,
        TotalaPagar: total,
      },
      TaxTotal: [],
      Detalles: detalles,
    };

    const payload = { trackId, Fe: fe };

    // 4) Token + POST a Innapsis
    const apiKey = cfg.partner_api_key ?? INNAPSIS_PARTNER_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Innapsis partner_api_key no configurado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = await getToken(emisorNit, apiKey);
    const base = cfg.environment === "prod" ? BASE_PROD : BASE_DEV;
    const innRes = await fetch(`${base}/fe/v1/documents`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    const innJson = await innRes.json().catch(() => ({}));

    const fullNumber = `${prefix}${nextNumber}`;
    const status = innRes.ok ? "sent" : "error";

    // 5) Persistir electronic_invoice (document_type='support_doc')
    const { data: invRow, error: invErr } = await admin
      .from("electronic_invoices")
      .insert({
        organization_id: orgId,
        document_type: "support_doc",
        prefix,
        number: nextNumber,
        full_number: fullNumber,
        issue_date: now.toISOString(),
        customer_identification: supDoc,
        customer_name: supplier.name,
        customer_email: supplier.email,
        subtotal,
        tax_total: totalIva,
        total,
        currency: po.currency ?? "COP",
        track_id: trackId,
        status,
        dian_response: innJson,
        request_payload: payload,
        last_error: innRes.ok ? null : JSON.stringify(innJson).slice(0, 1000),
        environment: cfg.environment ?? "dev",
        created_by: userId,
      })
      .select("id")
      .single();

    if (invErr) {
      return new Response(JSON.stringify({ error: "DB insert error", details: invErr.message, innapsis: innJson }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6) Avanzar numerador + marcar PO
    await admin
      .from("einvoice_configs")
      .update({ extra: { ...extra, ds_range: { ...dsRange, current: nextNumber } } })
      .eq("id", cfg.id);

    if (innRes.ok) {
      await admin
        .from("purchase_orders")
        .update({ ds_invoice_id: invRow.id, ds_emitted_at: now.toISOString() })
        .eq("id", purchase_order_id);
    }

    return new Response(JSON.stringify({
      ok: innRes.ok,
      electronic_invoice_id: invRow.id,
      full_number: fullNumber,
      track_id: trackId,
      innapsis: innJson,
    }), { status: innRes.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
