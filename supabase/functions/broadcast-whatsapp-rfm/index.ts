import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YCLOUD_API = "https://api.ycloud.com/v2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const normalisePhone = (raw: string): string | null => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10 && digits.startsWith("3")) return `+57${digits}`;
  return `+${digits}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = (claims?.claims as any)?.sub as string | undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const organizationId: string | null = body?.organization_id || null;
    const segment: string | null = body?.segment || null;
    const message: string = (body?.message || "").trim();
    const dryRun: boolean = !!body?.dry_run;
    const delayMs: number = Math.max(150, Number(body?.delay_ms) || 350);
    const templateName: string | null = body?.template_name || null;
    const templateLang: string = body?.template_language || "es";
    const templateVariables: string[] = Array.isArray(body?.template_variables) ? body.template_variables : [];
    const usingTemplate = !!templateName;

    if (!organizationId || !segment) {
      return new Response(JSON.stringify({ error: "organization_id y segment requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!usingTemplate && !message) {
      return new Response(JSON.stringify({ error: "Se requiere 'message' o 'template_name'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize membership
    const { data: member } = await supabase
      .from("organization_members")
      .select("role, is_active")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve audience from RFM segment
    const { data: segRows, error: segErr } = await supabase
      .from("customer_segments")
      .select("profile_id, profiles!inner(phone, full_name)")
      .eq("organization_id", organizationId)
      .eq("segment", segment);
    if (segErr) throw segErr;

    const seen = new Set<string>();
    const targets = (segRows || [])
      .map((r: any) => ({ phone: normalisePhone(r.profiles?.phone || ""), name: r.profiles?.full_name }))
      .filter((t): t is { phone: string; name: string } => {
        if (!t.phone || seen.has(t.phone)) return false;
        seen.add(t.phone);
        return true;
      });

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true, dry_run: true, segment, total: targets.length,
        preview: targets.slice(0, 5).map((t) => t.phone),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (targets.length === 0) {
      return new Response(JSON.stringify({ error: "No hay clientes con teléfono válido en este segmento" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // YCloud creds
    const { data: settingsRows } = await supabase
      .from("app_settings").select("key, value").in("key", ["ycloud_api_key", "ycloud_from_number"]);
    const settings: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { settings[r.key] = r.value; });
    const apiKey = settings.ycloud_api_key;
    const fromNumber = settings.ycloud_from_number;
    if (!apiKey || !fromNumber) {
      return new Response(JSON.stringify({ error: "YCloud no configurado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fromFormatted = fromNumber.startsWith("+") ? fromNumber : `+${fromNumber.replace(/\D/g, "")}`;

    const logMessage = usingTemplate ? `[RFM:${segment}][TEMPLATE:${templateName}] ${templateVariables.join(" | ")}` : `[RFM:${segment}] ${message}`;
    const { data: logRow, error: logErr } = await supabase
      .from("broadcast_logs")
      .insert({ message: logMessage, segment: `rfm:${segment}`, status: "running", total: targets.length, sent_by: userId, organization_id: organizationId })
      .select().single();
    if (logErr) throw logErr;
    const logId = logRow.id;

    let sent = 0, failed = 0;
    const errors: Array<{ phone: string; error: string }> = [];
    const templateBodyComponent = usingTemplate && templateVariables.length > 0
      ? [{ type: "body", parameters: templateVariables.map((v) => ({ type: "text", text: String(v) })) }]
      : [];

    for (const t of targets) {
      try {
        const payload: any = usingTemplate
          ? { from: fromFormatted, to: t.phone, type: "template",
              template: { name: templateName, language: { code: templateLang, policy: "deterministic" }, components: templateBodyComponent } }
          : { from: fromFormatted, to: t.phone, type: "text", text: { body: message } };
        const yRes = await fetch(`${YCLOUD_API}/whatsapp/messages`, {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (yRes.ok) sent++;
        else { failed++; const txt = await yRes.text().catch(() => ""); errors.push({ phone: t.phone, error: `HTTP ${yRes.status}: ${txt.slice(0,200)}` }); }
      } catch (err) {
        failed++;
        errors.push({ phone: t.phone, error: err instanceof Error ? err.message : "Error" });
      }
      await sleep(delayMs);
    }

    await supabase.from("broadcast_logs").update({
      status: failed === targets.length ? "failed" : "completed",
      sent, failed, errors: errors.slice(0, 50), sent_at: new Date().toISOString(),
    }).eq("id", logId);

    return new Response(JSON.stringify({ success: true, segment, total: targets.length, sent, failed, log_id: logId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("broadcast-whatsapp-rfm error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
