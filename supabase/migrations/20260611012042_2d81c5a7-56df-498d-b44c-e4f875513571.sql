REVOKE EXECUTE ON FUNCTION public.admin_list_customer_reviews() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.app_current_role() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_print_job(uuid, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_list_customer_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, text) TO authenticated;