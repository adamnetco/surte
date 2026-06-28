// Lifecycle enroller — Ola 20 Slice 2
// Periodic cron worker that enrolls organizations into:
//  - trial_ending (subscriptions.status=trialing with trial_ends_at in next 3 days)
//  - approaching_limit (tenant_usage_counters used/limit >= 0.8 in current period)
// Idempotent: skips orgs that already have an active/recent enrollment for the same sequence+period.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnrollmentInput {
  organization_id: string
  user_id: string | null
  recipient_email: string
  sequence: 'trial_ending' | 'approaching_limit'
  context: Record<string, unknown>
  dedupe_window_days: number
}

async function resolveOwnerEmail(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<{ user_id: string; email: string } | null> {
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('role', ['owner', 'admin'])
    .order('joined_at', { ascending: true })
    .limit(5)

  for (const m of members ?? []) {
    if (!m.user_id) continue
    const { data: u } = await supabase.auth.admin.getUserById(m.user_id as string)
    if (u?.user?.email) return { user_id: m.user_id as string, email: u.user.email }
  }
  return null
}

async function enrollIfFresh(
  supabase: ReturnType<typeof createClient>,
  input: EnrollmentInput,
): Promise<'enrolled' | 'skipped'> {
  const since = new Date(Date.now() - input.dedupe_window_days * 86400e3).toISOString()
  const { data: existing } = await supabase
    .from('lifecycle_enrollments')
    .select('id')
    .eq('organization_id', input.organization_id)
    .eq('sequence', input.sequence)
    .gte('enrolled_at', since)
    .limit(1)
  if (existing && existing.length > 0) return 'skipped'

  await supabase.from('lifecycle_enrollments').insert({
    organization_id: input.organization_id,
    user_id: input.user_id,
    recipient_email: input.recipient_email,
    sequence: input.sequence,
    status: 'active',
    current_step: 0,
    next_send_at: new Date().toISOString(),
    context: input.context,
  })
  return 'enrolled'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  })

  const stats = { trial_ending: { enrolled: 0, skipped: 0 }, approaching_limit: { enrolled: 0, skipped: 0 } }

  // --- trial_ending: trial ending within 3 days ---
  const horizon = new Date(Date.now() + 3 * 86400e3).toISOString()
  const { data: trials } = await supabase
    .from('subscriptions')
    .select('organization_id, trial_ends_at, plan, plan_id')
    .eq('status', 'trialing')
    .gte('trial_ends_at', new Date().toISOString())
    .lte('trial_ends_at', horizon)
    .limit(500)

  for (const s of trials ?? []) {
    const owner = await resolveOwnerEmail(supabase, s.organization_id as string)
    if (!owner) continue
    const res = await enrollIfFresh(supabase, {
      organization_id: s.organization_id as string,
      user_id: owner.user_id,
      recipient_email: owner.email,
      sequence: 'trial_ending',
      context: { trial_ends_at: s.trial_ends_at, plan: s.plan },
      dedupe_window_days: 7,
    })
    stats.trial_ending[res]++
  }

  // --- approaching_limit: usage >= 80% of plan limit for current period ---
  const { data: counters } = await supabase
    .from('tenant_usage_counters')
    .select('organization_id, limit_key, used, period_key')
    .limit(1000)

  // Build a map of plan limit values by org
  const orgIds = Array.from(new Set((counters ?? []).map((c) => c.organization_id as string)))
  const planByOrg = new Map<string, string>()
  if (orgIds.length > 0) {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('organization_id, plan_id, status')
      .in('organization_id', orgIds)
      .in('status', ['active', 'trialing', 'past_due'])
    for (const s of subs ?? []) planByOrg.set(s.organization_id as string, s.plan_id as string)
  }

  // Pre-fetch plan limits in bulk per encountered plan
  const planIds = Array.from(new Set(Array.from(planByOrg.values()).filter(Boolean)))
  const limitMap = new Map<string, number>() // `${plan_id}:${limit_key}` -> value
  if (planIds.length > 0) {
    const { data: pls } = await supabase
      .from('plan_limits')
      .select('plan_id, limit_key, value')
      .in('plan_id', planIds)
    for (const pl of pls ?? []) {
      limitMap.set(`${pl.plan_id}:${pl.limit_key}`, Number(pl.value))
    }
  }

  for (const c of counters ?? []) {
    const orgId = c.organization_id as string
    const planId = planByOrg.get(orgId)
    if (!planId) continue
    const limit = limitMap.get(`${planId}:${c.limit_key}`)
    if (!limit || limit <= 0) continue
    const used = Number(c.used ?? 0)
    const ratio = used / limit
    if (ratio < 0.8 || ratio >= 1) continue // <80% = ok; >=100% handled by gating, not lifecycle
    const owner = await resolveOwnerEmail(supabase, orgId)
    if (!owner) continue
    const res = await enrollIfFresh(supabase, {
      organization_id: orgId,
      user_id: owner.user_id,
      recipient_email: owner.email,
      sequence: 'approaching_limit',
      context: {
        limit_key: c.limit_key,
        used,
        limit,
        ratio: Math.round(ratio * 100) / 100,
        period_key: c.period_key,
      },
      dedupe_window_days: 14,
    })
    stats.approaching_limit[res]++
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
