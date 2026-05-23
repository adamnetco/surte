
-- Sitios públicos por organización (frontend Astro)
CREATE TABLE public.tenant_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  logo_url text,
  primary_color text DEFAULT '#0C4B83',
  accent_color text DEFAULT '#F37021',
  default_locale text DEFAULT 'es-CO',
  is_published boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_sites_org ON public.tenant_sites(organization_id);
ALTER TABLE public.tenant_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_sites_org ON public.tenant_sites FOR ALL TO authenticated
  USING (is_member_of(organization_id) OR has_role(auth.uid(),'superadmin'))
  WITH CHECK (is_member_of(organization_id) OR has_role(auth.uid(),'superadmin'));
CREATE TRIGGER trg_tenant_sites_updated BEFORE UPDATE ON public.tenant_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dominios propios
CREATE TABLE public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.tenant_sites(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  hostname text NOT NULL UNIQUE,
  is_primary boolean NOT NULL DEFAULT false,
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  verified_at timestamptz,
  ssl_status text NOT NULL DEFAULT 'pending' CHECK (ssl_status IN ('pending','active','failed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenant_domains_site ON public.tenant_domains(site_id);
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_domains_org ON public.tenant_domains FOR ALL TO authenticated
  USING (is_member_of(organization_id) OR has_role(auth.uid(),'superadmin'))
  WITH CHECK (is_member_of(organization_id) OR has_role(auth.uid(),'superadmin'));
CREATE TRIGGER trg_tenant_domains_updated BEFORE UPDATE ON public.tenant_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Config WordPress headless por sitio
CREATE TABLE public.tenant_wp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.tenant_sites(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  wp_base_url text NOT NULL,
  wp_username text,
  wp_app_password text,
  default_post_type text DEFAULT 'posts',
  taxonomies jsonb DEFAULT '{}'::jsonb,
  webhook_secret text DEFAULT encode(gen_random_bytes(24),'hex'),
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_wp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_wp_org ON public.tenant_wp_config FOR ALL TO authenticated
  USING (is_member_of(organization_id) OR has_role(auth.uid(),'superadmin'))
  WITH CHECK (is_member_of(organization_id) OR has_role(auth.uid(),'superadmin'));
CREATE TRIGGER trg_tenant_wp_updated BEFORE UPDATE ON public.tenant_wp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolver tenant por hostname (público, sin secretos)
CREATE OR REPLACE FUNCTION public.resolve_tenant_by_host(_host text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'site_id', s.id,
    'organization_id', s.organization_id,
    'slug', s.slug,
    'name', s.name,
    'logo_url', s.logo_url,
    'primary_color', s.primary_color,
    'accent_color', s.accent_color,
    'default_locale', s.default_locale,
    'wp_base_url', w.wp_base_url,
    'default_post_type', w.default_post_type,
    'taxonomies', w.taxonomies,
    'hostname', d.hostname,
    'is_primary', d.is_primary
  )
  FROM public.tenant_domains d
  JOIN public.tenant_sites s ON s.id = d.site_id AND s.is_published = true
  LEFT JOIN public.tenant_wp_config w ON w.site_id = s.id
  WHERE lower(d.hostname) = lower(_host)
    AND d.verified_at IS NOT NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_tenant_by_host(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_host(text) TO anon, authenticated;
