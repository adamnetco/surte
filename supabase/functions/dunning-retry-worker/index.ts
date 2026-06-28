// Ola 18 · Slice 2 — Dunning Retry Worker
// Lee dunning_cases status='open' con next_retry_at <= now() y dispara reintento de cobro.
// Backoff: D+1 (intento 1), D+3 (2), D+5 (3), D+7 (4). Si todos fallan → 'paused' + suspende tenant.
// Genera nueva subscription_invoice + wompi_reference para re-cobro.
// Telemetría: usage_events kind='dunning_attempt'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 4;
const BACKOFF_DAYS = [1, 2, 2, 2]; // entre intentos: D+1, D+3, D+5, D+7

function nextRetryDelta(attemptNo: number): number | null {
  // attemptNo es el que ACABA de ejecutarse (1..MAX)
  if (attemptNo >= MAX_ATTEMPTS) return null;
  return BACKOFF_DAYS[attemptNo] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: any[] = [];

  try {
    // 1) Casos elegibles
    const { data: cases, error: casesErr } = await admin
      .from("dunning_cases")
      .select("id, organization_id, subscription_id, invoice_id, attempt_count, total_amount_cop, grace_until")
      .eq("status", "open")
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(50);

    if (casesErr) throw casesErr;
    if (!cases?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const c of cases) {
      const attemptNo = (c.attempt_count ?? 0) + 1;
      const scheduledAt = new Date().toISOString();

      // 2) Registrar attempt en estado pending
      const { data: attempt, error: attErr } = await admin
        .from("dunning_attempts")
        .insert({
          case_id: c.id,
          attempt_no: attemptNo,
          scheduled_at: scheduledAt,
          executed_at: new Date().toISOString(),
          outcome: "pending",
          amount_cop: c.total_amount_cop,
        })
        .select("id")
        .single();
      if (attErr) {
        console.error("[dunning] attempt insert failed", attErr.message);
        continue;
      }

      // 3) Disparar re-cobro Wompi (best-effort: si no hay método tokenizado, marcamos error)
      //    Para MVP: invocamos wompi-create-subscription para re-emitir checkout y notificar.
      let outcome: "declined" | "error" | "skipped" = "declined";
      let errorCode: string | null = null;
      let errorMessage: string | null = null;

      try {
        const { data: retryRes, error: retryErr } = await admin.functions.invoke(
          "wompi-create-subscription",
          {
            body: {
              organization_id: c.organization_id,
              subscription_id: c.subscription_id,
              dunning_case_id: c.id,
              retry_attempt: attemptNo,
            },
          },
        );
        if (retryErr) {
          outcome = "error";
          errorCode = "invoke_failed";
          errorMessage = retryErr.message;
        } else if (retryRes?.error) {
          outcome = "error";
          errorCode = retryRes.code ?? "wompi_error";
          errorMessage = retryRes.error;
        } else {
          // En este flujo no hay cobro automático silencioso: queda pending checkout.
          // El APPROVED real entrará por wompi-events y cerrará el caso como recovered.
          outcome = "skipped";
        }
      } catch (e) {
        outcome = "error";
        errorCode = "exception";
        errorMessage = (e as Error).message;
      }

      // 4) Update attempt
      await admin
        .from("dunning_attempts")
        .update({ outcome, error_code: errorCode, error_message: errorMessage })
        .eq("id", attempt.id);

      // 5) Decidir siguiente estado del caso
      const delta = nextRetryDelta(attemptNo);
      const graceExpired = c.grace_until && new Date(c.grace_until).getTime() <= Date.now();

      if (attemptNo >= MAX_ATTEMPTS || graceExpired) {
        // Sin más intentos o grace expirado → pausar tenant
        await admin
          .from("dunning_cases")
          .update({
            status: "paused",
            attempt_count: attemptNo,
            next_retry_at: null,
            closed_at: new Date().toISOString(),
          })
          .eq("id", c.id);

        // Suspender tenant + suscripción
        await admin
          .from("organizations")
          .update({ lifecycle_state: "suspended", is_active: false })
          .eq("id", c.organization_id);
        if (c.subscription_id) {
          await admin
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("id", c.subscription_id);
        }
      } else {
        const next = new Date();
        next.setDate(next.getDate() + (delta ?? 2));
        await admin
          .from("dunning_cases")
          .update({ attempt_count: attemptNo, next_retry_at: next.toISOString() })
          .eq("id", c.id);
      }

      // 6) Telemetría
      await admin.from("usage_events").insert({
        organization_id: c.organization_id,
        kind: "dunning_attempt",
        metric: outcome,
        payload: {
          case_id: c.id,
          attempt_no: attemptNo,
          error_code: errorCode,
          grace_expired: graceExpired,
        },
      });

      results.push({ case_id: c.id, attempt_no: attemptNo, outcome });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[dunning-retry-worker] fatal", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
