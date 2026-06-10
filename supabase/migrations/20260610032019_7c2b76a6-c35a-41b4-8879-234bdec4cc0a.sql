
DO $$
DECLARE
  v_org_id uuid;
  v_site_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug='demo' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (slug, name, is_active)
    VALUES ('demo','Demo SistecPOS', true) RETURNING id INTO v_org_id;
  END IF;
  SELECT id INTO v_site_id FROM public.tenant_sites WHERE slug='demo' LIMIT 1;
  IF v_site_id IS NULL THEN
    INSERT INTO public.tenant_sites (organization_id, slug, name, is_published, primary_color, accent_color, default_locale)
    VALUES (v_org_id,'demo','Demo Storefront', true, '#0C4B83','#F37021','es')
    RETURNING id INTO v_site_id;
  END IF;
  INSERT INTO public.tenant_domains (organization_id, site_id, hostname, dns_mode, is_primary)
  VALUES (v_org_id, v_site_id, 'demo.sistecpos.com', 'saas', true)
  ON CONFLICT (hostname) DO NOTHING;
END $$;
