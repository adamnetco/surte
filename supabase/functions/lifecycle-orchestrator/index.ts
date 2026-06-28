// Lifecycle email orchestrator — Ola 20 Slice 1
// Reads due lifecycle_enrollments and dispatches templated emails idempotently.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Enrollment {
  id: string
  organization_id: string
  recipient_email: string
  sequence: string
  current_step: number
  context: Record<string, any>
}

// Sequence step matrix: step index -> {template, offsetDays to next, terminal}
const SEQUENCES: Record<string, Array<{ template: string; nextDays: number | null }>> = {
  trial_onboarding: [
    { template: 'trial-onboarding', nextDays: 6 },   // D+1
    { template: 'trial-onboarding', nextDays: null }, // D+7 (terminal — hands off to trial_ending)
  ],
  trial_ending: [
    { template: 'trial-ending', nextDays: null },
  ],
  payment_recovered: [
    { template: 'organization-welcome', nextDays: null },
  ],
  winback_inactive: [
    { template: 'winback-inactive', nextDays: 7 },
    { template: 'winback-inactive', nextDays: null },
  ],
  approaching_limit: [
    { template: 'approaching-limit', nextDays: null },
  ],
  cancellation_followup: [
    { template: 'cancellation-followup', nextDays: null },
  ],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  })

  const { data: due, error } = await supabase
    .from('lifecycle_enrollments')
    .select('id, organization_id, recipient_email, sequence, current_step, context')
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(100)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0, skipped = 0, failed = 0
  for (const enr of (due ?? []) as Enrollment[]) {
    const steps = SEQUENCES[enr.sequence]
    const stepDef = steps?.[enr.current_step]
    if (!stepDef) {
      await supabase.from('lifecycle_enrollments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', enr.id)
      skipped++
      continue
    }

    // Suppression check
    const { data: sup } = await supabase
      .from('suppressed_emails')
      .select('email').eq('email', enr.recipient_email).maybeSingle()
    if (sup) {
      await supabase.from('lifecycle_enrollments')
        .update({ status: 'suppressed' }).eq('id', enr.id)
      skipped++
      continue
    }

    const idempotencyKey = `lifecycle:${enr.id}:${enr.current_step}`

    // A/B subject variant selection (weighted random)
    let chosenVariant: string | null = null
    let chosenSubject: string | null = null
    const { data: variants } = await supabase
      .from('lifecycle_subject_variants')
      .select('variant_key, subject, weight')
      .eq('sequence', enr.sequence)
      .eq('step', enr.current_step)
      .eq('is_active', true)
    if (variants && variants.length > 0) {
      const totalW = variants.reduce((a: number, v: any) => a + (v.weight ?? 1), 0)
      let r = Math.random() * totalW
      for (const v of variants as any[]) {
        r -= v.weight ?? 1
        if (r <= 0) { chosenVariant = v.variant_key; chosenSubject = v.subject; break }
      }
    }

    try {
      const { error: sendErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: stepDef.template,
          recipientEmail: enr.recipient_email,
          idempotencyKey,
          templateData: {
            ...enr.context,
            org_id: enr.organization_id,
            ...(chosenSubject ? { subject_override: chosenSubject } : {}),
          },
        },
      })
      if (sendErr) throw sendErr

      await supabase.from('lifecycle_sends').insert({
        enrollment_id: enr.id,
        sequence: enr.sequence,
        step: enr.current_step,
        template_name: stepDef.template,
        recipient_email: enr.recipient_email,
        idempotency_key: idempotencyKey,
        status: 'sent',
        subject_variant: chosenVariant,
        subject_used: chosenSubject,
      })

      const updates: Record<string, any> = { current_step: enr.current_step + 1 }
      if (stepDef.nextDays === null) {
        updates.status = 'completed'
        updates.completed_at = new Date().toISOString()
      } else {
        updates.next_send_at = new Date(Date.now() + stepDef.nextDays * 86400000).toISOString()
      }
      await supabase.from('lifecycle_enrollments').update(updates).eq('id', enr.id)
      sent++
    } catch (e) {
      failed++
      await supabase.from('lifecycle_sends').insert({
        enrollment_id: enr.id,
        sequence: enr.sequence,
        step: enr.current_step,
        template_name: stepDef.template,
        recipient_email: enr.recipient_email,
        idempotency_key: idempotencyKey,
        status: 'failed',
        error: String((e as Error)?.message ?? e),
        subject_variant: chosenVariant,
        subject_used: chosenSubject,
      }).then(() => {})
    }

  }

  return new Response(
    JSON.stringify({ ok: true, sent, skipped, failed, scanned: due?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
