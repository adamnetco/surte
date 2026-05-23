
-- ============ LICENCIAS DESKTOP (Fase 8) ============

CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  license_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  plan text NOT NULL DEFAULT 'desktop_standard',
  status text NOT NULL DEFAULT 'active', -- active | suspended | expired | revoked
  max_terminals integer NOT NULL DEFAULT 1 CHECK (max_terminals >= 1 AND max_terminals <= 100),
  -- Ed25519 keypair (privada solo se usa al firmar tokens, vive cifrada en secret manager)
  public_key text NOT NULL,
  signing_key_id text NOT NULL, -- referencia al secret que contiene la privada
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_licenses_org ON public.licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);

CREATE TABLE IF NOT EXISTS public.license_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  machine_fingerprint text NOT NULL,
  hostname text,
  platform text, -- win32 | darwin | linux
  app_version text,
  activated_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(license_id, machine_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_activations_license ON public.license_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_fp ON public.license_activations(machine_fingerprint);

CREATE TABLE IF NOT EXISTS public.license_audit (
  id bigserial PRIMARY KEY,
  license_id uuid REFERENCES public.licenses(id) ON DELETE CASCADE,
  activation_id uuid REFERENCES public.license_activations(id) ON DELETE SET NULL,
  event text NOT NULL, -- issued | activated | heartbeat | revoked | denied_cap | denied_expired
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lic_audit_license ON public.license_audit(license_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.desktop_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  platform text NOT NULL, -- win | mac | linux
  channel text NOT NULL DEFAULT 'stable', -- stable | beta
  download_url text NOT NULL,
  sha256 text,
  size_bytes bigint,
  release_notes text,
  is_current boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(version, platform, channel)
);
CREATE INDEX IF NOT EXISTS idx_releases_current ON public.desktop_releases(platform, is_current);

-- Trigger updated_at
CREATE TRIGGER trg_licenses_updated
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS ============
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_releases ENABLE ROW LEVEL SECURITY;

-- licenses: superadmin todo, miembros de la org lectura
CREATE POLICY "lic_superadmin_all" ON public.licenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "lic_org_members_read" ON public.licenses
  FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

-- activations: superadmin todo, miembros de la org lectura
CREATE POLICY "act_superadmin_all" ON public.license_activations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "act_org_members_read" ON public.license_activations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.licenses l
    WHERE l.id = license_activations.license_id
      AND public.is_member_of(l.organization_id)
  ));

-- audit: superadmin lectura, escritura solo desde edge functions (service role)
CREATE POLICY "audit_superadmin_read" ON public.license_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- releases: lectura pública del current, escritura solo superadmin
CREATE POLICY "rel_public_read" ON public.desktop_releases
  FOR SELECT USING (true);
CREATE POLICY "rel_superadmin_write" ON public.desktop_releases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- ============ FUNCIONES ============

