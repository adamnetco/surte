// Ola 24-bis · Slice 4 — Pre-expiry notifier
// Daily cron: alerta T-14 / T-7 / T-1 a admins/owners por email + WhatsApp
// para keys API próximas a expirar. Idempotente por etapa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: due, error } = await sb.rpc("api_keys_due_for_expiry_notice");
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const rows = (due ?? []) as Array<{
    id: string; organization_id: string; name: string; prefix: string;
    mode: string; expires_at: string; days_left: number; stage: string;
  }>;

  let notified = 0;
  const errors: Array<{ id: string; reason: string }> = [];

  for (const r of rows) {
    try {
      // Carga org + admins
      const { data: org } = await sb.from("organizations")
        .select("id, name, whatsapp_phone").eq("id", r.organization_id).maybeSingle();
      const { data: members } = await sb.from("organization_members")
        .select("user_id, role").eq("organization_id", r.organization_id)
        .eq("is_active", true).in("role", ["owner", "admin"]);

      const recipients: Array<{ email?: string; phone?: string; name?: string }> = [];
      for (const m of (members ?? [])) {
        const { data: prof } = await sb.from("profiles")
          .select("email, phone, full_name").eq("id", (m as any).user_id).maybeSingle();
        if (prof?.email || prof?.phone) {
          recipients.push({ email: prof.email ?? undefined, phone: prof.phone ?? undefined, name: prof.full_name ?? undefined });
        }
      }

      const orgName = org?.name ?? "tu organizacion";
      const subject = `Tu API key ${r.name} expira en ${r.days_left} dia(s)`;
      const bodyText =
        `Aviso de expiracion de API key\n\n` +
        `- Organizacion: ${orgName}\n- Key: ${r.name} (${r.prefix}, modo ${r.mode})\n` +
        `- Expira: ${new Date(r.expires_at).toLocaleString("es-CO")} (${r.days_left} dia(s))\n\n` +
        `Para evitar interrupciones rota la key desde admin > Developer > API.\n` +
        `Stage: ${r.stage}.`;

      // Email
      for (const rcp of recipients) {
        if (!rcp.email) continue;
        await sb.functions.invoke("send-transactional-email", {
          body: {
            to: rcp.email, subject,
            html: `<pre style="font-family:system-ui">${bodyText}</pre>`,
            text: bodyText,
            tags: ["api-key-expiry", r.stage],
          },
        }).catch(() => null);
      }

      // WhatsApp (texto plano, sin emojis)
      const waPhone = org?.whatsapp_phone ?? recipients.find(r => r.phone)?.phone ?? null;
      if (waPhone) {
        await sb.functions.invoke("send-ycloud-whatsapp", {
          body: { to: waPhone, type: "text", text: bodyText },
        }).catch(() => null);
      }

      await sb.rpc("api_key_mark_expiry_notified", { p_id: r.id, p_stage: r.stage });
      notified++;
    } catch (e) {
      errors.push({ id: r.id, reason: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({ ok: true, due: rows.length, notified, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
