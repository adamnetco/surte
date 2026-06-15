CREATE OR REPLACE FUNCTION public.auto_create_base_presentation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  INSERT INTO public.product_presentations
    (product_id, organization_id, name, conversion_factor, price, sort_order, is_active)
  VALUES
    (NEW.id, NEW.organization_id, COALESCE(NEW.base_unit, 'unidad'), 1, NEW.price, 0, true);
  RETURN NEW;
END;
$func$;