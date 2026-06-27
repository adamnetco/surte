// Wompi - Create SaaS subscription checkout
// Crea suscripción + factura PENDING y devuelve datos firmados para Web Checkout Wompi.
// El webhook `wompi-events` (Slice 3) activa la suscripción al recibir transaction.updated APPROVED.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WOMPI_PUBLIC_KEY = Deno.env.get("WOMPI_PUBLIC_KEY") ?? "";
const WOMPI_INTEGRITY_SECRET = Deno.env.get("WOMPI_INTEGRITY_SECRET") ?? "";
const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genReference(orgId: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `sub_${orgId.slice(0, 8)}_${ts}_${rnd}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!WOMPI_PUBLIC_KEY || !WOMPI_INTEGRITY_SECRET) {
      throw new Error("Wompi secrets no configurados (WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET).");
    }

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";

    const body = await req.json();
    const { organization_id, plan_key, billing_cycle = "monthly", return_url } = body ?? {};
    if (!organization_id || !plan_key) {
      return new Response(JSON.stringify({ error: "organization_id y plan_key son requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["monthly", "yearly"].includes(billing_cycle)) {
      return new Response(JSON.stringify({ error: "billing_cycle inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Verificar membresía owner/admin en la organización
    const { data: member } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      return new Response(JSON.stringify({ error: "No autorizado para esta organización" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Cargar plan
    const { data: plan, error: planErr } = await admin
      .from("saas_plans")
      .select("id, key, name, price_monthly, price_yearly, currency, trial_days")
      .eq("key", plan_key)
      .eq("is_public", true)
      .maybeSingle();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plan no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountCop = billing_cycle === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
    if (!amountCop || amountCop <= 0) {
      return new Response(JSON.stringify({ error: "Plan sin precio facturable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const amountInCents = Math.round(amountCop * 100);
    const currency = (plan.currency || "COP").toUpperCase();

    // 3) Crear o reutilizar suscripción PENDING
    const now = new Date();
    const periodEnd = new Date(now);
    if (billing_cycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const reference = genReference(organization_id);

    const { data: sub, error: subErr } = await admin
      .from("subscriptions")
      .upsert({
        organization_id,
        plan: plan.key,
        plan_id: plan.id,
        billing_cycle,
        status: "pending",
        provider: "wompi",
        external_provider: "wompi",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        metadata: { initiated_by: userId, plan_name: plan.name, last_reference: reference },
      }, { onConflict: "organization_id" })
      .select("id")
      .single();
    if (subErr) throw subErr;

    // 4) Crear factura PENDING con referencia única
    const { error: invErr } = await admin.from("subscription_invoices").insert({
      organization_id,
      subscription_id: sub.id,
      amount: amountCop,
      currency,
      status: "pending",
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      due_date: now.toISOString(),
      wompi_reference: reference,
      attempt_count: 1,
      payment_method: { source: "wompi_web_checkout" },
    });
    if (invErr) throw invErr;

    // 5) Firma de integridad: sha256(reference + amount_in_cents + currency + integrity_secret)
    const signature = await sha256Hex(`${reference}${amountInCents}${currency}${WOMPI_INTEGRITY_SECRET}`);

    const params = new URLSearchParams({
      "public-key": WOMPI_PUBLIC_KEY,
      currency,
      "amount-in-cents": String(amountInCents),
      reference,
      "signature:integrity": signature,
      "customer-data:email": userEmail,
      ...(return_url ? { "redirect-url": return_url } : {}),
    });

    return new Response(JSON.stringify({
      ok: true,
      reference,
      amount_in_cents: amountInCents,
      currency,
      signature,
      public_key: WOMPI_PUBLIC_KEY,
      checkout_url: `${WOMPI_CHECKOUT_URL}?${params.toString()}`,
      subscription_id: sub.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[wompi-create-subscription]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
