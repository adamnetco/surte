-- ============================================================================
-- Tenant lifecycle: audit, soft delete, snapshot export/import
-- ============================================================================

-- 1) Columns on organizations -------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS archived_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at
  ON public.organizations(deleted_at) WHERE deleted_at IS NOT NULL;

-- 2) Audit log ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  organization_slug text,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenant_audit_log TO authenticated;
GRANT ALL    ON public.tenant_audit_log TO service_role;

ALTER TABLE public.tenant_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_superadmin" ON public.tenant_audit_log;
CREATE POLICY "audit_select_superadmin"
  ON public.tenant_audit_log FOR SELECT TO authenticated
  USING (public.is_master_superadmin(auth.uid())
         OR public.has_role(auth.uid(), 'superadmin'::public.app_role));

-- Insert/Update/Delete: forbidden from client; only SECURITY DEFINER funcs write.

-- 3) Internal logger ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tenant_log(_org uuid, _action text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_email text;
BEGIN
  SELECT slug INTO v_slug FROM public.organizations WHERE id = _org;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.tenant_audit_log(organization_id, organization_slug, actor_id, actor_email, action, payload)
  VALUES (_org, v_slug, auth.uid(), v_email, _action, COALESCE(_payload,'{}'::jsonb));
END $$;

-- 4) Authorization helper -----------------------------------------------------
CREATE OR REPLACE FUNCTION public._require_superadmin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN; END IF;
  IF public.is_master_superadmin(auth.uid()) THEN RETURN; END IF;
  IF public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN RETURN; END IF;
  RAISE EXCEPTION 'forbidden: superadmin required';
END $$;

-- 5) Block direct DELETE on organizations ------------------------------------
CREATE OR REPLACE FUNCTION public._tg_block_org_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_org_delete', true) <> 'true' THEN
    RAISE EXCEPTION 'direct DELETE on organizations forbidden — use purge_tenant_hard()';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_block_org_delete ON public.organizations;
CREATE TRIGGER trg_block_org_delete
  BEFORE DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public._tg_block_org_delete();

-- 6) Snapshot export ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_tenant_snapshot(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public._require_superadmin();
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id) THEN
    RAISE EXCEPTION 'organization not found: %', _org_id;
  END IF;

  SELECT jsonb_build_object(
    'version', 1,
    'exported_at', now(),
    'source_org_id', _org_id,
    'organization',         (SELECT to_jsonb(o.*) FROM public.organizations o WHERE o.id = _org_id),
    'tenant_sites',         COALESCE((SELECT jsonb_agg(to_jsonb(s.*)) FROM public.tenant_sites s WHERE s.organization_id = _org_id), '[]'::jsonb),
    'tenant_domains',       COALESCE((SELECT jsonb_agg(to_jsonb(d.*)) FROM public.tenant_domains d JOIN public.tenant_sites s ON s.id = d.site_id WHERE s.organization_id = _org_id), '[]'::jsonb),
    'organization_members', COALESCE((SELECT jsonb_agg(to_jsonb(m.*)) FROM public.organization_members m WHERE m.organization_id = _org_id), '[]'::jsonb),
    'organization_modules', COALESCE((SELECT jsonb_agg(to_jsonb(m.*)) FROM public.organization_modules m WHERE m.organization_id = _org_id), '[]'::jsonb),
    'licenses',             COALESCE((SELECT jsonb_agg(to_jsonb(l.*)) FROM public.licenses l WHERE l.organization_id = _org_id), '[]'::jsonb),
    'locations',            COALESCE((SELECT jsonb_agg(to_jsonb(l.*)) FROM public.locations l WHERE l.organization_id = _org_id), '[]'::jsonb),
    'categories',           COALESCE((SELECT jsonb_agg(to_jsonb(c.*)) FROM public.categories c WHERE c.organization_id = _org_id), '[]'::jsonb),
    'brands',               COALESCE((SELECT jsonb_agg(to_jsonb(b.*)) FROM public.brands b WHERE b.organization_id = _org_id), '[]'::jsonb),
    'products',             COALESCE((SELECT jsonb_agg(to_jsonb(p.*)) FROM public.products p WHERE p.organization_id = _org_id), '[]'::jsonb),
    'product_presentations',COALESCE((SELECT jsonb_agg(to_jsonb(pp.*)) FROM public.product_presentations pp JOIN public.products p ON p.id = pp.product_id WHERE p.organization_id = _org_id), '[]'::jsonb),
    'modifier_groups',      COALESCE((SELECT jsonb_agg(to_jsonb(g.*)) FROM public.modifier_groups g WHERE g.organization_id = _org_id), '[]'::jsonb),
    'modifier_options',     COALESCE((SELECT jsonb_agg(to_jsonb(o.*)) FROM public.modifier_options o WHERE o.organization_id = _org_id), '[]'::jsonb),
    'hero_slides',          COALESCE((SELECT jsonb_agg(to_jsonb(h.*)) FROM public.hero_slides h WHERE h.organization_id = _org_id), '[]'::jsonb),
    'banners',              COALESCE((SELECT jsonb_agg(to_jsonb(b.*)) FROM public.banners b WHERE b.organization_id = _org_id), '[]'::jsonb),
    'landing_pages',        COALESCE((SELECT jsonb_agg(to_jsonb(lp.*)) FROM public.landing_pages lp WHERE lp.organization_id = _org_id), '[]'::jsonb),
    'landing_sections',     COALESCE((SELECT jsonb_agg(to_jsonb(ls.*)) FROM public.landing_sections ls JOIN public.landing_pages lp ON lp.id = ls.landing_page_id WHERE lp.organization_id = _org_id), '[]'::jsonb),
    'featured_sections',    COALESCE((SELECT jsonb_agg(to_jsonb(f.*)) FROM public.featured_sections f WHERE f.organization_id = _org_id), '[]'::jsonb),
    'gallery',              COALESCE((SELECT jsonb_agg(to_jsonb(g.*)) FROM public.gallery g WHERE g.organization_id = _org_id), '[]'::jsonb)
  ) INTO v;

  PERFORM public._tenant_log(_org_id, 'export_snapshot', jsonb_build_object('bytes', octet_length(v::text)));
  RETURN v;