CREATE OR REPLACE FUNCTION public.count_active_terminals(_license_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.license_activations
   WHERE license_id = _license_id AND revoked_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.create_license(
  _org_id uuid,
  _plan text,
  _max_terminals int,
  _public_key text,
  _signing_key_id text,
  _expires_at timestamptz DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_key uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.licenses(organization_id, plan, max_terminals, public_key, signing_key_id, expires_at, notes, created_by)
  VALUES (_org_id, COALESCE(_plan,'desktop_standard'), GREATEST(1, _max_terminals), _public_key, _signing_key_id, _expires_at, _notes, auth.uid())
  RETURNING id, license_key INTO v_id, v_key;

  INSERT INTO public.license_audit(license_id, event, payload)
  VALUES (v_id, 'issued', jsonb_build_object('max_terminals', _max_terminals, 'plan', _plan));

  RETURN jsonb_build_object('license_id', v_id, 'license_key', v_key);
END $$;

CREATE OR REPLACE FUNCTION public.register_activation(
  _license_key uuid,
  _fingerprint text,
  _hostname text,
  _platform text,
  _app_version text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lic public.licenses%ROWTYPE;
  v_act_id uuid;
  v_active int;
BEGIN
  SELECT * INTO v_lic FROM public.licenses WHERE license_key = _license_key LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_license'; END IF;
  IF v_lic.status <> 'active' THEN RAISE EXCEPTION 'license_%', v_lic.status; END IF;
  IF v_lic.expires_at IS NOT NULL AND v_lic.expires_at < now() THEN
    INSERT INTO public.license_audit(license_id, event, payload) VALUES (v_lic.id, 'denied_expired', jsonb_build_object('fp', _fingerprint));
    RAISE EXCEPTION 'license_expired';
  END IF;

  -- ¿ya existe esa máquina? entonces reactivamos
  SELECT id INTO v_act_id FROM public.license_activations
   WHERE license_id = v_lic.id AND machine_fingerprint = _fingerprint;

  IF v_act_id IS NOT NULL THEN
    UPDATE public.license_activations
       SET revoked_at = NULL, revoke_reason = NULL,
           hostname = _hostname, platform = _platform, app_version = _app_version,
           last_heartbeat_at = now()
     WHERE id = v_act_id;
  ELSE
    SELECT public.count_active_terminals(v_lic.id) INTO v_active;
    IF v_active >= v_lic.max_terminals THEN
      INSERT INTO public.license_audit(license_id, event, payload)
      VALUES (v_lic.id, 'denied_cap', jsonb_build_object('fp', _fingerprint, 'active', v_active, 'cap', v_lic.max_terminals));
      RAISE EXCEPTION 'terminal_cap_reached';
    END IF;
    INSERT INTO public.license_activations(license_id, machine_fingerprint, hostname, platform, app_version)
    VALUES (v_lic.id, _fingerprint, _hostname, _platform, _app_version)
    RETURNING id INTO v_act_id;
  END IF;

  INSERT INTO public.license_audit(license_id, activation_id, event, payload)
  VALUES (v_lic.id, v_act_id, 'activated', jsonb_build_object('fp', _fingerprint, 'host', _hostname));

  RETURN jsonb_build_object(
    'activation_id', v_act_id,
    'license_id', v_lic.id,
    'organization_id', v_lic.organization_id,
    'max_terminals', v_lic.max_terminals,
    'expires_at', v_lic.expires_at,
    'signing_key_id', v_lic.signing_key_id
  );
END $$;

CREATE OR REPLACE FUNCTION public.heartbeat_activation(
  _license_key uuid, _fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lic public.licenses%ROWTYPE; v_act public.license_activations%ROWTYPE;
BEGIN
  SELECT * INTO v_lic FROM public.licenses WHERE license_key = _license_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_license'; END IF;
  SELECT * INTO v_act FROM public.license_activations
    WHERE license_id = v_lic.id AND machine_fingerprint = _fingerprint;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_activated'; END IF;
  IF v_act.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'revoked'; END IF;
  IF v_lic.status <> 'active' THEN RAISE EXCEPTION 'license_%', v_lic.status; END IF;
  IF v_lic.expires_at IS NOT NULL AND v_lic.expires_at < now() THEN RAISE EXCEPTION 'license_expired'; END IF;

  UPDATE public.license_activations SET last_heartbeat_at = now() WHERE id = v_act.id;
  RETURN jsonb_build_object('ok', true, 'expires_at', v_lic.expires_at, 'status', v_lic.status);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_activation(_activation_id uuid, _reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lic_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.license_activations
     SET revoked_at = now(), revoke_reason = _reason
   WHERE id = _activation_id
  RETURNING license_id INTO v_lic_id;
  INSERT INTO public.license_audit(license_id, activation_id, event, payload)
  VALUES (v_lic_id, _activation_id, 'revoked', jsonb_build_object('reason', _reason));
  RETURN FOUND;
END $$;

-- Storage bucket para instaladores desktop
INSERT INTO storage.buckets (id, name, public)
VALUES ('desktop-releases', 'desktop-releases', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "desktop_releases_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'desktop-releases');
CREATE POLICY "desktop_releases_superadmin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'desktop-releases' AND public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "desktop_releases_superadmin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'desktop-releases' AND public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "desktop_releases_superadmin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'desktop-releases' AND public.has_role(auth.uid(), 'superadmin'));
