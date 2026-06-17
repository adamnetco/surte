import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let organizationId = url.searchParams.get('organization_id');
    if (!organizationId && req.method !== 'GET') {
      const body = await req.json().catch(() => ({}));
      organizationId = body?.organization_id ?? null;
    }
    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [{ data: modules, error: mErr }, { data: limits, error: lErr }, { data: counters }] = await Promise.all([
      supabase.from('v_tenant_entitlements_modules').select('*').eq('organization_id', organizationId),
      supabase.from('v_tenant_entitlements_limits').select('*').eq('organization_id', organizationId),
      supabase.from('tenant_usage_counters').select('limit_key, period_key, used').eq('organization_id', organizationId),
    ]);

    if (mErr || lErr) {
      return new Response(JSON.stringify({ error: mErr?.message ?? lErr?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const modulesMap: Record<string, { enabled: boolean; source: string; name: string; category: string | null }> = {};
    (modules ?? []).forEach((m: any) => {
      modulesMap[m.module_key] = { enabled: m.enabled, source: m.source, name: m.module_name, category: m.category };
    });

    const limitsMap: Record<string, { value: number | null; source: string; used: number; remaining: number | null }> = {};
    (limits ?? []).forEach((l: any) => {
      const used = (counters ?? []).find((c: any) => c.limit_key === l.limit_key && c.period_key === 'lifetime')?.used ?? 0;
      const value = l.effective_value;
      limitsMap[l.limit_key] = {
        value,
        source: l.source,
        used: Number(used),
        remaining: value == null ? null : Math.max(0, Number(value) - Number(used)),
      };
    });

    return new Response(
      JSON.stringify({ organization_id: organizationId, modules: modulesMap, limits: limitsMap, resolved_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
