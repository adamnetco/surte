
-- ============ WAREHOUSES ============
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  location_id uuid NOT NULL,
  code text,
  name text NOT NULL,
  warehouse_type text NOT NULL DEFAULT 'main', -- main, fridge, display, vehicle, virtual
  is_sellable boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_warehouses_org ON public.warehouses(organization_id);
CREATE INDEX idx_warehouses_location ON public.warehouses(location_id);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read warehouses" ON public.warehouses FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "managers manage warehouses" ON public.warehouses FOR ALL
USING ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- ============ PRODUCT STOCK ============
CREATE TABLE public.product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  product_id uuid NOT NULL,
  presentation_id uuid,
  quantity numeric NOT NULL DEFAULT 0,
  reserved_quantity numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  max_stock numeric,
  reorder_point numeric,
  avg_cost numeric NOT NULL DEFAULT 0,
  last_movement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, product_id, presentation_id)
);
CREATE INDEX idx_stock_org ON public.product_stock(organization_id);
CREATE INDEX idx_stock_warehouse ON public.product_stock(warehouse_id);
CREATE INDEX idx_stock_product ON public.product_stock(product_id);
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read stock" ON public.product_stock FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "operators manage stock" ON public.product_stock FOR ALL
USING ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- ============ STOCK MOVEMENTS (kardex) ============
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  product_id uuid NOT NULL,
  presentation_id uuid,
  movement_type text NOT NULL, -- in, out, adjustment, sale_pos, sale_online, purchase, transfer_in, transfer_out, loss, return
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  balance_after numeric,
  reference_type text, -- pos_order, order, purchase_order, transfer, manual
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mov_org ON public.stock_movements(organization_id);
CREATE INDEX idx_mov_warehouse ON public.stock_movements(warehouse_id);
CREATE INDEX idx_mov_product ON public.stock_movements(product_id);
CREATE INDEX idx_mov_ref ON public.stock_movements(reference_type, reference_id);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read movements" ON public.stock_movements FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "operators insert movements" ON public.stock_movements FOR INSERT
WITH CHECK ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- ============ STOCK TRANSFERS ============
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  transfer_number serial,
  from_warehouse_id uuid NOT NULL,
  to_warehouse_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, in_transit, received, cancelled
  notes text,
  created_by uuid,
  sent_at timestamptz,
  received_at timestamptz,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transfers_org ON public.stock_transfers(organization_id);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read transfers" ON public.stock_transfers FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "operators manage transfers" ON public.stock_transfers FOR ALL
USING ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

CREATE TABLE public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  presentation_id uuid,
  quantity_sent numeric NOT NULL,
  quantity_received numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tritems_transfer ON public.stock_transfer_items(transfer_id);
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read transfer items" ON public.stock_transfer_items FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "operators manage transfer items" ON public.stock_transfer_items FOR ALL
USING ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  tax_id text,
  contact_name text,
  phone text,
  email text,
  address text,
  payment_terms_days integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_org ON public.suppliers(organization_id);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read suppliers" ON public.suppliers FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "managers manage suppliers" ON public.suppliers FOR ALL
USING ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- ============ PURCHASE ORDERS ============
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  po_number serial,
  supplier_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, sent, partial, received, cancelled
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  expected_at date,
  received_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_org ON public.purchase_orders(organization_id);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read pos" ON public.purchase_orders FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "managers manage pos" ON public.purchase_orders FOR ALL
USING ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  presentation_id uuid,
  quantity_ordered numeric NOT NULL,
  quantity_received numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_poitems_po ON public.purchase_order_items(purchase_order_id);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read po items" ON public.purchase_order_items FOR SELECT
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role]));
CREATE POLICY "managers manage po items" ON public.purchase_order_items FOR ALL
USING ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK ((org_role(organization_id) = ANY(ARRAY['owner','admin','manager'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

-- ============ TRIGGERS ============
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_stock_updated BEFORE UPDATE ON public.product_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_transfers_updated BEFORE UPDATE ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ APPLY STOCK MOVEMENT RPC ============
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  _org_id uuid,
  _warehouse_id uuid,
  _product_id uuid,
  _presentation_id uuid,
  _movement_type text,
  _quantity numeric,
  _unit_cost numeric DEFAULT 0,
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_delta numeric;
  v_new_qty numeric;
  v_current_qty numeric;
  v_current_cost numeric;
  v_new_cost numeric;
  v_mov_id uuid;
BEGIN
  -- Determine sign
  IF _movement_type IN ('in','purchase','transfer_in','return','adjustment') THEN
    v_delta := _quantity;
  ELSE
    v_delta := -_quantity;
  END IF;

  -- Upsert stock row
  INSERT INTO public.product_stock(organization_id, warehouse_id, product_id, presentation_id, quantity, avg_cost)
  VALUES (_org_id, _warehouse_id, _product_id, _presentation_id, 0, 0)
  ON CONFLICT (warehouse_id, product_id, presentation_id) DO NOTHING;

  SELECT quantity, avg_cost INTO v_current_qty, v_current_cost
  FROM public.product_stock
  WHERE warehouse_id = _warehouse_id AND product_id = _product_id
    AND presentation_id IS NOT DISTINCT FROM _presentation_id
  FOR UPDATE;

  v_new_qty := COALESCE(v_current_qty,0) + v_delta;

  -- Weighted average cost only on incoming with cost
  IF v_delta > 0 AND _unit_cost > 0 AND v_new_qty > 0 THEN
    v_new_cost := ((COALESCE(v_current_qty,0) * COALESCE(v_current_cost,0)) + (v_delta * _unit_cost)) / v_new_qty;
  ELSE
    v_new_cost := COALESCE(v_current_cost,0);
  END IF;

  UPDATE public.product_stock
  SET quantity = v_new_qty,
      avg_cost = v_new_cost,
      last_movement_at = now(),
      updated_at = now()
  WHERE warehouse_id = _warehouse_id AND product_id = _product_id
    AND presentation_id IS NOT DISTINCT FROM _presentation_id;

  INSERT INTO public.stock_movements(
    organization_id, warehouse_id, product_id, presentation_id,
    movement_type, quantity, unit_cost, balance_after,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    _org_id, _warehouse_id, _product_id, _presentation_id,
    _movement_type, _quantity, _unit_cost, v_new_qty,
    _reference_type, _reference_id, _notes, auth.uid()
  ) RETURNING id INTO v_mov_id;

  RETURN v_mov_id;
END;
$$;

-- ============ SEED default warehouse for existing org/location ============
INSERT INTO public.warehouses (organization_id, location_id, code, name, warehouse_type, is_default)
SELECT l.organization_id, l.id, 'BOD-PPAL', 'Bodega Principal', 'main', true
FROM public.locations l
WHERE l.is_main = true
ON CONFLICT DO NOTHING;

-- Seed pos_inventory module flag (idempotent)
INSERT INTO public.organization_modules (organization_id, module_key, enabled, config)
SELECT id, 'inventory_multi_warehouse', true, '{}'::jsonb FROM public.organizations
ON CONFLICT (organization_id, module_key) DO NOTHING;
