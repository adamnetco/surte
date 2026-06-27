// Ola 15 — Slice 5: Cron retry para facturas Wompi fallidas con backoff exponencial.
// Schedule sugerido: cada 15 min vía pg_cron.
// Backoff: attempt 1 -> 1h, 2 -> 6h, 3 -> 24h, 4 -> 72h. Tras max_attempts marca subscription past_due.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WOMPI_PUBLIC_KEY = Deno.env.get("WOMPI_PUBLIC_KEY") ?? "";
const WOMPI_INTEGRITY_SECRET = Deno.env.get("WOMPI_INTEGRITY_SECRET") ?? "";
const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

const BACKOFF_HOURS = [1, 6, 24, 72];

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newReference(orgId: string) {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `sub_${orgId.slice(0, 8)}_${ts}_${rnd}_r`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!WOMPI_PUBLIC_KEY || !WOMPI_INTEGRITY_SECRET) {
      throw new Error("Wompi secrets no configurados.");
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();

    // 1) Buscar facturas elegibles para retry
    const { data: invoices, error } = await admin
      .from("subscription_invoices")
      .select("id, organization_id, subscription_id, amount, currency, attempt_count, max_attempts, period_start, period_end")
      .eq("status", "failed")
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];

    for (const inv of invoices ?? []) {
      const attempt = (inv.attempt_count ?? 1) + 1;
      const maxAttempts = inv.max_attempts ?? BACKOFF_HOURS.length;

      // 1a) Si superó el máximo -> dar por perdida y degradar suscripción a past_due
      if (attempt > maxAttempts) {
        await admin.from("subscription_invoices").update({
          status: "voided",
          last_error: `Abandonada tras ${maxAttempts} intentos fallidos`,
          last_retry_at: nowIso,
        }).eq("id", inv.id);

        await admin.from("subscriptions").update({
          status: "past_due",
        }).eq("id", inv.subscription_id);

        await admin.from("dunning_events").insert({
          organization_id: inv.organization_id,
          subscription_id: inv.subscription_id,
          invoice_id: inv.id,
          attempt: maxAttempts,
          status: "abandoned",
          reason: `Abandonada tras ${maxAttempts} intentos fallidos`,
        }).then(() => {}).catch(() => {});



        results.push({ invoice_id: inv.id, action: "abandoned" });
        continue;
      }

      // 2) Generar nuevo reference + checkout_url firmado
      const reference = newReference(inv.organization_id);
      const amountInCents = Math.round(Number(inv.amount) * 100);
      const currency = (inv.currency || "COP").toUpperCase();
      const signature = await sha256Hex(`${reference}${amountInCents}${currency}${WOMPI_INTEGRITY_SECRET}`);

      const params = new URLSearchParams({
        "public-key": WOMPI_PUBLIC_KEY,
        currency,
        "amount-in-cents": String(amountInCents),
        reference,
        "signature:integrity": signature,
        "redirect-url": `${Deno.env.get("PUBLIC_APP_URL") ?? "https://admin.sistecpos.com"}/billing?from=wompi`,
      });
      const checkoutUrl = `${WOMPI_CHECKOUT_URL}?${params.toString()}`;

      // 3) Programar próximo retry con backoff exponencial
      const nextRetryHours = BACKOFF_HOURS[Math.min(attempt - 1, BACKOFF_HOURS.length - 1)];
      const nextRetryAt = new Date(Date.now() + nextRetryHours * 3600 * 1000).toISOString();

      // 4) Crear NUEVA factura pending vinculada a la misma suscripción (mantiene auditoría)
      const { error: invErr } = await admin.from("subscription_invoices").insert({
        organization_id: inv.organization_id,
        subscription_id: inv.subscription_id,
        amount: inv.amount,
        currency,
        status: "pending",
        period_start: inv.period_start,
        period_end: inv.period_end,
        due_date: nowIso,
        wompi_reference: reference,
        attempt_count: attempt,
        max_attempts: maxAttempts,
        next_retry_at: nextRetryAt,
        checkout_url: checkoutUrl,
        payment_method: { source: "wompi_retry", parent_invoice_id: inv.id },
      });
      if (invErr) {
        console.error("[wompi-retry] insert err", invErr);
        continue;
      }

      // 5) Cerrar la factura fallida anterior con last_retry_at
      await admin.from("subscription_invoices").update({
        last_retry_at: nowIso,
        next_retry_at: nextRetryAt,
      }).eq("id", inv.id);

      // 6) Registrar dunning event
      await admin.from("dunning_events").insert({
        organization_id: inv.organization_id,
        subscription_id: inv.subscription_id,
        invoice_id: inv.id,
        attempt,
        status: "retry_scheduled",
        reason: `Reintento ${attempt} programado para ${nextRetryAt} (ref ${reference})`,
        next_retry_at: nextRetryAt,
      }).then(() => {}).catch(() => {});


      results.push({ invoice_id: inv.id, action: "retry_scheduled", attempt, next_retry_at: nextRetryAt });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[wompi-retry-failed-invoices]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
