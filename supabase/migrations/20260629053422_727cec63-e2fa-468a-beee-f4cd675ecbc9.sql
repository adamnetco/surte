
-- Table
CREATE TABLE public.print_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_code text NOT NULL,
  label text,
  secret_hash text NOT NULL,
  version text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  printer_ids uuid[] NOT NULL DEFAULT '{}',
  last_seen_at timestamptz,
  last_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, agent_code)
);

CREATE INDEX idx_print_agents_org ON public.print_agents(organization_id);
CREATE INDEX idx_print_agents_last_seen ON public.print_agents(last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_agents TO authenticated;
GRANT ALL ON public.print_agents TO service_role;

ALTER TABLE public.print_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_agents_select_org_admins"
  ON public.print_agents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = print_agents.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin','manager')
    )
  );

CREATE POLICY "print_agents_modify_org_admins"
  ON public.print_agents FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = print_agents.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = print_agents.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- Updated at trigger
CREATE TRIGGER trg_print_agents_updated
  BEFORE UPDATE ON public.print_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Register: returns plaintext secret ONCE.
CREATE OR REPLACE FUNCTION public.print_agent_register(
  p_org uuid,
  p_code text,
  p_label text DEFAULT NULL,
  p_printer_ids uuid[] DEFAULT '{}'::uuid[]
) RETURNS TABLE(agent_id uuid, secret text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_hash text;
  v_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'superadmin') OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = p_org
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_secret := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  INSERT INTO public.print_agents(organization_id, agent_code, label, secret_hash, printer_ids)
  VALUES (p_org, p_code, p_label, v_hash, COALESCE(p_printer_ids, '{}'::uuid[]))
  ON CONFLICT (organization_id, agent_code) DO UPDATE
    SET secret_hash = EXCLUDED.secret_hash,
        label = COALESCE(EXCLUDED.label, public.print_agents.label),
        printer_ids = EXCLUDED.printer_ids,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_secret;
END
$$;

GRANT EXECUTE ON FUNCTION public.print_agent_register(uuid, text, text, uuid[]) TO authenticated;

-- Touch: edge function calls this with service role to record heartbeat.
CREATE OR REPLACE FUNCTION public.print_agent_touch(
  p_agent_id uuid,
  p_version text,
  p_capabilities jsonb,
  p_ip text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.print_agents
     SET last_seen_at = now(),
         version = COALESCE(p_version, version),
         capabilities = COALESCE(p_capabilities, capabilities),
         last_ip = COALESCE(p_ip, last_ip),
         updated_at = now()
   WHERE id = p_agent_id;
$$;

REVOKE ALL ON FUNCTION public.print_agent_touch(uuid, text, jsonb, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.print_agent_touch(uuid, text, jsonb, text) TO service_role;

-- Status view
CREATE OR REPLACE VIEW public.print_agents_status AS
SELECT
  a.*,
  CASE
    WHEN a.last_seen_at IS NULL THEN 'never'
    WHEN a.last_seen_at > now() - interval '60 seconds' THEN 'online'
    WHEN a.last_seen_at > now() - interval '5 minutes' THEN 'stale'
    ELSE 'offline'
  END AS status,
  EXTRACT(EPOCH FROM (now() - a.last_seen_at))::int AS seconds_since_seen
FROM public.print_agents a;

GRANT SELECT ON public.print_agents_status TO authenticated;