END $$;

-- 7) Snapshot import ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_tenant_snapshot(_payload jsonb, _overwrite boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_exists boolean;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
BEGIN
  PERFORM public._require_superadmin();
  IF _payload IS NULL OR _payload->'organization' IS NULL THEN
    RAISE EXCEPTION 'invalid payload: missing organization';
  END IF;

  v_org_id := (_payload->'organization'->>'id')::uuid;
  SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id = v_org_id) INTO v_exists;

  IF v_exists AND NOT _overwrite THEN
    RAISE EXCEPTION 'organization % already exists (use _overwrite=true to replace)', v_org_id;
  END IF;

  -- Upsert organization (only known safe columns)
  INSERT INTO public.organizations (id, slug, name, business_type, is_active, settings, created_at, updated_at)
  SELECT (o->>'id')::uuid, o->>'slug', o->>'name',
         COALESCE(o->>'business_type','minimercado'),
         COALESCE((o->>'is_active')::boolean, true),
         COALESCE((o->'settings')::jsonb, '{}'::jsonb),
         COALESCE((o->>'created_at')::timestamptz, now()),
         now()
  FROM jsonb_array_elements(jsonb_build_array(_payload->'organization')) AS o
  ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    business_type = EXCLUDED.business_type,
    is_active = EXCLUDED.is_active,
    settings = EXCLUDED.settings,
    updated_at = now();

  -- Helper: generic insert from jsonb array into a public table.
  -- We use jsonb_populate_recordset to map columns; PK conflicts → skip.
  PERFORM 1;

  -- tenant_sites
  INSERT INTO public.tenant_sites SELECT * FROM jsonb_populate_recordset(NULL::public.tenant_sites, COALESCE(_payload->'tenant_sites','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('tenant_sites', v_n);

  INSERT INTO public.tenant_domains SELECT * FROM jsonb_populate_recordset(NULL::public.tenant_domains, COALESCE(_payload->'tenant_domains','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('tenant_domains', v_n);

  -- organization_members: skip rows whose user_id doesn't exist in this env
  INSERT INTO public.organization_members
  SELECT m.* FROM jsonb_populate_recordset(NULL::public.organization_members, COALESCE(_payload->'organization_members','[]'::jsonb)) m
  WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('organization_members', v_n);

  INSERT INTO public.organization_modules SELECT * FROM jsonb_populate_recordset(NULL::public.organization_modules, COALESCE(_payload->'organization_modules','[]'::jsonb))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('organization_modules', v_n);

  INSERT INTO public.licenses SELECT * FROM jsonb_populate_recordset(NULL::public.licenses, COALESCE(_payload->'licenses','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('licenses', v_n);

  INSERT INTO public.locations SELECT * FROM jsonb_populate_recordset(NULL::public.locations, COALESCE(_payload->'locations','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('locations', v_n);

  INSERT INTO public.categories SELECT * FROM jsonb_populate_recordset(NULL::public.categories, COALESCE(_payload->'categories','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('categories', v_n);

  INSERT INTO public.brands SELECT * FROM jsonb_populate_recordset(NULL::public.brands, COALESCE(_payload->'brands','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('brands', v_n);

  INSERT INTO public.products SELECT * FROM jsonb_populate_recordset(NULL::public.products, COALESCE(_payload->'products','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('products', v_n);

  INSERT INTO public.product_presentations SELECT * FROM jsonb_populate_recordset(NULL::public.product_presentations, COALESCE(_payload->'product_presentations','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('product_presentations', v_n);

  INSERT INTO public.modifier_groups SELECT * FROM jsonb_populate_recordset(NULL::public.modifier_groups, COALESCE(_payload->'modifier_groups','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('modifier_groups', v_n);

  INSERT INTO public.modifier_options SELECT * FROM jsonb_populate_recordset(NULL::public.modifier_options, COALESCE(_payload->'modifier_options','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('modifier_options', v_n);

  INSERT INTO public.hero_slides SELECT * FROM jsonb_populate_recordset(NULL::public.hero_slides, COALESCE(_payload->'hero_slides','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('hero_slides', v_n);

  INSERT INTO public.banners SELECT * FROM jsonb_populate_recordset(NULL::public.banners, COALESCE(_payload->'banners','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('banners', v_n);

  INSERT INTO public.landing_pages SELECT * FROM jsonb_populate_recordset(NULL::public.landing_pages, COALESCE(_payload->'landing_pages','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('landing_pages', v_n);

  INSERT INTO public.landing_sections SELECT * FROM jsonb_populate_recordset(NULL::public.landing_sections, COALESCE(_payload->'landing_sections','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('landing_sections', v_n);

  INSERT INTO public.featured_sections SELECT * FROM jsonb_populate_recordset(NULL::public.featured_sections, COALESCE(_payload->'featured_sections','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('featured_sections', v_n);

  INSERT INTO public.gallery SELECT * FROM jsonb_populate_recordset(NULL::public.gallery, COALESCE(_payload->'gallery','[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('gallery', v_n);

  PERFORM public._tenant_log(v_org_id, 'import_snapshot', jsonb_build_object('counts', v_counts, 'overwrite', _overwrite));
  RETURN jsonb_build_object('organization_id', v_org_id, 'counts', v_counts);
END $$;

-- 8) Archive (soft delete) ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_tenant(_org_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_snap jsonb;
BEGIN
  PERFORM public._require_superadmin();
  v_snap := public.export_tenant_snapshot(_org_id);
  UPDATE public.organizations
     SET is_active = false,
         deleted_at = now(),
         deleted_by = auth.uid(),
         archived_payload = v_snap,
         updated_at = now()
   WHERE id = _org_id;
  PERFORM public._tenant_log(_org_id, 'archive_tenant', jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('archived', true, 'organization_id', _org_id);
END $$;

-- 9) Restore -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_tenant(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_superadmin();
  UPDATE public.organizations
     SET is_active = true,
         deleted_at = NULL,
         deleted_by = NULL,
         updated_at = now()
   WHERE id = _org_id;
  PERFORM public._tenant_log(_org_id, 'restore_tenant', '{}'::jsonb);
  RETURN jsonb_build_object('restored', true, 'organization_id', _org_id);
END $$;

-- 10) Hard purge (requires archive first) ------------------------------------
CREATE OR REPLACE FUNCTION public.purge_tenant_hard(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org public.organizations%ROWTYPE;
BEGIN
  PERFORM public._require_superadmin();
  SELECT * INTO v_org FROM public.organizations WHERE id = _org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'organization not found: %', _org_id; END IF;
  IF v_org.deleted_at IS NULL OR v_org.archived_payload IS NULL THEN
    RAISE EXCEPTION 'tenant must be archived first (call archive_tenant)';
  END IF;

  PERFORM public._tenant_log(_org_id, 'purge_tenant_hard',
    jsonb_build_object('slug', v_org.slug, 'name', v_org.name, 'archived_at', v_org.deleted_at));

  PERFORM set_config('app.allow_org_delete','true', true);
  DELETE FROM public.organizations WHERE id = _org_id;
  PERFORM set_config('app.allow_org_delete','false', true);

  RETURN jsonb_build_object('purged', true, 'organization_id', _org_id);
END $$;

-- 11) Grants on functions ----------------------------------------------------
REVOKE ALL ON FUNCTION public.export_tenant_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_tenant_snapshot(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_tenant(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_tenant_hard(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.export_tenant_snapshot(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_tenant_snapshot(jsonb, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_tenant(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_tenant_hard(uuid) TO authenticated, service_role;