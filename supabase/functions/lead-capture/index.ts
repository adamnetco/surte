// Captura pública de leads desde sistecpos.com / agendar / contacto / comparador.
// No requiere JWT. Usa service-role para insertar en crm_leads y notificar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LeadPayload {
  full_name: string;
  email?: string;
  phone?: string;
  business_name?: string;
  business_type?: string;
  city?: string;
  source?: string;
  source_page?: string;
  plan_interest?: string;
  modules_interest?: string[];
  message?: string;
  utm?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = (await req.json()) as LeadPayload;
    if (!body?.full_name || (!body.email && !body.phone)) {
      return json({ error: "full_name + email|phone required" }, 400);
    }
    if (body.full_name.length > 200) return json({ error: "name_too_long" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("crm_leads")
      .insert({
        full_name: body.full_name.trim(),
        email: body.email?.trim().toLowerCase() ?? null,
        phone: body.phone?.replace(/\D/g, "") || null,
        business_name: body.business_name ?? null,
        business_type: body.business_type ?? null,
        city: body.city ?? null,
        source: body.source ?? "web",
        source_page: body.source_page ?? null,
        plan_interest: body.plan_interest ?? null,
        modules_interest: body.modules_interest ?? [],
        message: body.message ?? null,
        utm: body.utm ?? {},
      })
      .select("id")
      .single();

    if (error) return json({ error: error.message }, 500);

    // Opcional: notificar al equipo comercial (WhatsApp / email) - se conecta en fase siguiente.

    return json({ ok: true, lead_id: data.id }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
