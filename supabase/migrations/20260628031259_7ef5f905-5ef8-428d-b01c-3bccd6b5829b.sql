
CREATE TABLE IF NOT EXISTS public.lifecycle_subject_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence TEXT NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  variant_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sequence, step, variant_key)
);

GRANT SELECT ON public.lifecycle_subject_variants TO authenticated;
GRANT ALL ON public.lifecycle_subject_variants TO service_role;
ALTER TABLE public.lifecycle_subject_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_manage_subject_variants" ON public.lifecycle_subject_variants;
CREATE POLICY "superadmin_manage_subject_variants"
ON public.lifecycle_subject_variants FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "authenticated_read_subject_variants" ON public.lifecycle_subject_variants;
CREATE POLICY "authenticated_read_subject_variants"
ON public.lifecycle_subject_variants FOR SELECT TO authenticated
USING (true);

ALTER TABLE public.lifecycle_sends
  ADD COLUMN IF NOT EXISTS subject_variant TEXT,
  ADD COLUMN IF NOT EXISTS subject_used TEXT;

CREATE INDEX IF NOT EXISTS idx_lifecycle_sends_variant
  ON public.lifecycle_sends (sequence, step, subject_variant);

CREATE OR REPLACE VIEW public.v_lifecycle_ab_30d AS
SELECT
  s.sequence,
  s.step,
  COALESCE(s.subject_variant, 'default') AS variant_key,
  MAX(s.subject_used) AS subject_sample,
  COUNT(*) FILTER (WHERE s.status = 'sent') AS sent,
  COUNT(*) FILTER (WHERE s.status = 'failed') AS failed,
  COUNT(*) AS total,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE s.status = 'sent')
    / NULLIF(COUNT(*), 0), 2
  ) AS delivery_rate
FROM public.lifecycle_sends s
WHERE s.sent_at > now() - interval '30 days'
GROUP BY s.sequence, s.step, COALESCE(s.subject_variant, 'default');

GRANT SELECT ON public.v_lifecycle_ab_30d TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_lifecycle_suppression_30d AS
SELECT
  e.sequence,
  COUNT(*) FILTER (WHERE e.status = 'suppressed') AS suppressed_count,
  COUNT(DISTINCT e.recipient_email) FILTER (WHERE e.status = 'suppressed') AS suppressed_unique,
  COUNT(*) AS total_enrollments,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE e.status = 'suppressed')
    / NULLIF(COUNT(*), 0), 2
  ) AS suppression_rate
FROM public.lifecycle_enrollments e
WHERE e.created_at > now() - interval '30 days'
GROUP BY e.sequence;

GRANT SELECT ON public.v_lifecycle_suppression_30d TO authenticated, service_role;

INSERT INTO public.lifecycle_subject_variants (sequence, step, variant_key, subject, weight)
VALUES
  ('trial_onboarding', 0, 'A', 'Tu prueba de SistecPOS — dejémosla lista en 5 minutos', 1),
  ('trial_onboarding', 0, 'B', '¿Listo para vender? Activa tu POS en 5 pasos', 1),
  ('trial_ending', 0, 'A', 'Tu prueba termina pronto — activa tu plan ahora', 1),
  ('trial_ending', 0, 'B', 'Última oportunidad: no pierdas tu configuración', 1)
ON CONFLICT (sequence, step, variant_key) DO NOTHING;
