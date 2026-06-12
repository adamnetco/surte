CREATE OR REPLACE FUNCTION public._require_superadmin()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role (edge functions con service key)
  IF current_setting('role', true) = 'service_role' THEN RETURN; END IF;

  -- Sesión directa de DB (Run SQL editor / admin): no viene de la Data API.
  -- PostgREST SIEMPRE setea request.jwt.claims y hace SET ROLE anon/authenticated,
  -- por lo que esta rama solo aplica a conexiones administrativas directas.
  IF current_setting('request.jwt.claims', true) IS NULL
     AND coalesce(current_setting('role', true), 'none') NOT IN ('anon', 'authenticated') THEN
    RETURN;
  END IF;

  -- Llamadas API: exigir superadmin maestro o rol superadmin
  IF public.is_master_superadmin(auth.uid()) THEN RETURN; END IF;
  IF public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN RETURN; END IF;

  RAISE EXCEPTION 'forbidden: superadmin required';
END $function$;