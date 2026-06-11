import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Etapa 27: schema estricto.
const PayloadSchema = z.object({
  phone: z.string().max(30).optional().nullable(),
  message: z.string().min(1).max(2000),
  apikey: z.string().max(80).optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
});


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // verify_jwt=true; sólo admin/superadmin/agente pueden disparar mensajes.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const isServiceCall = token === serviceRoleKey;
    let callerUserId = "service";
    if (!isServiceCall) {
      const sb = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await sb.auth.getClaims(token);
      const userId = claims?.claims?.sub;
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      callerUserId = userId;
      const { data: allowed } = await supabase.rpc('has_any_role', {
        _user_id: userId,
        _roles: ['admin', 'superadmin', 'agente'],
      });
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const rawBody = await req.json().catch(() => null);
    const parsedBody = PayloadSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: 'invalid_payload', details: parsedBody.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { phone, message, apikey, organization_id } = parsedBody.data;

    // Etapa 24: scope app_settings por organización (fallback global).
    const { getOrgScopedSettings, resolveCallerOrgId } = await import('../_shared/tenant-guard.ts');
    const orgId = await resolveCallerOrgId(supabase, callerUserId, isServiceCall, organization_id ?? null);
    const settings = await getOrgScopedSettings(supabase, orgId, ['callmebot_api_key', 'callmebot_phone']);

    const targetPhone = phone || settings.callmebot_phone;
    const targetApiKey = apikey || settings.callmebot_api_key;


    if (!targetPhone || !targetApiKey || !message) {
      return new Response(JSON.stringify({ error: 'Faltan datos: phone, apikey y message son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CallMeBot WhatsApp API
    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = targetPhone.replace(/\D/g, '');
    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMsg}&apikey=${targetApiKey}`;

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
      console.error('CallMeBot error:', text);
      return new Response(JSON.stringify({ success: false, error: text }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, response: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('CallMeBot function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
