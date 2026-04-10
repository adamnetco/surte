
-- Seed base presentations for all products that have none
INSERT INTO public.product_presentations (product_id, name, conversion_factor, price, sort_order, is_active)
SELECT p.id, COALESCE(p.base_unit, 'unidad'), 1, p.price, 0, true
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_presentations pp WHERE pp.product_id = p.id
);

-- Auto-create base presentation on new product insert
CREATE OR REPLACE FUNCTION public.auto_create_base_presentation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.product_presentations (product_id, name, conversion_factor, price, sort_order, is_active)
  VALUES (NEW.id, COALESCE(NEW.base_unit, 'unidad'), 1, NEW.price, 0, true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_base_presentation ON public.products;
CREATE TRIGGER trg_auto_base_presentation
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_base_presentation();
