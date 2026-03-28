-- 1) Robust app settings persistence
WITH ranked AS (
  SELECT id, key, updated_at,
         row_number() OVER (PARTITION BY key ORDER BY updated_at DESC, id DESC) AS rn
  FROM public.app_settings
)
DELETE FROM public.app_settings a
USING ranked r
WHERE a.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_key_unique'
      AND conrelid = 'public.app_settings'::regclass
  ) THEN
    ALTER TABLE public.app_settings
      ADD CONSTRAINT app_settings_key_unique UNIQUE (key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_app_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Municipalities with dynamic minimum order
CREATE TABLE IF NOT EXISTS public.municipality_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  min_order_amount numeric NOT NULL DEFAULT 40000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'municipality_settings_city_unique'
      AND conrelid = 'public.municipality_settings'::regclass
  ) THEN
    ALTER TABLE public.municipality_settings
      ADD CONSTRAINT municipality_settings_city_unique UNIQUE (city);
  END IF;
END $$;

ALTER TABLE public.municipality_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Municipalities are viewable by everyone" ON public.municipality_settings;
CREATE POLICY "Municipalities are viewable by everyone"
ON public.municipality_settings
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Admins can manage municipalities" ON public.municipality_settings;
CREATE POLICY "Admins can manage municipalities"
ON public.municipality_settings
FOR ALL
TO public
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_municipality_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_municipality_settings_updated_at
    BEFORE UPDATE ON public.municipality_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.municipality_settings (city, min_order_amount, is_active)
VALUES
  ('Bucaramanga', COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'min_order_amount' LIMIT 1), 40000), true),
  ('Floridablanca', COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'min_order_amount' LIMIT 1), 40000), true),
  ('Girón', COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'min_order_amount' LIMIT 1), 40000), true),
  ('Piedecuesta', COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'min_order_amount' LIMIT 1), 40000), true)
ON CONFLICT (city) DO NOTHING;

-- 3) Shipping zones uniqueness for reliable persistence
CREATE UNIQUE INDEX IF NOT EXISTS shipping_zones_city_neighborhood_unique
ON public.shipping_zones (lower(city), lower(neighborhood));

-- 4) Ensure storage uploads work for admin/superadmin/editor on product-images bucket
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;

CREATE POLICY "Privileged roles can upload product images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'product-images'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role])
);

CREATE POLICY "Privileged roles can update product images"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'product-images'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role])
);

CREATE POLICY "Privileged roles can delete product images"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'product-images'
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'editor'::app_role])
);

-- 5) Make user role management deterministic (single role per user)
WITH prioritized AS (
  SELECT
    id,
    user_id,
    role,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE role
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'editor' THEN 3
          ELSE 4
        END,
        id
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING prioritized p
WHERE ur.id = p.id
  AND p.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_unique
ON public.user_roles (user_id);

-- 6) External integration fields on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS external_sync_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_external_sync_status
ON public.orders (external_sync_status, created_at DESC);

-- 7) Seed dynamic UI settings for trust cards and product fallback image
INSERT INTO public.app_settings (key, value)
VALUES
  ('trust_card_shipping_title', 'Envío Gratis'),
  ('trust_card_shipping_sub', '+{min_order}'),
  ('trust_card_payment_title', 'Pago Seguro'),
  ('trust_card_payment_sub', 'Contraentrega'),
  ('trust_card_quality_title', 'Calidad'),
  ('trust_card_quality_sub', 'Garantizada'),
  ('product_default_image_url', '')
ON CONFLICT (key) DO NOTHING;