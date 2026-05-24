
INSERT INTO tenant_sites (organization_id, slug, name, primary_color, accent_color, is_published)
SELECT id, 'surteya', 'SURTÉ YA', '#0C4B83', '#F37021', true
FROM organizations WHERE slug = 'surteya'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_domains (site_id, organization_id, hostname, is_primary, ssl_status, verified_at)
SELECT ts.id, ts.organization_id, d.hostname, d.is_primary, 'active', now()
FROM tenant_sites ts
CROSS JOIN (VALUES
  ('surteya.com', true),
  ('www.surteya.com', false),
  ('surteya.lovable.app', false)
) AS d(hostname, is_primary)
WHERE ts.slug = 'surteya'
ON CONFLICT (hostname) DO NOTHING;

INSERT INTO landing_pages (organization_id, site_scope, slug, title, meta_title, meta_description, canonical_url, hero, page_type)
SELECT
  o.id, 'surteya', 'surteya-home',
  'SURTÉ YA — Soluciones Alimenticias',
  'SURTÉ YA | Salsas, Cárnicos y Pulpas al Por Mayor en Bucaramanga',
  'Distribuidor mayorista de salsas, cárnicos, pulpas y agua para HORECA y minimercados en Bucaramanga, Floridablanca, Girón y Piedecuesta. Domicilios el mismo día.',
  'https://surteya.com/',
  jsonb_build_object(
    'title', 'Tu aliado en soluciones alimenticias',
    'subtitle', 'Salsas, cárnicos, pulpas y agua al por mayor. Entregas el mismo día en el área metropolitana de Bucaramanga.',
    'cta_label', 'Ver catálogo',
    'cta_url', '/catalogo'
  ),
  'home'
FROM organizations o WHERE o.slug = 'surteya'
ON CONFLICT (slug) DO NOTHING;
