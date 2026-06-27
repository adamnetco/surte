
CREATE OR REPLACE FUNCTION public.recompute_usage_counter(
  p_org_id uuid,
  p_limit_key text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint := 0;
BEGIN
  IF p_limit_key = 'max_products' THEN
    SELECT count(*) INTO v_count FROM public.products
    WHERE organization_id = p_org_id AND COALESCE(is_active, true) = true;
  ELSIF p_limit_key = 'max_users' THEN
    SELECT count(*) INTO v_count FROM public.organization_members
    WHERE organization_id = p_org_id AND COALESCE(is_active, true) = true;
  ELSIF p_limit_key = 'max_locations' THEN
    SELECT count(*) INTO v_count FROM public.locations
    WHERE organization_id = p_org_id AND COALESCE(is_active, true) = true;
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.tenant_usage_counters (organization_id, limit_key, period_key, used, updated_at)
  VALUES (p_org_id, p_limit_key, 'lifetime', v_count, now())
  ON CONFLICT (organization_id, limit_key, period_key)
  DO UPDATE SET used = EXCLUDED.used, updated_at = now();

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.recompute_usage_counter(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recompute_all_usage_counters()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org RECORD; v_limit text; v_total integer := 0;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    FOREACH v_limit IN ARRAY ARRAY['max_products','max_users','max_locations'] LOOP
      PERFORM public.recompute_usage_counter(v_org.id, v_limit);
      v_total := v_total + 1;
    END LOOP;
  END LOOP;
  RETURN v_total;
END;
$$;
GRANT EXECUTE ON FUNCTION public.recompute_all_usage_counters() TO service_role;

CREATE OR REPLACE FUNCTION public.trg_recompute_usage_on_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid; v_key text;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    v_key := 'max_products';
  ELSIF TG_TABLE_NAME = 'organization_members' THEN
    v_key := 'max_users';
  ELSIF TG_TABLE_NAME = 'locations' THEN
    v_key := 'max_locations';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_org := COALESCE((NEW).organization_id, (OLD).organization_id);
  IF v_org IS NOT NULL THEN
    PERFORM public.recompute_usage_counter(v_org, v_key);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_usage_products ON public.products;
CREATE TRIGGER trg_usage_products
AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_usage_on_change();

DROP TRIGGER IF EXISTS trg_usage_members ON public.organization_members;
CREATE TRIGGER trg_usage_members
AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_usage_on_change();

DROP TRIGGER IF EXISTS trg_usage_locations ON public.locations;
CREATE TRIGGER trg_usage_locations
AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_usage_on_change();

SELECT public.recompute_all_usage_counters();
