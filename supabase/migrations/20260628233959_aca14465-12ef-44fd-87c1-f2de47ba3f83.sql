
-- =========================================================
-- API KEYS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON public.api_keys(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys(prefix);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_admin" ON public.api_keys FOR SELECT TO authenticated
  USING (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'::app_role));
CREATE POLICY "api_keys_modify_admin" ON public.api_keys FOR ALL TO authenticated
  USING (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'::app_role))
  WITH CHECK (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'::app_role));

-- =========================================================
-- WEBHOOK ENDPOINTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  description text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON public.webhook_endpoints(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints_admin" ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'::app_role))
  WITH CHECK (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'::app_role));

-- =========================================================
-- WEBHOOK DELIVERIES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | success | failed | dead
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_status_code integer,
  last_response text,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON public.webhook_deliveries(next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON public.webhook_deliveries(organization_id, created_at DESC);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_read_admin" ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (public.org_role(organization_id) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'::app_role));

-- =========================================================
-- HELPER: enqueue an event to all matching endpoints
-- =========================================================
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  p_org uuid,
  p_event_type text,
  p_payload jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.webhook_deliveries(endpoint_id, organization_id, event_type, payload)
  SELECT e.id, e.organization_id, p_event_type, p_payload
  FROM public.webhook_endpoints e
  WHERE e.organization_id = p_org
    AND e.is_active = true
    AND (p_event_type = ANY(e.events) OR '*' = ANY(e.events));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.enqueue_webhook_event(uuid,text,jsonb) TO authenticated, service_role;

-- =========================================================
-- HELPER: create new api key (returns plain secret once)
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_api_key(
  p_org uuid,
  p_name text,
  p_scopes text[] DEFAULT ARRAY['read']::text[],
  p_expires_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prefix text;
  v_secret text;
  v_full text;
  v_hash text;
  v_id uuid;
BEGIN
  IF NOT (public.org_role(p_org) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  v_prefix := 'sk_' || encode(extensions.gen_random_bytes(4),'hex');
  v_secret := encode(extensions.gen_random_bytes(24),'hex');
  v_full := v_prefix || '_' || v_secret;
  v_hash := encode(extensions.digest(v_full, 'sha256'),'hex');

  INSERT INTO public.api_keys(organization_id, name, prefix, key_hash, scopes, created_by, expires_at)
  VALUES (p_org, p_name, v_prefix, v_hash, COALESCE(p_scopes, ARRAY['read']::text[]), auth.uid(), p_expires_at)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'prefix', v_prefix, 'secret', v_full);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_api_key(uuid,text,text[],timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_api_key(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.api_keys WHERE id = p_id;
  IF v_org IS NULL THEN RETURN false; END IF;
  IF NOT (public.org_role(v_org) IN ('owner','admin') OR public.has_role(auth.uid(),'superadmin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  UPDATE public.api_keys SET revoked_at = now(), updated_at = now() WHERE id = p_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;

-- updated_at triggers
CREATE TRIGGER trg_api_keys_updated BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_webhook_endpoints_updated BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_webhook_deliveries_updated BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
