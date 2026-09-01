REVOKE ALL ON FUNCTION public.get_order_tracking(integer, uuid) FROM anon, authenticated, service_role, PUBLIC;
DROP FUNCTION public.get_order_tracking(integer, uuid);