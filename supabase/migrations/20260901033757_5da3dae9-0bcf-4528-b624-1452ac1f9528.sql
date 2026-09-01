CREATE TABLE public.product_lots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  lot_code text NOT NULL,
  expires_at date,
  manufactured_at date,
  received_quantity numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  supplier_id uuid,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_lots_qty_nonneg CHECK (quantity >= 0),
  CONSTRAINT product_lots_unique_code UNIQUE (organization_id, product_id, warehouse_id, lot_code)
);

CREATE INDEX idx_product_lots_fefo ON public.product_lots (organization_id, product_id, warehouse_id, expires_at NULLS LAST) WHERE is_active AND quantity > 0;
CREATE INDEX idx_product_lots_expiry ON public.product_lots (organization_id, expires_at) WHERE is_active AND quantity > 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_lots TO authenticated;
GRANT ALL ON public.product_lots TO service_role;

ALTER TABLE public.product_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read lots" ON public.product_lots FOR SELECT TO authenticated
USING (is_member_of(organization_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role, 'admin'::app_role]));

CREATE POLICY "operators manage lots" ON public.product_lots FOR ALL TO authenticated
USING ((org_role(organization_id) = ANY (ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]))
WITH CHECK ((org_role(organization_id) = ANY (ARRAY['owner','admin','manager','agent'])) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role]));

CREATE TRIGGER trg_product_lots_updated_at
BEFORE UPDATE ON public.product_lots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Consumo FEFO: descuenta la cantidad pedida de los lotes que vencen primero.
CREATE OR REPLACE FUNCTION public.consume_lots_fefo(
  _org_id uuid,
  _product_id uuid,
  _warehouse_id uuid,
  _quantity numeric
)
RETURNS TABLE (lot_id uuid, lot_code text, expires_at date, taken numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining numeric := _quantity;
  _rec record;
  _take numeric;
BEGIN
  IF _quantity IS NULL OR _quantity <= 0 THEN
    RETURN;
  END IF;

  FOR _rec IN
    SELECT id, product_lots.lot_code, product_lots.expires_at, quantity
    FROM public.product_lots
    WHERE organization_id = _org_id
      AND product_id = _product_id
      AND warehouse_id = _warehouse_id
      AND is_active
      AND quantity > 0
    ORDER BY product_lots.expires_at NULLS LAST, created_at
    FOR UPDATE
  LOOP
    EXIT WHEN _remaining <= 0;
    _take := LEAST(_rec.quantity, _remaining);
    UPDATE public.product_lots SET quantity = quantity - _take WHERE id = _rec.id;
    _remaining := _remaining - _take;
    lot_id := _rec.id;
    lot_code := _rec.lot_code;
    expires_at := _rec.expires_at;
    taken := _take;
    RETURN NEXT;
  END LOOP;

  IF _remaining > 0 THEN
    RAISE EXCEPTION 'insufficient_lot_quantity: faltan % unidades con lote', _remaining;
  END IF;
END;
$$;

-- Resumen de vencimientos.
CREATE OR REPLACE FUNCTION public.lots_expiry_summary(_org_id uuid, _days integer DEFAULT 60)
RETURNS TABLE (
  lot_id uuid,
  product_id uuid,
  product_name text,
  sku text,
  warehouse_id uuid,
  warehouse_name text,
  lot_code text,
  expires_at date,
  quantity numeric,
  unit_cost numeric,
  days_left integer,
  severity text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.product_id,
    p.name,
    p.sku,
    l.warehouse_id,
    w.name,
    l.lot_code,
    l.expires_at,
    l.quantity,
    l.unit_cost,
    (l.expires_at - CURRENT_DATE)::int,
    CASE
      WHEN l.expires_at IS NULL THEN 'ok'
      WHEN l.expires_at < CURRENT_DATE THEN 'expired'
      WHEN l.expires_at <= CURRENT_DATE + 7 THEN 'critical'
      WHEN l.expires_at <= CURRENT_DATE + COALESCE(_days, 60) THEN 'soon'
      ELSE 'ok'
    END
  FROM public.product_lots l
  JOIN public.products p ON p.id = l.product_id
  JOIN public.warehouses w ON w.id = l.warehouse_id
  WHERE l.organization_id = _org_id
    AND l.is_active
    AND l.quantity > 0
    AND (is_member_of(_org_id) OR has_any_role(auth.uid(), ARRAY['superadmin'::app_role, 'admin'::app_role]))
    AND (l.expires_at IS NULL OR l.expires_at <= CURRENT_DATE + COALESCE(_days, 60))
  ORDER BY l.expires_at NULLS LAST, p.name;
$$;

GRANT EXECUTE ON FUNCTION public.consume_lots_fefo(uuid, uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lots_expiry_summary(uuid, integer) TO authenticated;