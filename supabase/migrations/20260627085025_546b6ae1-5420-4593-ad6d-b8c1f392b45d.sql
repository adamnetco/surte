
CREATE OR REPLACE FUNCTION public.customer_360(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_summary jsonb;
  v_top_products jsonb;
  v_profile jsonb;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles WHERE id = p_profile_id;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  -- Verificar acceso del usuario
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_org AND user_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'superadmin') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT to_jsonb(p) INTO v_profile
  FROM (
    SELECT id, full_name, phone, business_name, city, business_type,
           customer_code, price_list_id, created_at
    FROM public.profiles WHERE id = p_profile_id
  ) p;

  SELECT jsonb_build_object(
    'orders_count', COALESCE(COUNT(*), 0),
    'lifetime_value', COALESCE(SUM(total), 0),
    'avg_ticket', COALESCE(AVG(total), 0),
    'first_purchase', MIN(created_at),
    'last_purchase', MAX(created_at),
    'days_since_last', CASE WHEN MAX(created_at) IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM (now() - MAX(created_at)))::int END
  ) INTO v_summary
  FROM public.pos_orders
  WHERE customer_profile_id = p_profile_id
    AND organization_id = v_org
    AND status IN ('completed','paid','closed');

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'qty')::numeric DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT jsonb_build_object(
      'product_id', poi.product_id,
      'product_name', poi.product_name,
      'qty', SUM(poi.quantity),
      'total', SUM(poi.total)
    ) AS t
    FROM public.pos_order_items poi
    JOIN public.pos_orders po ON po.id = poi.pos_order_id
    WHERE po.customer_profile_id = p_profile_id
      AND po.organization_id = v_org
      AND po.status IN ('completed','paid','closed')
    GROUP BY poi.product_id, poi.product_name
    ORDER BY SUM(poi.quantity) DESC
    LIMIT 5
  ) sub;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'summary', v_summary,
    'top_products', v_top_products
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_360(uuid) TO authenticated;
