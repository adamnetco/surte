
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recency_days int,
  frequency int NOT NULL DEFAULT 0,
  monetary numeric NOT NULL DEFAULT 0,
  r_score int CHECK (r_score BETWEEN 1 AND 5),
  f_score int CHECK (f_score BETWEEN 1 AND 5),
  m_score int CHECK (m_score BETWEEN 1 AND 5),
  segment text NOT NULL,
  last_purchase_at timestamptz,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_segments_org ON public.customer_segments(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_segment ON public.customer_segments(organization_id, segment);

GRANT SELECT ON public.customer_segments TO authenticated;
GRANT ALL ON public.customer_segments TO service_role;

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_customer_segments" ON public.customer_segments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = customer_segments.organization_id
      AND user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'superadmin')
);

CREATE OR REPLACE FUNCTION public.recompute_rfm(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id AND user_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT
      po.customer_profile_id AS profile_id,
      MAX(po.created_at) AS last_purchase_at,
      EXTRACT(DAY FROM (now() - MAX(po.created_at)))::int AS recency_days,
      COUNT(*)::int AS frequency,
      COALESCE(SUM(po.total), 0)::numeric AS monetary
    FROM public.pos_orders po
    WHERE po.organization_id = p_organization_id
      AND po.customer_profile_id IS NOT NULL
      AND po.status IN ('completed','paid','closed')
    GROUP BY po.customer_profile_id
  ),
  scored AS (
    SELECT
      b.*,
      (6 - NTILE(5) OVER (ORDER BY recency_days ASC)) AS r_score,
      NTILE(5) OVER (ORDER BY frequency ASC) AS f_score,
      NTILE(5) OVER (ORDER BY monetary ASC) AS m_score
    FROM base b
  ),
  classified AS (
    SELECT
      s.*,
      CASE
        WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'Champions'
        WHEN r_score >= 3 AND f_score >= 3 THEN 'Loyal'
        WHEN r_score >= 4 AND frequency <= 1 THEN 'New'
        WHEN r_score <= 2 AND f_score >= 3 THEN 'At Risk'
        WHEN r_score <= 2 AND f_score <= 2 THEN 'Hibernating'
        ELSE 'Potential'
      END AS segment
    FROM scored s
  )
  INSERT INTO public.customer_segments (
    organization_id, profile_id, recency_days, frequency, monetary,
    r_score, f_score, m_score, segment, last_purchase_at, computed_at
  )
  SELECT
    p_organization_id, c.profile_id, c.recency_days, c.frequency, c.monetary,
    c.r_score, c.f_score, c.m_score, c.segment, c.last_purchase_at, now()
  FROM classified c
  ON CONFLICT (organization_id, profile_id) DO UPDATE SET
    recency_days = EXCLUDED.recency_days,
    frequency = EXCLUDED.frequency,
    monetary = EXCLUDED.monetary,
    r_score = EXCLUDED.r_score,
    f_score = EXCLUDED.f_score,
    m_score = EXCLUDED.m_score,
    segment = EXCLUDED.segment,
    last_purchase_at = EXCLUDED.last_purchase_at,
    computed_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('updated', v_count, 'computed_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_rfm(uuid) TO authenticated;
