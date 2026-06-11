// Etapa 3 SaaS refactor — Welcome dispatcher.
// Lee sync_outbox con target IN ('welcome_email','welcome_whatsapp') y los envía.
// Diseñado para correr por cron cada minuto. Idempotente: actualiza succeeded_at / attempts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YCLOUD_API = "https://api.ycloud.com/v2";
const ADMIN_URL = Deno.env.get("ADMIN_BASE_URL") || "https://admin.sistecpos.com";

const MAX_ATTEMPTS = 5;
const BATCH = 20;

type OutboxRow = {
  id: string;
  target: string;
  payload: Record<string, any>;
  organization_id: string | null;
  attempts: number;
  status: string;
};

async function sendWelcomeEmail(admin: ReturnType<typeof createClient>, row: OutboxRow) {
  const p = row.payload || {};
  if (!p.email) throw new Error("missing_email");
  const invite_link = p.invite_link || `${ADMIN_URL}/onboarding`;
  const res = await admin.functions.invoke("send-transactional-email", {
    body: {
      templateName: "organization-welcome",
      recipientEmail: p.email,
      idempotencyKey: `welcome-email-${row.id}`,
      templateData: {
        full_name: p.full_name,
        org_name: p.org_name,
        org_slug: p.org_slug,
        invite_link,
        admin_url: ADMIN_URL,
      },
    },
  });
  if (res.error) throw new Error(`email_invoke_failed: ${res.error.message}`);
  return res.data;
}

async function sendWelcomeWhatsApp(admin: ReturnType<typeof createClient>, row: OutboxRow) {
  const p = row.payload || {};
  const phone = String(p.phone || "").replace(/\D/g, "");
  if (phone.length < 10) throw new Error("invalid_phone");

  const { data: settingsRows } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["ycloud_api_key", "ycloud_from_number"]);
  const settings: Record<string, string> = {};
  settingsRows?.forEach((r: any) => {
    settings[r.key] = typeof r.value === "string" ? r.value : (r.value?.value ?? "");
  });
  const apiKey = settings.ycloud_api_key;
  const fromNumber = settings.ycloud_from_number;
  if (!apiKey || !fromNumber) {
    throw new Error("ycloud_not_configured");
  }

  // Plain text, sin emojis (regla del proyecto).
  const greeting = p.full_name ? `Hola ${p.full_name}` : "Hola";
  const body = [
    `SistecPOS - Bienvenido`,
    ``,
    `${greeting},`,
    `Tu negocio ${p.org_name ?? "tu organizacion"} ya esta activo en SistecPOS.`,
    ``,
    `Tu plataforma incluye: POS, inventario, catalogo, facturacion y KDS.`,
    ``,
    `Acceso: ${ADMIN_URL}`,
    p.org_slug ? `Identificador: ${p.org_slug}` : "",
    ``,
    `Te enviamos tambien un correo con el enlace de acceso.`,
    ``,
    `Equipo SistecPOS`,
  ].filter(Boolean).join("\n");

  const yRes = await fetch(`${YCLOUD_API}/whatsapp/messages`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromNumber,
      to: phone,
      type: "text",
      text: { body },
    }),
  });
  const yData = await yRes.json().catch(() => ({}));
  if (!yRes.ok) {
    throw new Error(`ycloud_${yRes.status}: ${JSON.stringify(yData).slice(0, 200)}`);
  }
  return { wa_message_id: yData.id };
}

async function processOne(admin: ReturnType<typeof createClient>, row: OutboxRow) {
  try {
    let result: unknown;
    if (row.target === "welcome_email") {
      result = await sendWelcomeEmail(admin, row);
    } else if (row.target === "welcome_whatsapp") {
      result = await sendWelcomeWhatsApp(admin, row);
    } else {
      return { skipped: true };
    }
    await admin
      .from("sync_outbox")
      .update({
        status: "succeeded",
        succeeded_at: new Date().toISOString(),
        attempts: row.attempts + 1,
        last_error: null,
        payload: { ...row.payload, _result: result },
      })
      .eq("id", row.id);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const nextAttempt = row.attempts + 1;
    const isDead = nextAttempt >= MAX_ATTEMPTS;
    // Backoff exponencial simple: 2^attempts minutos.
    const delayMin = Math.min(2 ** nextAttempt, 60);
    await admin
      .from("sync_outbox")
      .update({
        status: isDead ? "failed" : "pending",
        attempts: nextAttempt,
        last_error: msg.slice(0, 500),
        next_attempt_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
      })
      .eq("id", row.id);
    return { ok: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), {
      status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: rows, error } = await admin
      .from("sync_outbox")
      .select("id, target, payload, organization_id, attempts, status")
      .in("target", ["welcome_email", "welcome_whatsapp"])
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(BATCH);

    if (error) return json({ error: "fetch_failed", message: error.message }, 500);

    const results = [];
    for (const row of (rows ?? []) as OutboxRow[]) {
      const r = await processOne(admin, row);
      results.push({ id: row.id, target: row.target, ...r });
    }

    return json({ processed: results.length, results });
  } catch (e) {
    return json({ error: "internal", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
