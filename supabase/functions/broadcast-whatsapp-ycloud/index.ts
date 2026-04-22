import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YCLOUD_API = "https://api.ycloud.com/v2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SubscriberRow {
  id: string;
  phone: string;
  is_active: boolean | null;
  notify_offers: boolean | null;
  notify_fresh: boolean | null;
  notify_new_products: boolean | null;
}

// Normalise phone to international format for YCloud (must include leading +)
const normalisePhone = (raw: string): string | null => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10 && digits.startsWith("3")) return `+57${digits}`;
  return `+${digits}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));

    // ── Action: list_templates (introspect available approved HSM templates) ──
    if (body?.action === "list_templates") {
      const { data: settingsRows } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["ycloud_api_key"]);
      const apiKey = settingsRows?.find((r: any) => r.key === "ycloud_api_key")?.value;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "YCloud API Key no configurado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tplRes = await fetch(`${YCLOUD_API}/whatsapp/templates?limit=100`, {
        headers: { "X-API-Key": apiKey },
      });
      const tplBody = await tplRes.json().catch(() => ({}));
      if (!tplRes.ok) {
        return new Response(JSON.stringify({ error: `YCloud templates HTTP ${tplRes.status}`, details: tplBody }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Normalise to a slim list { name, language, status, body }
      const items = Array.isArray(tplBody) ? tplBody : (tplBody?.items || tplBody?.data || []);
      const templates = items.map((t: any) => {
        const components = Array.isArray(t.components) ? t.components : [];
        const bodyText = components.find((c: any) => c.type === "BODY")?.text || "";
        return {
          name: t.name,
          language: t.language,
          status: t.status || "UNKNOWN",
          body: bodyText,
          variableCount: (bodyText.match(/\{\{\d+\}\}/g) || []).length,
        };
      });
      return new Response(JSON.stringify({ success: true, templates }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message: string = (body?.message || "").trim();
    const segment: "all" | "offers" | "fresh" | "new_products" = body?.segment || "all";
    const dryRun: boolean = !!body?.dry_run;
    const delayMs: number = Math.max(150, Number(body?.delay_ms) || 350);
    const scheduledAt: string | null = body?.scheduled_at || null;
    const sentBy: string | null = body?.sent_by || null;
    const existingLogId: string | null = body?.log_id || null;

    // Template (HSM) support
    const templateName: string | null = body?.template_name || null;
    const templateLang: string = body?.template_language || "es";
    const templateVariables: string[] = Array.isArray(body?.template_variables) ? body.template_variables : [];
    const usingTemplate = !!templateName;

    if (!usingTemplate && !message) {
      return new Response(JSON.stringify({ error: "Se requiere 'message' o 'template_name'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!usingTemplate && message.length > 1000) {
      return new Response(JSON.stringify({ error: "El mensaje no puede superar 1000 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Schedule for later ──────────────────────────────────
    if (scheduledAt && !dryRun) {
      const when = new Date(scheduledAt);
      if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        return new Response(JSON.stringify({ error: "La fecha programada debe ser futura" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: scheduled, error: schedErr } = await supabase
        .from("broadcast_logs")
        .insert({
          message: usingTemplate ? `[TEMPLATE:${templateName}] ${templateVariables.join(" | ")}` : message,
          segment,
          status: "pending",
          scheduled_at: when.toISOString(),
          sent_by: sentBy,
        })
        .select()
        .single();
      if (schedErr) throw schedErr;
      return new Response(JSON.stringify({
        success: true, scheduled: true,
        log_id: scheduled.id,
        scheduled_at: scheduled.scheduled_at,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── YCloud credentials ──────────────────────────────────
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["ycloud_api_key", "ycloud_from_number"]);
    const settings: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { settings[r.key] = r.value; });

    const apiKey = settings.ycloud_api_key;
    const fromNumber = settings.ycloud_from_number;

    if (!apiKey || !fromNumber) {
      return new Response(JSON.stringify({ error: "YCloud no configurado. Agrega API Key y número remitente en Configuración." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromFormatted = fromNumber.startsWith("+") ? fromNumber : `+${fromNumber.replace(/\D/g, "")}`;

    // ── Audience ────────────────────────────────────────────
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

    const seen = new Set<string>();
    const targets = recipients
      .map((s) => ({ ...s, normPhone: normalisePhone(s.phone) }))
      .filter((s): s is SubscriberRow & { normPhone: string } => {
        if (!s.normPhone) return false;
        if (seen.has(s.normPhone)) return false;
        seen.add(s.normPhone);
        return true;
      });

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true, dry_run: true, segment,
        total: targets.length,
        preview: targets.slice(0, 5).map((t) => t.normPhone),
        mode: usingTemplate ? `template:${templateName}` : "text",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (targets.length === 0) {
      return new Response(JSON.stringify({ error: "No hay suscriptores activos para este segmento" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create / update broadcast_logs row ─────────────────
    let logId = existingLogId;
    const logMessage = usingTemplate ? `[TEMPLATE:${templateName}] ${templateVariables.join(" | ")}` : message;
    if (!logId) {
      const { data: logRow, error: logErr } = await supabase
        .from("broadcast_logs")
        .insert({ message: logMessage, segment, status: "running", total: targets.length, sent_by: sentBy })
        .select()
        .single();
      if (logErr) throw logErr;
      logId = logRow.id;
    } else {
      await supabase
        .from("broadcast_logs")
        .update({ status: "running", total: targets.length })
        .eq("id", logId);
    }

    // ── Broadcast loop ─────────────────────────────────────
    let sent = 0;
    let failed = 0;
    const errors: Array<{ phone: string; error: string }> = [];

    // Build template payload once (parameters are the same per broadcast)
    const templateBodyComponent = usingTemplate && templateVariables.length > 0
      ? [{
          type: "body",
          parameters: templateVariables.map((v) => ({ type: "text", text: String(v) })),
        }]
      : [];

    for (const t of targets) {
      try {
        const payload: any = usingTemplate
          ? {
              from: fromFormatted,
              to: t.normPhone,
              type: "template",
              template: {
                name: templateName,
                language: { code: templateLang, policy: "deterministic" },
                components: templateBodyComponent,
              },
            }
          : {
              from: fromFormatted,
              to: t.normPhone,
              type: "text",
              text: { body: message },
            };

        const yRes = await fetch(`${YCLOUD_API}/whatsapp/messages`, {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (yRes.ok) {
          sent++;
          console.log(`[YCloud] ✓ ${t.normPhone} (${usingTemplate ? `tpl:${templateName}` : "text"})`);
        } else {
          failed++;
          const errBody = await yRes.text().catch(() => "");
          errors.push({ phone: t.phone, error: `HTTP ${yRes.status}: ${errBody.slice(0, 200)}` });
          console.error(`[YCloud] ✗ ${t.normPhone} → HTTP ${yRes.status}: ${errBody}`);
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Error desconocido";
        errors.push({ phone: t.phone, error: msg });
        console.error(`[YCloud] ✗ ${t.normPhone} → ${msg}`);
      }
      await sleep(delayMs);
    }

    await supabase
      .from("broadcast_logs")
      .update({
        status: failed === targets.length ? "failed" : "completed",
        sent, failed,
        errors: errors.slice(0, 50),
        sent_at: new Date().toISOString(),
      })
      .eq("id", logId);

    return new Response(JSON.stringify({
      success: true, segment,
      total: targets.length,
      sent, failed,
      log_id: logId,
      mode: usingTemplate ? `template:${templateName}` : "text",
      errors: errors.slice(0, 10),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("broadcast-whatsapp-ycloud error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
