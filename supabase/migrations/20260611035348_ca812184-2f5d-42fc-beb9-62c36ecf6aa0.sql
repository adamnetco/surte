CREATE OR REPLACE FUNCTION public.admin_list_customer_reviews()
 RETURNS SETOF public.customer_reviews
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.has_any_role(
    auth.uid(),
    ARRAY['admin'::public.app_role, 'superadmin'::public.app_role, 'editor'::public.app_role]
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_org := public.current_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no_active_organization';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.customer_reviews
    WHERE organization_id = v_org
    ORDER BY created_at DESC;
END;
$function$;