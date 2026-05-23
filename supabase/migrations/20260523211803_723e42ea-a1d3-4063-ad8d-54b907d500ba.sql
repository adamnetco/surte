
-- Suppliers extras
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS lead_time_days int DEFAULT 3,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Supplier-Product catalog
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  supplier_sku text NOT NULL,
  supplier_name_ref text,
  unit text,
  pack_size numeric(14,3) DEFAULT 1,
  unit_cost numeric(14,2) DEFAULT 0,
  currency text DEFAULT 'COP',
  min_order_qty numeric(14,3) DEFAULT 1,
  lead_time_days int,
  is_preferred boolean NOT NULL DEFAULT false,
  last_purchased_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, supplier_sku)
);
CREATE INDEX IF NOT EXISTS idx_supplier_products_prod ON public.supplier_products(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_sku ON public.supplier_products(organization_id, supplier_sku);
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_products_org ON public.supplier_products;
CREATE POLICY supplier_products_org ON public.supplier_products FOR ALL TO authenticated
  USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));
DROP TRIGGER IF EXISTS trg_supplier_products_updated ON public.supplier_products;
CREATE TRIGGER trg_supplier_products_updated BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Purchase orders extras
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS po_code text,
  ADD COLUMN IF NOT EXISTS order_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS invoice_scan_id uuid REFERENCES public.invoice_scans(id);

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS supplier_sku text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS applied boolean NOT NULL DEFAULT false;

-- Invoice scans link to supplier
ALTER TABLE public.invoice_scans ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);
ALTER TABLE public.invoice_scan_items ADD COLUMN IF NOT EXISTS supplier_sku text;

-- Re-match OCR scan by supplier_products → gtin → name
CREATE OR REPLACE FUNCTION public.rematch_invoice_scan(_scan_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_scan public.invoice_scans%ROWTYPE;
  v_item record;
  v_pid uuid;
  v_matched int := 0;
  v_unmatched int := 0;
BEGIN
  SELECT * INTO v_scan FROM public.invoice_scans WHERE id = _scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'scan_not_found'; END IF;
  IF NOT is_member_of(v_scan.organization_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR v_item IN SELECT * FROM public.invoice_scan_items WHERE scan_id = _scan_id LOOP
    v_pid := NULL;
    IF v_scan.supplier_id IS NOT NULL AND v_item.supplier_sku IS NOT NULL THEN
      SELECT product_id INTO v_pid FROM public.supplier_products
       WHERE supplier_id = v_scan.supplier_id AND supplier_sku = v_item.supplier_sku LIMIT 1;
    END IF;
    IF v_pid IS NULL AND v_item.gtin IS NOT NULL THEN
      SELECT id INTO v_pid FROM public.products WHERE gtin = v_item.gtin LIMIT 1;
    END IF;
    IF v_pid IS NULL THEN
      SELECT id INTO v_pid FROM public.products
       WHERE name ILIKE '%' || substr(v_item.description,1,24) || '%' LIMIT 1;
    END IF;
    UPDATE public.invoice_scan_items SET matched_product_id = v_pid WHERE id = v_item.id;
    IF v_pid IS NULL THEN v_unmatched := v_unmatched + 1; ELSE v_matched := v_matched + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('matched', v_matched, 'unmatched', v_unmatched);
END $$;

-- Receive PO → stock movements
CREATE OR REPLACE FUNCTION public.receive_purchase_order(_po_id uuid, _warehouse_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_it record;
  v_applied int := 0;
  v_skipped int := 0;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = _po_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'po_not_found'; END IF;
  IF NOT is_member_of(v_po.organization_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_po.status = 'received' THEN RAISE EXCEPTION 'already_received'; END IF;

  FOR v_it IN SELECT * FROM public.purchase_order_items WHERE purchase_order_id = _po_id AND applied = false LOOP
    IF v_it.product_id IS NULL THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    PERFORM public.apply_stock_movement(
      v_po.organization_id, _warehouse_id,
      v_it.product_id, v_it.presentation_id,
      'purchase', v_it.quantity_ordered, v_it.unit_cost,
      'purchase_order', _po_id,
      'PO ' || COALESCE(v_po.po_code, v_po.id::text)
    );
    UPDATE public.purchase_order_items
       SET applied = true, quantity_received = quantity_ordered
     WHERE id = v_it.id;
    IF v_it.supplier_sku IS NOT NULL THEN
      UPDATE public.supplier_products
         SET last_purchased_at = now(), unit_cost = v_it.unit_cost
       WHERE supplier_id = v_po.supplier_id AND supplier_sku = v_it.supplier_sku;
    END IF;
    v_applied := v_applied + 1;
  END LOOP;

  UPDATE public.purchase_orders
     SET status = 'received', received_at = now(), warehouse_id = _warehouse_id
   WHERE id = _po_id;

  RETURN jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
END $$;
