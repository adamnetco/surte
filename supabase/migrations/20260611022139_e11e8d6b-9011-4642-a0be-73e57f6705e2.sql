-- ============================================================
-- Etapa 2: RPC atómico provision_organization
-- ============================================================

-- 1) Idempotencia por payment_reference
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS licenses_payment_reference_uidx
  ON public.licenses(payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 2) RPC atómico
CREATE OR REPLACE FUNCTION public.provision_organization(
  _owner_user_id    uuid,
  _owner_email      text,
  _org_name         text,
  _org_slug         text,
  _business_type    text DEFAULT 'minimercado',
  _plan             text DEFAULT 'desktop_standard',
  _max_terminals    int  DEFAULT 1,
  _public_key       text DEFAULT NULL,
  _signing_key_id   text DEFAULT NULL,
  _expires_at       timestamptz DEFAULT NULL,
  _modules          text[] DEFAULT ARRAY['pos','inventory','catalog']::text[],
  _payment_reference text DEFAULT NULL,
  _phone            text DEFAULT NULL,
  _full_name        text DEFAULT NULL,
  _metadata         jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller          uuid := auth.uid();
  v_is_service      boolean := (current_setting('role', true) = 'service_role');
  v_org_id          uuid;
  v_license_id      uuid;
  v_license_key     uuid;
  v_location_id     uuid;
  v_module          text;
  v_existing        record;
  v_slug            text;
  v_slug_base       text;
  v_n               int := 0;
BEGIN
  -- Autorización: superadmin o service_role
  IF NOT v_is_service AND NOT public.is_master_superadmin(v_caller)
     AND NOT public.has_role(v_caller, 'superadmin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: provision_organization requires superadmin or service_role';
  END IF;

  IF _owner_user_id IS NULL OR _owner_email IS NULL OR _org_name IS NULL THEN
    RAISE EXCEPTION 'missing_required_fields';
  END IF;

  -- Idempotencia por payment_reference
  IF _payment_reference IS NOT NULL THEN
    SELECT l.id, l.organization_id, l.license_key
      INTO v_existing
      FROM public.licenses l
     WHERE l.payment_reference = _payment_reference
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'idempotent', true,
        'organization_id', v_existing.organization_id,
        'license_id', v_existing.id,
        'license_key', v_existing.license_key
      );
    END IF;
  END IF;

  -- Slug único
  v_slug_base := regexp_replace(lower(coalesce(_org_slug, _org_name)), '[^a-z0-9]+', '-', 'g');
  v_slug_base := trim(both '-' from v_slug_base);
  IF v_slug_base = '' THEN v_slug_base := 'org-' || substr(gen_random_uuid()::text,1,8); END IF;
  v_slug := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_slug_base || '-' || v_n;
  END LOOP;

  -- 1. Organización
  INSERT INTO public.organizations (slug, name, business_type, is_active, settings)
  VALUES (v_slug, _org_name, COALESCE(_business_type,'minimercado'), true,
          jsonb_build_object('provisioned_at', now(), 'payment_reference', _payment_reference) || COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO v_org_id;

  -- 2. Membresía owner/admin
  INSERT INTO public.organization_members (organization_id, user_id, role, is_active, invited_by)
  VALUES (v_org_id, _owner_user_id, 'admin', true, v_caller)
  ON CONFLICT DO NOTHING;

  -- 3. Profile (link al user)
  INSERT INTO public.profiles (user_id, full_name, phone, organization_id, business_type)
  VALUES (_owner_user_id, _full_name, _phone, v_org_id,
          COALESCE(_business_type,'minimercado')::public.business_type)
  ON CONFLICT (user_id) DO UPDATE
    SET organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        updated_at = now();

  -- 4. Sede principal
  INSERT INTO public.locations (organization_id, name, is_main, is_active, city, timezone)
  VALUES (v_org_id, 'Sede principal', true, true, 'Bucaramanga', 'America/Bogota')
  RETURNING id INTO v_location_id;

  -- 5. Licencia
  INSERT INTO public.licenses (
    organization_id, plan, status, max_terminals,
    public_key, signing_key_id, expires_at,
    payment_reference, contact_email, business_name,
    metadata, created_by
  ) VALUES (
    v_org_id, COALESCE(_plan,'desktop_standard'), 'active', GREATEST(1, COALESCE(_max_terminals,1)),
    COALESCE(_public_key, 'pending'), COALESCE(_signing_key_id, 'pending'), _expires_at,
    _payment_reference, _owner_email, _org_name,
    COALESCE(_metadata,'{}'::jsonb), v_caller
  )
  RETURNING id, license_key INTO v_license_id, v_license_key;

  INSERT INTO public.license_audit(license_id, event, payload)
  VALUES (v_license_id, 'provisioned',
          jsonb_build_object('plan', _plan, 'max_terminals', _max_terminals,
                             'owner', _owner_email, 'payment_reference', _payment_reference));

  -- 6. Módulos
  FOREACH v_module IN ARRAY COALESCE(_modules, ARRAY[]::text[]) LOOP
    INSERT INTO public.organization_modules (organization_id, module_key, enabled)
    VALUES (v_org_id, v_module, true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 7. Onboarding progress
  INSERT INTO public.onboarding_progress (organization_id, company_done, location_done)
  VALUES (v_org_id, true, true)
  ON CONFLICT (organization_id) DO NOTHING;

  -- 8. Welcome notifications (encoladas en sync_outbox)
  INSERT INTO public.sync_outbox (target, payload, organization_id, status, next_attempt_at)
  VALUES (
    'welcome_email',
    jsonb_build_object(
      'organization_id', v_org_id,
      'user_id', _owner_user_id,
      'email', _owner_email,
      'full_name', _full_name,
      'org_name', _org_name,
      'org_slug', v_slug,
      'license_id', v_license_id
    ),
    v_org_id, 'pending', now()
  );

  IF _phone IS NOT NULL AND length(regexp_replace(_phone,'\D','','g')) >= 10 THEN
    INSERT INTO public.sync_outbox (target, payload, organization_id, status, next_attempt_at)
    VALUES (
      'welcome_whatsapp',
      jsonb_build_object(
        'organization_id', v_org_id,
        'user_id', _owner_user_id,
        'phone', regexp_replace(_phone,'\D','','g'),
        'full_name', _full_name,
        'org_name', _org_name,
        'org_slug', v_slug,
        'license_id', v_license_id
      ),
      v_org_id, 'pending', now()
    );
  END IF;

  RETURN jsonb_build_object(
    'idempotent', false,
    'organization_id', v_org_id,
    'owner_user_id', _owner_user_id,
    'license_id', v_license_id,
    'license_key', v_license_key,
    'slug', v_slug,
    'location_id', v_location_id
  );
END;
$$;

-- Permisos: solo authenticated (superadmin via has_role guard) y service_role
REVOKE ALL ON FUNCTION public.provision_organization(uuid,text,text,text,text,text,int,text,text,timestamptz,text[],text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_organization(uuid,text,text,text,text,text,int,text,text,timestamptz,text[],text,text,text,jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.provision_organization IS
  'Etapa 2 SaaS refactor: activación atómica de una licencia (organización + owner + membresía + licencia + módulos + sede + onboarding + welcome outbox). Idempotente por payment_reference.';
