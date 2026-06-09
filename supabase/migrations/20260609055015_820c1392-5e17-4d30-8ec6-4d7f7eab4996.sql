-- Security hardening from scanner results

-- 1) Product margin data must not be directly readable through public client roles.
REVOKE SELECT (cost_price, price_wholesale, price_distributor) ON public.products FROM anon;
REVOKE SELECT (cost_price, price_wholesale, price_distributor) ON public.products FROM authenticated;
GRANT SELECT (cost_price, price_wholesale, price_distributor) ON public.products TO service_role;

-- Keep public catalog reads explicit and safe, excluding business margin columns.
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.products FROM authenticated;
GRANT SELECT (
  id, name, description, price, original_price, image_url, category_id,
  stock, unit, is_fresh, is_wholesale, is_active, created_at, updated_at,
  slug, meta_title, meta_description, brand, sku, gtin, weight, availability,
  tags, unit_quantity, unit_measure, net_weight_grams, base_unit,
  available_from, available_until, available_days, available_time_start,
  available_time_end, organization_id, kitchen_station_id
) ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;

-- 2) Remove orders from realtime publication if present, because it contains customer PII.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
  END IF;
END $$;

-- 3) Restrict app_settings public reads to storefront-safe, non-secret keys only.
DROP POLICY IF EXISTS "Settings viewable by everyone" ON public.app_settings;
DROP POLICY IF EXISTS "Public can read safe app settings" ON public.app_settings;
CREATE POLICY "Public can read safe app settings"
ON public.app_settings
FOR SELECT
TO public
USING (
  key = ANY (ARRAY[
    'checkout_show_delivery_date',
    'checkout_show_geolocation',
    'checkout_show_payment_method',
    'checkout_show_time_slot',
    'delivery_zones',
    'estimated_delivery_days',
    'footer_address',
    'footer_email',
    'footer_nit',
    'footer_text',
    'google_place_id',
    'min_order_amount',
    'product_default_image_url',
    'seo_default_description',
    'seo_facebook_catalog_id',
    'seo_facebook_pixel_id',
    'seo_ga4_measurement_id',
    'seo_google_merchant_id',
    'seo_site_name',
    'show_price_tiers',
    'show_promo_banner',
    'show_section_banners',
    'show_section_brands',
    'show_section_featured',
    'show_section_gallery',
    'show_section_offers',
    'show_section_promo',
    'show_section_testimonials',
    'social_facebook',
    'social_instagram',
    'social_tiktok',
    'store_name',
    'trust_badge_1_label',
    'trust_badge_1_sub',
    'trust_badge_2_label',
    'trust_badge_2_sub',
    'trust_badge_3_label',
    'trust_badge_3_sub',
    'trust_card_payment_sub',
    'trust_card_payment_title',
    'trust_card_quality_sub',
    'trust_card_quality_title',
    'trust_card_shipping_sub',
    'trust_card_shipping_title',
    'whatsapp_number',
    'color_primary',
    'color_secondary',
    'color_accent',
    'color_tierra',
    'color_cream',
    'color_azul_marino',
    'color_verde_campina',
    'color_rojo_teja'
  ]::text[])
);