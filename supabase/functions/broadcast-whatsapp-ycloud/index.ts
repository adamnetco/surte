import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YCLOUD_API = "https://api.ycloud.com/v2";

// Simple async sleep used between sends to avoid hitting per-second rate limits.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SubscriberRow {
  id: string;
  phone: string;
  is_active: boolean | null;
  notify_offers: boolean | null;
  notify_fresh: boolean | null;
  notify_new_products: boolean | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Body ───────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const message: string = (body?.message || "").trim();
    const segment: "all" | "offers" | "fresh" | "new_products" =
      body?.segment || "all";
    const dryRun: boolean = !!body?.dry_run;
    const delayMs: number = Math.max(150, Number(body?.delay_ms) || 350);

    if (!message) {
      return new Response(
        JSON.stringify({ error: "El campo 'message' es obligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (message.length > 1000) {
      return new Response(
        JSON.stringify({ error: "El mensaje no puede superar 1000 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── YCloud credentials from app_settings ───────────────
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["ycloud_api_key", "ycloud_from_number"]);
    const settings: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { settings[r.key] = r.value; });

    const apiKey = settings.ycloud_api_key;
    const fromNumber = settings.ycloud_from_number;

    if (!apiKey || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "YCloud no configurado. Agrega API Key y número remitente en Configuración." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Audience selection ─────────────────────────────────
    let query = supabase
      .from("notification_subscriptions")
      .select("id, phone, is_active, notify_offers, notify_fresh, notify_new_products")
      .eq("is_active", true);

    if (segment === "offers") query = query.eq("notify_offers", true);
    else if (segment === "fresh") query = query.eq("notify_fresh", true);
    else if (segment === "new_products") query = query.eq("notify_new_products", true);

    const { data: subs, error: subsError } = await query;
    if (subsError) throw subsError;

    const recipients: SubscriberRow[] = (subs || []) as any;

    // De-duplicate phones (normalised)
    const seen = new Set<string>();
    const targets = recipients
      .map((s) => ({ ...s, normPhone: s.phone.replace(/\D/g, "") }))
      .filter((s) => s.normPhone.length >= 10 && !seen.has(s.normPhone) && (seen.add(s.normPhone), true));

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          segment,
          total: targets.length,
          preview: targets.slice(0, 5).map((t) => t.phone),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay suscriptores activos para este segmento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Broadcast loop ─────────────────────────────────────
    let sent = 0;
    let failed = 0;
    const errors: Array<{ phone: string; error: string }> = [];

    for (const t of targets) {
      try {
        const yRes = await fetch(`${YCLOUD_API}/whatsapp/messages`, {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromNumber,
            to: t.normPhone,
            type: "text",
            text: { body: message },
          }),
        });
        if (yRes.ok) {
          sent++;
        } else {
          failed++;
          const errBody = await yRes.text().catch(() => "");
          errors.push({ phone: t.phone, error: `HTTP ${yRes.status}: ${errBody.slice(0, 120)}` });
        }
      } catch (err) {
        failed++;
        errors.push({ phone: t.phone, error: err instanceof Error ? err.message : "Error desconocido" });
      }
      // Rate-limit guard
      await sleep(delayMs);
    }

    return new Response(
      JSON.stringify({
        success: true,
        segment,
        total: targets.length,
        sent,
        failed,
        errors: errors.slice(0, 10),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("broadcast-whatsapp-ycloud error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
