
-- Guardian trigger function: blocks writes when tenant lifecycle is suspended/archived
CREATE OR REPLACE FUNCTION public.enforce_tenant_writable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_state text;
BEGIN
  -- Bypass: explicit session escape hatch (used by superadmin RPCs / migrations)
  IF current_setting('app.bypass_tenant_writable', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Bypass: service_role (edge functions, admin scripts)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Bypass: master superadmin or superadmin role
  IF auth.uid() IS NOT NULL
     AND (public.is_master_superadmin(auth.uid())
          OR public.has_role(auth.uid(), 'superadmin'::public.app_role)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Resolve organization_id from NEW (insert/update) or OLD (delete)
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id;
  ELSE
    v_org := NEW.organization_id;
  END IF;

  IF v_org IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT lifecycle_state::text INTO v_state
  FROM public.organizations
  WHERE id = v_org;

  IF v_state IN ('suspended','archived') THEN
    RAISE EXCEPTION 'tenant_not_writable: la tienda está en estado % y no admite cambios. Contacta a soporte para reactivar.', v_state
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger helper
CREATE OR REPLACE FUNCTION public._attach_tenant_writable_guard(_table regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_trigger_name text := 'trg_enforce_tenant_writable';
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', v_trigger_name, _table::text);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_writable()',
    v_trigger_name, _table::text
  );
END;
$$;

-- Apply to business-operational tables (excludes billing/audit/system tables)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'products','categories','brands','product_media','product_presentations','product_stock',
    'orders','order_items','pos_orders','pos_order_items','pos_payments','pos_quotes','parked_tickets',
    'cash_sessions','cash_movements','cash_registers','cash_session_counts',
    'stock_movements','stock_transfers','stock_transfer_items','purchase_orders','purchase_order_items',
    'invoice_scans','suppliers','supplier_products','warehouses',
    'table_orders','table_order_items','dining_tables','dining_areas','kds_tickets',
    'kitchen_stations','modifier_groups','modifier_options',
    'printers','printer_terminals','printer_routing_rules','print_jobs',
    'coupons','banners','hero_slides','featured_sections','gallery','testimonials',
    'landing_pages','landing_sections','landing_page_products',
    'customer_reviews','google_reviews','seo_content','custom_scripts',
    'appointments','service_catalog','service_types','service_resources',
    'electronic_invoices','einvoice_configs','einvoice_events',
    'crm_leads','catalog_template_applications','locations',
    'shipping_zones','municipality_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      PERFORM public._attach_tenant_writable_guard(format('public.%I', t)::regclass);
    END IF;
  END LOOP;
END $$;

-- Audit log entry (informational)
COMMENT ON FUNCTION public.enforce_tenant_writable() IS
  'Phase 3 enforcement: blocks INSERT/UPDATE/DELETE on tenant business tables when organizations.lifecycle_state IN (suspended, archived). Bypass: service_role, superadmin, or SET LOCAL app.bypass_tenant_writable=true.';
