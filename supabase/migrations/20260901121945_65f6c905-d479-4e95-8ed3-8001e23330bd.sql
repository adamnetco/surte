-- 1. Reglas de conversión reutilizables (plantillas)
CREATE TABLE public.product_conversion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  from_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  from_presentation_id uuid REFERENCES public.product_presentations(id) ON DELETE SET NULL,
  to_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  to_presentation_id uuid REFERENCES public.product_presentations(id) ON DELETE SET NULL,
  factor numeric(12,4) NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_conversion_rules TO authenticated;
GRANT ALL ON public.product_conversion_rules TO service_role;

ALTER TABLE public.product_conversion_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversion_rules_select" ON public.product_conversion_rules
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(organization_id));

CREATE POLICY "conversion_rules_write" ON public.product_conversion_rules
  FOR ALL TO authenticated
  USING (public.can_write_org(organization_id))
  WITH CHECK (public.can_write_org(organization_id));

CREATE INDEX idx_conversion_rules_org_active
  ON public.product_conversion_rules (organization_id, is_active, name);

CREATE TRIGGER trg_conversion_rules_updated_at
  BEFORE UPDATE ON public.product_conversion_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Bitácora de conversiones ejecutadas
CREATE TABLE public.inventory_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.product_conversion_rules(id) ON DELETE SET NULL,
  from_product_id uuid NOT NULL REFERENCES public.products(id),
  from_presentation_id uuid REFERENCES public.product_presentations(id) ON DELETE SET NULL,
  to_product_id uuid NOT NULL REFERENCES public.products(id),
  to_presentation_id uuid REFERENCES public.product_presentations(id) ON DELETE SET NULL,
  qty_from numeric(12,3) NOT NULL,
  factor numeric(12,4) NOT NULL,
  qty_to numeric(12,3) NOT NULL,
  unit_cost_to numeric(14,4),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inventory_conversions TO authenticated;
GRANT ALL ON public.inventory_conversions TO service_role;

ALTER TABLE public.inventory_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_conversions_select" ON public.inventory_conversions
  FOR SELECT TO authenticated
  USING (public.is_active_org_member(organization_id));

CREATE INDEX idx_inventory_conversions_org_created
  ON public.inventory_conversions (organization_id, created_at DESC);

CREATE INDEX idx_inventory_conversions_org_wh
  ON public.inventory_conversions (organization_id, warehouse_id, created_at DESC);

-- 3. Operación atómica de conversión
CREATE OR REPLACE FUNCTION public.convert_inventory(
  p_org_id uuid,
  p_warehouse_id uuid,
  p_from_product uuid,
  p_from_presentation uuid,
  p_to_product uuid,
  p_to_presentation uuid,
  p_qty numeric,
  p_factor numeric,
  p_notes text DEFAULT NULL,
  p_rule_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty numeric(12,3) := round(COALESCE(p_qty, 0)::numeric, 3);
  v_factor numeric(12,4) := COALESCE(p_factor, 1);
  v_qty_to numeric(12,3);
  v_stock numeric(12,3);
  v_avg_cost numeric(14,4) := 0;
  v_unit_cost_to numeric(14,4);
  v_conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;
  IF NOT public.can_write_org(p_org_id) THEN
    RAISE EXCEPTION 'No tienes permiso para convertir inventario en esta tienda.';
  END IF;
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad a convertir debe ser mayor a 0.';
  END IF;
  IF v_factor <= 0 THEN
    RAISE EXCEPTION 'El factor de conversion debe ser mayor a 0.';
  END IF;
  IF p_from_product = p_to_product
     AND COALESCE(p_from_presentation, '00000000-0000-0000-0000-000000000000'::uuid)
       = COALESCE(p_to_presentation, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'El origen y el destino no pueden ser iguales.';
  END IF;

  PERFORM 1 FROM public.warehouses
    WHERE id = p_warehouse_id AND organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bodega invalida para esta tienda.';
  END IF;

  PERFORM 1 FROM public.products
    WHERE id = p_from_product AND organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Articulo de origen no encontrado en esta tienda.';
  END IF;

  PERFORM 1 FROM public.products
    WHERE id = p_to_product AND organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Articulo de destino no encontrado en esta tienda.';
  END IF;

  -- Existencia y costo del origen (bloquea la fila para evitar carreras)
  SELECT quantity, COALESCE(avg_cost, 0)
    INTO v_stock, v_avg_cost
    FROM public.product_stock
   WHERE organization_id = p_org_id
     AND warehouse_id = p_warehouse_id
     AND product_id = p_from_product
     AND presentation_id IS NOT DISTINCT FROM p_from_presentation
   FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_stock, 0) < v_qty THEN
    RAISE EXCEPTION 'Existencia insuficiente en el origen (disponible: %).', COALESCE(v_stock, 0);
  END IF;

  v_qty_to := round(v_qty * v_factor, 3);
  v_unit_cost_to := CASE WHEN v_qty_to > 0
                         THEN round((v_avg_cost * v_qty) / v_qty_to, 4)
                         ELSE 0 END;

  -- Salida del origen
  PERFORM public.apply_stock_movement(
    p_org_id, p_warehouse_id, p_from_product, p_from_presentation,
    'out', v_qty, v_avg_cost, 'conversion', NULL,
    COALESCE(p_notes, 'Conversion de inventario (salida)')
  );

  -- Entrada al destino
  PERFORM public.apply_stock_movement(
    p_org_id, p_warehouse_id, p_to_product, p_to_presentation,
    'in', v_qty_to, v_unit_cost_to, 'conversion', NULL,
    COALESCE(p_notes, 'Conversion de inventario (entrada)')
  );

  INSERT INTO public.inventory_conversions (
    organization_id, warehouse_id, rule_id,
    from_product_id, from_presentation_id,
    to_product_id, to_presentation_id,
    qty_from, factor, qty_to, unit_cost_to, notes, created_by
  ) VALUES (
    p_org_id, p_warehouse_id, p_rule_id,
    p_from_product, p_from_presentation,
    p_to_product, p_to_presentation,
    v_qty, v_factor, v_qty_to, v_unit_cost_to, p_notes, auth.uid()
  ) RETURNING id INTO v_conv_id;

  RETURN jsonb_build_object(
    'conversion_id', v_conv_id,
    'qty_from', v_qty,
    'qty_to', v_qty_to,
    'unit_cost_to', v_unit_cost_to
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_inventory(uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_inventory(uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_inventory(uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,text,uuid) TO service_role;