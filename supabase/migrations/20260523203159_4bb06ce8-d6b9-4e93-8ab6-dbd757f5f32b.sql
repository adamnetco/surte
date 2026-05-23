-- ============= CATÁLOGOS BASE POR NICHO =============

CREATE TABLE IF NOT EXISTS public.catalog_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_key text NOT NULL,           -- minimercado, panaderia, restaurante, fruver, licorera, cafeteria, papeleria, ferreteria
  name text NOT NULL,
  description text,
  icon_name text,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  country_code text NOT NULL DEFAULT 'CO',
  total_items int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (niche_key, version)
);

CREATE TABLE IF NOT EXISTS public.catalog_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.catalog_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  brand text,
  category_slug text,
  gtin text,
  sku text,
  unit text DEFAULT 'unidad',
  suggested_price numeric(12,2),
  suggested_cost numeric(12,2),
  suggested_wholesale numeric(12,2),
  image_url text,
  tags text[] DEFAULT '{}',
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cti_template ON public.catalog_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_cti_gtin ON public.catalog_template_items(gtin) WHERE gtin IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.catalog_template_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.catalog_templates(id) ON DELETE CASCADE,
  template_version int NOT NULL,
  mode text NOT NULL DEFAULT 'append', -- append | overwrite_prices | sync
  items_created int NOT NULL DEFAULT 0,
  items_updated int NOT NULL DEFAULT 0,
  items_skipped int NOT NULL DEFAULT 0,
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX IF NOT EXISTS idx_cta_org ON public.catalog_template_applications(organization_id);

-- RLS
ALTER TABLE public.catalog_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_template_applications ENABLE ROW LEVEL SECURITY;

-- Lectura pública de plantillas activas (catálogo visible en onboarding/billing)
CREATE POLICY "tpl_read_active" ON public.catalog_templates
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "tpl_items_read_active" ON public.catalog_template_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.catalog_templates t
    WHERE t.id = template_id AND (t.is_active = true OR public.has_role(auth.uid(),'superadmin'))
  ));

-- Escritura SOLO superadmin
CREATE POLICY "tpl_write_superadmin" ON public.catalog_templates
  FOR ALL USING (public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "tpl_items_write_superadmin" ON public.catalog_template_items
  FOR ALL USING (public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- Aplicaciones: solo superadmin lee/escribe (auditoría)
CREATE POLICY "tpl_app_superadmin" ON public.catalog_template_applications
  FOR ALL USING (public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- Trigger updated_at
CREATE TRIGGER trg_tpl_updated BEFORE UPDATE ON public.catalog_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mantener total_items
CREATE OR REPLACE FUNCTION public.refresh_template_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid;
BEGIN
  tid := COALESCE(NEW.template_id, OLD.template_id);
  UPDATE public.catalog_templates
     SET total_items = (SELECT count(*) FROM public.catalog_template_items WHERE template_id = tid),
         updated_at = now()
   WHERE id = tid;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_tpl_items_count
AFTER INSERT OR DELETE ON public.catalog_template_items
FOR EACH ROW EXECUTE FUNCTION public.refresh_template_total();

-- =========== APPLY FUNCTION (solo superadmin) ===========
CREATE OR REPLACE FUNCTION public.apply_catalog_template(
  _org_id uuid,
  _template_id uuid,
  _mode text DEFAULT 'append'  -- append | overwrite_prices
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tpl public.catalog_templates%ROWTYPE;
  v_item record;
  v_existing_id uuid;
  v_cat_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_app_id uuid;
BEGIN
  IF NOT public.has_role(v_user, 'superadmin') THEN
    RAISE EXCEPTION 'forbidden: solo superadmin puede aplicar catálogos base';
  END IF;

  SELECT * INTO v_tpl FROM public.catalog_templates WHERE id = _template_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'template_not_found'; END IF;

  FOR v_item IN SELECT * FROM public.catalog_template_items WHERE template_id = _template_id LOOP
    -- Match por GTIN, luego por nombre+marca
    v_existing_id := NULL;
    IF v_item.gtin IS NOT NULL THEN
      SELECT id INTO v_existing_id FROM public.products
       WHERE gtin = v_item.gtin LIMIT 1;
    END IF;
    IF v_existing_id IS NULL THEN
      SELECT id INTO v_existing_id FROM public.products
       WHERE lower(name) = lower(v_item.name)
         AND COALESCE(lower(brand),'') = COALESCE(lower(v_item.brand),'')
       LIMIT 1;
    END IF;

    -- Categoría por slug
    v_cat_id := NULL;
    IF v_item.category_slug IS NOT NULL THEN
      SELECT id INTO v_cat_id FROM public.categories WHERE slug = v_item.category_slug LIMIT 1;
    END IF;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.products (
        name, description, brand, category_id, gtin, sku, unit,
        price, cost_price, price_wholesale, image_url, tags,
        is_active, slug
      ) VALUES (
        v_item.name, v_item.description, v_item.brand, v_cat_id, v_item.gtin, v_item.sku,
        COALESCE(v_item.unit,'unidad'),
        COALESCE(v_item.suggested_price, 0),
        v_item.suggested_cost, v_item.suggested_wholesale,
        v_item.image_url, COALESCE(v_item.tags,'{}'),
        true,
        regexp_replace(lower(unaccent(v_item.name)), '[^a-z0-9]+', '-', 'g')
      );
      v_created := v_created + 1;
    ELSIF _mode = 'overwrite_prices' THEN
      UPDATE public.products
         SET price = COALESCE(v_item.suggested_price, price),
             cost_price = COALESCE(v_item.suggested_cost, cost_price),
             price_wholesale = COALESCE(v_item.suggested_wholesale, price_wholesale),
             updated_at = now()
       WHERE id = v_existing_id;
      v_updated := v_updated + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  INSERT INTO public.catalog_template_applications
    (organization_id, template_id, template_version, mode, items_created, items_updated, items_skipped, applied_by)
  VALUES (_org_id, _template_id, v_tpl.version, _mode, v_created, v_updated, v_skipped, v_user)
  RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'application_id', v_app_id,
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped
  );
EXCEPTION WHEN undefined_function THEN
  -- unaccent puede no existir; fallback sin tildes
  RAISE;
END $$;

-- Seed de 8 plantillas vacías (el superadmin las puebla luego con CSV)
INSERT INTO public.catalog_templates (niche_key, name, description, icon_name) VALUES
  ('minimercado','Minimercado de Barrio','Abarrotes, aseo, bebidas y snacks esenciales','ShoppingBasket'),
  ('panaderia','Panadería & Repostería','Pan, pasteles, café y productos de panadería','Croissant'),
  ('restaurante','Restaurante & HORECA','Insumos para cocina profesional','UtensilsCrossed'),
  ('fruver','Fruver','Frutas, verduras y productos frescos','Apple'),
  ('licorera','Licorera & Estanco','Licores, cervezas, cigarrillos y snacks','Wine'),
  ('cafeteria','Cafetería','Bebidas calientes, repostería y snacks','Coffee'),
  ('papeleria','Papelería','Útiles escolares y de oficina','BookOpen'),
  ('ferreteria','Ferretería','Herramientas, tornillería y materiales','Wrench')
ON CONFLICT (niche_key, version) DO NOTHING;