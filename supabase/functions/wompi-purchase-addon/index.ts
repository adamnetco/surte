// Wompi - One-shot purchase para Add-ons SaaS
// Crea (o reutiliza) una fila pending en tenant_addons con wompi_reference único
// y devuelve la URL de Wompi Web Checkout firmada con SHA256.
// La activación a `status=active` ocurre en wompi-events al recibir APPROVED.

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

function genReference(orgId: string, addonCode: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `addon_${addonCode}_${orgId.slice(0, 8)}_${ts}_${rnd}`;
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
    const { organization_id, addon_code, quantity = 1, return_url } = body ?? {};
    if (!organization_id || !addon_code) {
      return new Response(JSON.stringify({ error: "organization_id y addon_code son requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const qty = Math.max(1, Number(quantity) || 1);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Verificar membresía owner/admin
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

    // 2) Cargar addon
    const { data: addon, error: addonErr } = await admin
      .from("addons")
      .select("code, name, price_cop, billing_period, is_active")
      .eq("code", addon_code)
      .eq("is_active", true)
      .maybeSingle();
    if (addonErr || !addon) {
      return new Response(JSON.stringify({ error: "Add-on no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const amountCop = Number(addon.price_cop) * qty;
    if (!amountCop || amountCop <= 0) {
      return new Response(JSON.stringify({ error: "Add-on sin precio facturable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const amountInCents = Math.round(amountCop * 100);
    const currency = "COP";

    // 3) Período de vigencia
    const now = new Date();
    const ends = new Date(now);
    if (addon.billing_period === "yearly") ends.setFullYear(ends.getFullYear() + 1);
    else if (addon.billing_period === "monthly") ends.setMonth(ends.getMonth() + 1);
    else ends.setFullYear(ends.getFullYear() + 1); // one_shot: 1 año de vigencia por defecto

    const reference = genReference(organization_id, addon.code);

    // 4) Reservar tenant_addon pending con la referencia
    const { data: row, error: insErr } = await admin
      .from("tenant_addons")
      .insert({
        organization_id,
        addon_code: addon.code,
        quantity: qty,
        status: "pending",
        amount_paid_cop: amountCop,
        ends_at: ends.toISOString(),
        wompi_reference: reference,
        metadata: { initiated_by: userId, source: "wompi_one_shot", addon_name: addon.name },
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    // 5) Firma integridad
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
      tenant_addon_id: row.id,
      amount_in_cents: amountInCents,
      currency,
      public_key: WOMPI_PUBLIC_KEY,
      checkout_url: `${WOMPI_CHECKOUT_URL}?${params.toString()}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[wompi-purchase-addon]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
