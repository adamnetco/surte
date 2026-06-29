// Slice 7 (Ola 23): notifica a administradores de la organización cuando se
// crea una alerta crítica de API. Email vía send-transactional-email +
// WhatsApp vía send-ycloud-whatsapp (texto plano, sin emojis).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KIND_LABEL: Record<string, string> = {
  webhook_down: "Webhook caido",
  api_5xx_spike: "Spike de errores 5xx",
  api_key_near_limit: "API key cerca del limite",
};

const BodySchema = z.object({ alert_id: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { alert_id } = parsed.data;

    // 1) Carga alerta + organización
    const { data: alert, error: alertErr } = await supabase
      .from("api_alerts")
      .select("id, organization_id, kind, severity, status, subject_label, message, notified_at")
      .eq("id", alert_id)
      .maybeSingle();
    if (alertErr || !alert) {
      return new Response(JSON.stringify({ error: "alert_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (alert.severity !== "critical") {
      return new Response(JSON.stringify({ skipped: "not_critical" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (alert.notified_at) {
      return new Response(JSON.stringify({ skipped: "already_notified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, whatsapp_phone, support_email")
      .eq("id", alert.organization_id)
      .maybeSingle();

    // 2) Admin/owner recipients (auth email + profile phone)
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, role, is_active")
      .eq("organization_id", alert.organization_id)
      .eq("is_active", true)
      .in("role", ["owner", "admin"]);

    const userIds = (members ?? []).map((m: any) => m.user_id);
    const recipients: Array<{ email?: string; phone?: string; name?: string }> = [];

    for (const uid of userIds) {
      try {
        const { data: u } = await supabase.auth.admin.getUserById(uid);
        const email = u?.user?.email;
        const { data: prof } = await supabase
          .from("profiles").select("full_name, phone").eq("user_id", uid).maybeSingle();
        if (email || prof?.phone) {
          recipients.push({ email, phone: prof?.phone ?? undefined, name: prof?.full_name ?? undefined });
        }
      } catch (_) { /* skip */ }
    }

    // Fallback: support_email de la organización
    if (recipients.length === 0 && org?.support_email) {
      recipients.push({ email: org.support_email, name: org?.name });
    }

    const kindLabel = KIND_LABEL[alert.kind] ?? alert.kind;
    const dashboardUrl = "https://admin.sistecpos.com/admin/api";

    // 3) Disparos paralelos (no bloquear si uno falla)
    const tasks: Promise<unknown>[] = [];
    const seenEmail = new Set<string>();
    const seenPhone = new Set<string>();

    for (const r of recipients) {
      if (r.email && !seenEmail.has(r.email)) {
        seenEmail.add(r.email);
        tasks.push(
          supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "api-alert-critical",
              recipientEmail: r.email,
              idempotencyKey: `api-alert-${alert.id}-${r.email}`,
              templateData: {
                full_name: r.name,
                org_name: org?.name,
                kind_label: kindLabel,
                subject_label: alert.subject_label,
                message: alert.message,
                dashboard_url: dashboardUrl,
              },
            },
          }).catch((e) => console.error("email_failed", r.email, e?.message))
        );
      }
      if (r.phone && !seenPhone.has(r.phone)) {
        seenPhone.add(r.phone);
        const msg =
`Alerta critica SistecPOS

Organizacion: ${org?.name ?? "-"}
Tipo: ${kindLabel}
${alert.subject_label ? `Recurso: ${alert.subject_label}\n` : ""}Detalle: ${alert.message}

Abrir panel: ${dashboardUrl}`;
        tasks.push(
          supabase.functions.invoke("send-ycloud-whatsapp", {
            body: {
              action: "send_text",
              to: r.phone,
              message: msg,
              organization_id: alert.organization_id,
            },
          }).catch((e) => console.error("whatsapp_failed", r.phone, e?.message))
        );
      }
    }

    // WhatsApp de la organización (canal comercial), si está configurado y no duplicado
    if (org?.whatsapp_phone && !seenPhone.has(org.whatsapp_phone)) {
      const msg =
`Alerta critica SistecPOS

Organizacion: ${org.name}
Tipo: ${kindLabel}
${alert.subject_label ? `Recurso: ${alert.subject_label}\n` : ""}Detalle: ${alert.message}

Abrir panel: ${dashboardUrl}`;
      tasks.push(
        supabase.functions.invoke("send-ycloud-whatsapp", {
          body: {
            action: "send_text",
            to: org.whatsapp_phone,
            message: msg,
            organization_id: alert.organization_id,
          },
        }).catch((e) => console.error("whatsapp_failed_org", e?.message))
      );
    }

    await Promise.allSettled(tasks);

    await supabase
      .from("api_alerts")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", alert.id);

    return new Response(JSON.stringify({
      ok: true,
      emails: seenEmail.size,
      whatsapps: seenPhone.size + (org?.whatsapp_phone && !seenPhone.has(org.whatsapp_phone) ? 1 : 0),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("notify-api-alert error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
