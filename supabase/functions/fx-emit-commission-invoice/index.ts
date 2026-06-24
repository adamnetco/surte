// Slice 2 — Ola 2 FX: emite la factura electrónica de la COMISIÓN
// implícita de una operación FX delegando en innapsis-emit (reusa
// contingencia + email PDF/XML de la Ola 1).
//
// Flujo:
//  1. Carga fx_transactions + valida pertenencia / membresía.
//  2. Si commission_amount <= 0 → marca skipped y termina.
//  3. Crea un pos_orders sintético + 1 ítem "Comisión cambio de divisas"
//     + 1 pos_payments cash (necesarios para que innapsis-emit construya
//     el XML sin tocar su firma actual).
//  4. Invoca innapsis-emit con el bearer del caller.
//  5. Persiste estado final en fx_transactions.commission_invoice_status
//     y vincula electronic_invoice_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);
    const bearer = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser(bearer);
    if (authErr || !userData?.user) return j({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const fxTxId: string | undefined = body?.fx_transaction_id;
    if (!fxTxId) return j({ error: "fx_transaction_id_required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // 1) Cargar fx tx
    const { data: tx, error: txErr } = await admin
      .from("fx_transactions")
      .select("*")
      .eq("id", fxTxId)
      .maybeSingle();
    if (txErr) throw txErr;
    if (!tx) return j({ error: "fx_transaction_not_found" }, 404);

    // 2) Membresía
    const { data: membership } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", tx.organization_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) return j({ error: "forbidden" }, 403);

    // 3) Idempotencia
    if (tx.commission_invoice_status === "emitted" && tx.electronic_invoice_id) {
      return j({ success: true, already_emitted: true, electronic_invoice_id: tx.electronic_invoice_id });
    }

    const commission = Number(tx.commission_amount ?? 0);
    if (!(commission > 0)) {
      await admin.from("fx_transactions")
        .update({ commission_invoice_status: "skipped" })
        .eq("id", tx.id);
      return j({ success: true, skipped: true, reason: "no_commission" });
    }

    if (!tx.location_id || !tx.cash_session_id) {
      await admin.from("fx_transactions")
        .update({ commission_invoice_status: "failed" })
        .eq("id", tx.id);
      return j({ error: "fx_tx_missing_session_or_location" }, 400);
    }

    // 4) Marcar queued
    await admin.from("fx_transactions")
      .update({ commission_invoice_status: "queued" })
      .eq("id", tx.id);

    // 5) Pos order sintético
    const { data: order, error: oErr } = await admin.from("pos_orders").insert({
      organization_id: tx.organization_id,
      location_id: tx.location_id,
      cash_session_id: tx.cash_session_id,
      cashier_id: tx.cashier_id ?? userId,
      customer_document: tx.customer_doc_number ?? null,
      customer_name: tx.customer_name ?? "Consumidor Final",
      subtotal: commission,
      discount: 0,
      tax: 0,
      tip: 0,
      total: commission,
      amount_paid: commission,
      change_due: 0,
      status: "completed",
      sale_mode: "fx_commission",
      paid_at: new Date().toISOString(),
      notes: `Comisión FX op #${tx.receipt_number ?? tx.id.slice(0, 8)}`,
      metadata: { fx_transaction_id: tx.id, receipt_number: tx.receipt_number },
    }).select().single();
    if (oErr) throw oErr;

    const { error: itErr } = await admin.from("pos_order_items").insert({
      organization_id: tx.organization_id,
      pos_order_id: order.id,
      product_name: "Comisión cambio de divisas",
      sku: "FX-COMM",
      quantity: 1,
      unit_price: commission,
      discount: 0,
      tax_rate: 0,
      tax_amount: 0,
      total: commission,
    });
    if (itErr) throw itErr;

    await admin.from("pos_payments").insert({
      organization_id: tx.organization_id,
      pos_order_id: order.id,
      method: "cash",
      amount: commission,
    });

    // 6) Invocar innapsis-emit con el bearer del caller
    const emitRes = await fetch(`${SUPABASE_URL}/functions/v1/innapsis-emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: ANON,
      },
      body: JSON.stringify({
        organization_id: tx.organization_id,
        pos_order_id: order.id,
        document_type: "invoice",
      }),
    });
    const emitJson = await emitRes.json().catch(() => ({}));

    if (!emitRes.ok || !emitJson?.success) {
      await admin.from("fx_transactions")
        .update({ commission_invoice_status: "failed" })
        .eq("id", tx.id);
      return j({ error: "innapsis_emit_failed", status: emitRes.status, detail: emitJson, pos_order_id: order.id }, 502);
    }

    // 7) Persistir vínculo
    const isContingency = !!emitJson.contingency;
    await admin.from("fx_transactions")
      .update({
        commission_invoice_status: isContingency ? "queued" : "emitted",
        electronic_invoice_id: emitJson.invoice_id ?? null,
      })
      .eq("id", tx.id);

    return j({
      success: true,
      contingency: isContingency,
      electronic_invoice_id: emitJson.invoice_id,
      full_number: emitJson.full_number,
      pos_order_id: order.id,
    });
  } catch (e: any) {
    console.error("[fx-emit-commission-invoice]", e);
    return j({ error: "internal", message: e?.message ?? String(e) }, 500);
  }
});
