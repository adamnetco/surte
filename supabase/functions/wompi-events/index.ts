// Wompi Events webhook — activa suscripción SaaS al recibir transaction.updated APPROVED
// Doc: https://docs.wompi.co/docs/colombia/eventos/
// Firma: checksum = sha256( concat(properties values in order) + timestamp + events_secret )

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WOMPI_EVENTS_SECRET = Deno.env.get("WOMPI_EVENTS_SECRET") ?? "";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const raw = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Verificar firma
    if (!WOMPI_EVENTS_SECRET) throw new Error("WOMPI_EVENTS_SECRET no configurado");
    const sig = payload?.signature;
    const timestamp = payload?.timestamp;
    if (!sig?.checksum || !sig?.properties || timestamp == null) {
      return new Response(JSON.stringify({ error: "missing_signature" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const concatenated = (sig.properties as string[])
      .map((p) => String(getByPath(payload.data, p) ?? ""))
      .join("");
    const expected = await sha256Hex(`${concatenated}${timestamp}${WOMPI_EVENTS_SECRET}`);
    if (expected.toLowerCase() !== String(sig.checksum).toLowerCase()) {
      console.warn("[wompi-events] checksum mismatch", { expected, got: sig.checksum });
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const event = payload?.event as string | undefined;
    const tx = payload?.data?.transaction;
    if (!tx) {
      // Otros eventos: log y 200 OK
      console.log("[wompi-events] non-transaction event", event);
      return new Response(JSON.stringify({ ok: true, ignored: event }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = tx.reference as string;
    const wompiTxId = tx.id as string;
    const status = tx.status as string; // APPROVED | DECLINED | VOIDED | ERROR | PENDING
    const amountInCents = Number(tx.amount_in_cents ?? 0);
    const currency = tx.currency as string;
    const paymentMethodType = tx.payment_method_type as string | undefined;
    const statusMessage = tx.status_message as string | undefined;

    // 2a) Si la referencia corresponde a un add-on (prefijo "addon_"), procesar y salir
    if (reference?.startsWith("addon_")) {
      const { data: addonRow } = await admin
        .from("tenant_addons")
        .select("id, status")
        .eq("wompi_reference", reference)
        .maybeSingle();

      if (!addonRow) {
        console.warn("[wompi-events] addon row not found for reference", reference);
        return new Response(JSON.stringify({ ok: true, warn: "addon_not_found", reference }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const addonStatus =
        status === "APPROVED" ? "active" :
        status === "DECLINED" || status === "ERROR" ? "failed" :
        status === "VOIDED" ? "canceled" : "pending";

      // Idempotencia: no degradar un add-on ya activo
      if (addonRow.status === "active" && status !== "APPROVED") {
        return new Response(JSON.stringify({ ok: true, addon_id: addonRow.id, ignored: "already_active" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin
        .from("tenant_addons")
        .update({
          status: addonStatus,
          wompi_transaction_id: wompiTxId,
          starts_at: status === "APPROVED" ? new Date().toISOString() : undefined,
          metadata: { last_status_message: statusMessage ?? null, payment_method: paymentMethodType ?? null },
        })
        .eq("id", addonRow.id);

      console.log("[wompi-events] addon updated", { addon_id: addonRow.id, status: addonStatus });
      return new Response(JSON.stringify({ ok: true, addon_id: addonRow.id, status: addonStatus }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2b) Localizar factura de suscripción por reference
    const { data: invoice, error: invErr } = await admin
      .from("subscription_invoices")
      .select("id, subscription_id, status")
      .eq("wompi_reference", reference)
      .maybeSingle();

    if (invErr || !invoice) {
      console.warn("[wompi-events] invoice not found for reference", reference);
      // 200 OK para que Wompi no reintente eternamente; queda log para reconciliación.
      return new Response(JSON.stringify({ ok: true, warn: "invoice_not_found", reference }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // 3) Mapear estado Wompi -> estado interno
    const invoiceStatus =
      status === "APPROVED" ? "paid" :
      status === "DECLINED" ? "failed" :
      status === "VOIDED"   ? "voided" :
      status === "ERROR"    ? "failed" : "pending";

    const subStatus =
      status === "APPROVED" ? "active" :
      status === "DECLINED" || status === "ERROR" ? "past_due" :
      status === "VOIDED" ? "canceled" : "pending";

    // 4) Idempotencia: si la factura ya está paid y llega otro APPROVED, no re-aplicar.
    const alreadyPaid = invoice.status === "paid";

    // 5) Update factura
    await admin
      .from("subscription_invoices")
      .update({
        status: invoiceStatus,
        wompi_transaction_id: wompiTxId,
        payment_method: paymentMethodType ?? null,
        last_error: status !== "APPROVED" ? (statusMessage ?? null) : null,
        paid_at: status === "APPROVED" ? new Date().toISOString() : null,
      })
      .eq("id", invoice.id);

    // 6) Activar suscripción solo en APPROVED y solo la primera vez
    if (status === "APPROVED" && !alreadyPaid) {
      const now = new Date();
      const { data: sub } = await admin
        .from("subscriptions")
        .select("billing_cycle, organization_id, plan")
        .eq("id", invoice.subscription_id)
        .maybeSingle();

      const periodEnd = new Date(now);
      if (sub?.billing_cycle === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await admin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          retry_count: 0,
          last_payment_error: null,
          external_id: wompiTxId,
        })
        .eq("id", invoice.subscription_id);

      console.log("[wompi-events] subscription activated", {
        subscription_id: invoice.subscription_id,
        org: sub?.organization_id,
        plan: sub?.plan,
        periodEnd: periodEnd.toISOString(),
      });
    } else if (status !== "APPROVED") {
      // No-aprobado: marcar la suscripción según estado (sin sobrescribir active existente)
      const { data: sub } = await admin
        .from("subscriptions")
        .select("status")
        .eq("id", invoice.subscription_id)
        .maybeSingle();
      if (sub && sub.status !== "active") {
        await admin
          .from("subscriptions")
          .update({ status: subStatus })
          .eq("id", invoice.subscription_id);
      }
    }

    return new Response(JSON.stringify({ ok: true, status, invoice_id: invoice.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[wompi-events] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
