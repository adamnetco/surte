
-- =====================================================================
-- FASE 1: Auditoría RLS / SECURITY DEFINER — Lockdown granular
-- =====================================================================

-- 1) REVOKE blanket: ninguna función SECURITY DEFINER debe ser pública por defecto
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 2) GRANT granular por audiencia

-- 2a) ANÓNIMO + AUTENTICADO (storefront público, carrito guest, licencias desktop)
GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_host(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_landing_by_slug(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_persistent_cart(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_persistent_cart(uuid, jsonb, numeric, integer, text, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_persistent_cart(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_activation(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_activation(uuid, text) TO anon, authenticated;

-- 2b) AUTENTICADO (helpers de roles/orgs y operaciones SaaS)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master_superadmin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_section(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_orgs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.apply_stock_movement(uuid, uuid, uuid, uuid, text, numeric, numeric, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_invoice_scan(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rematch_invoice_scan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_template(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session_with_counts(uuid, jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.redeem_coupon(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_resource_availability(uuid, uuid, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_usage(uuid, text, text, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sync_event(uuid, uuid, text, text, text, jsonb, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sync_event(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_sync_logs(text[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_terminals(uuid) TO authenticated;

-- 2c) Sólo superadmin / service_role (gestión licencias y SSO)
GRANT EXECUTE ON FUNCTION public.create_license(uuid, text, integer, text, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_activation(uuid, text) TO authenticated;
-- ↑ ambas verifican internamente has_role(superadmin); el GRANT a authenticated es
--   sólo para que el cliente pueda invocarlas; la función rechaza no-superadmin.
GRANT EXECUTE ON FUNCTION public.cleanup_sso_tokens() TO service_role;

-- 2d) Triggers / internas / cola pgmq: SIN GRANT a anon ni authenticated
--     (las usa Postgres internamente o el service_role en edge functions)
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- handle_new_user, associate_guest_orders, auto_create_base_presentation,
-- validate_product_media_type, update_updated_at_column, generate_customer_code,
-- fill_default_cost_price, enqueue_whatsapp_on_confirmed,
-- prevent_master_superadmin_demotion, touch_admin_section_access,
-- refresh_template_total → triggers; NO se otorga EXECUTE.

-- 3) Política denegada por defecto para sso_handoff_tokens (sólo service_role).
CREATE POLICY "sso_handoff_tokens_no_client_access"
  ON public.sso_handoff_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
