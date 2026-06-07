-- 1) Revocar SELECT a nivel de tabla para anon/authenticated y reotorgar
--    solo columnas NO sensibles. Service_role conserva acceso total para
--    edge functions / scripts admin.
REVOKE SELECT ON public.customer_reviews FROM anon, authenticated;

GRANT SELECT (
  id, order_id, organization_id, customer_name,
  rating, comment, is_approved, is_active, admin_response,
  created_at, updated_at
) ON public.customer_reviews TO anon, authenticated;

GRANT ALL ON public.customer_reviews TO service_role;

-- 2) RPC para que el panel admin (rol admin/superadmin/editor) lea las
--    reseñas con PII completa sin exponerla a usuarios normales.
CREATE OR REPLACE FUNCTION public.admin_list_customer_reviews()
RETURNS SETOF public.customer_reviews
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(
    auth.uid(),
    ARRAY['admin'::public.app_role, 'superadmin'::public.app_role, 'editor'::public.app_role]
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
    SELECT * FROM public.customer_reviews
    ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_customer_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_customer_reviews() TO authenticated;

-- 3) Confirmar que orders NO está publicada por Realtime. Si llegara a
--    estarlo en el futuro, este DROP es idempotente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.orders';
  END IF;
END $$;