
ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.print_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.pos_receipt_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS snapshot jsonb,
  ADD COLUMN IF NOT EXISTS reprint_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reprint_reason text;

CREATE INDEX IF NOT EXISTS idx_print_jobs_parent ON public.print_jobs(parent_job_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_org_created ON public.print_jobs(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.print_job_reprint(_job_id uuid, _reason text DEFAULT NULL, _printer_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.print_jobs%ROWTYPE;
  new_id uuid;
  uid uuid := auth.uid();
BEGIN
  SELECT * INTO src FROM public.print_jobs WHERE id = _job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'print_job % not found', _job_id; END IF;

  IF NOT (
    public.has_role(uid, 'superadmin') OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = src.organization_id
        AND om.user_id = uid
        AND om.role IN ('owner','admin','manager')
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.print_jobs (
    organization_id, printer_id, terminal_id, pos_order_id, kind, copies,
    payload, escpos_b64, status, attempts, client_uuid, created_by,
    parent_job_id, template_id, channel, snapshot, reprint_count, reprint_reason
  ) VALUES (
    src.organization_id,
    COALESCE(_printer_id, src.printer_id),
    src.terminal_id, src.pos_order_id, src.kind, src.copies,
    src.payload, src.escpos_b64, 'queued', 0, gen_random_uuid(), uid,
    COALESCE(src.parent_job_id, src.id), src.template_id, src.channel, src.snapshot,
    COALESCE(src.reprint_count, 0) + 1, _reason
  ) RETURNING id INTO new_id;

  UPDATE public.print_jobs SET reprint_count = COALESCE(reprint_count,0) + 1
   WHERE id = COALESCE(src.parent_job_id, src.id);

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.print_job_reprint(uuid, text, uuid) TO authenticated;
