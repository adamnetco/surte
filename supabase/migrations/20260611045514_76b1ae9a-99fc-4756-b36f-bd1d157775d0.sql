CREATE TABLE IF NOT EXISTS public.csp_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_uri text,
  violated_directive text,
  effective_directive text,
  blocked_uri text,
  source_file text,
  line_number int,
  column_number int,
  disposition text,
  status_code int,
  user_agent text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.csp_violations TO authenticated;
GRANT INSERT ON public.csp_violations TO anon, authenticated;
GRANT ALL ON public.csp_violations TO service_role;

ALTER TABLE public.csp_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can report a CSP violation"
  ON public.csp_violations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Superadmin can read CSP violations"
  ON public.csp_violations FOR SELECT
  TO authenticated
  USING (public.is_master_superadmin(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_csp_violations_created ON public.csp_violations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_csp_violations_directive ON public.csp_violations (effective_directive, blocked_uri);