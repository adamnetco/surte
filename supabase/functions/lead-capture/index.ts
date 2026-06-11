// Captura pública de leads desde sistecpos.com / agendar / contacto / comparador.
// No requiere JWT. Usa service-role para insertar en crm_leads y notificar.
// Etapa 26: validación estricta con Zod + sanitización de strings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sanitiza control chars y limita longitud — defensa contra payloads abusivos.
const safeStr = (max: number) =>
  z.string()
    .transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max));

const LeadSchema = z.object({
  full_name: safeStr(200).refine((s) => s.length >= 2, "name_too_short"),
  email: z.string().email().max(254).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  business_name: safeStr(200).optional().nullable(),
  business_type: safeStr(60).optional().nullable(),
  city: safeStr(80).optional().nullable(),
  source: safeStr(60).optional().nullable(),
  source_page: safeStr(500).optional().nullable(),
  plan_interest: safeStr(60).optional().nullable(),
  modules_interest: z.array(safeStr(60)).max(30).optional(),
  message: safeStr(2000).optional().nullable(),
  utm: z.record(z.string().max(60), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
}).refine((v) => !!v.email || !!v.phone, { message: "email_or_phone_required" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const raw = await req.json().catch(() => null);
    const parsed = LeadSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "validation_error", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("crm_leads")
      .insert({
        full_name: body.full_name,
        email: body.email?.toLowerCase() ?? null,
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

