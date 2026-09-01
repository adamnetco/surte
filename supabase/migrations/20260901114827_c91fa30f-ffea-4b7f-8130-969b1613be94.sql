-- FASE 2: profiles cross-org admin bypass
DROP POLICY IF EXISTS "Admins and superadmins can manage all profiles" ON public.profiles;

CREATE POLICY "Org admins manage profiles of their organization"
ON public.profiles FOR ALL TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.is_member_of(organization_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role])
)
WITH CHECK (
  organization_id IS NOT NULL
  AND public.is_member_of(organization_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role])
);

CREATE POLICY "Master superadmins manage all profiles"
ON public.profiles FOR ALL TO authenticated
USING (public.is_master_superadmin(auth.uid()))
WITH CHECK (public.is_master_superadmin(auth.uid()));

-- FASE 3: índices compuestos tenant-first
CREATE INDEX IF NOT EXISTS idx_products_org_active_category
  ON public.products (organization_id, is_active, category_id);
CREATE INDEX IF NOT EXISTS idx_products_org_sku
  ON public.products (organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_categories_org_active_sort
  ON public.categories (organization_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_pos_orders_org_status_created
  ON public.pos_orders (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_orders_org_location_created
  ON public.pos_orders (organization_id, location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_org_order
  ON public.pos_order_items (organization_id, pos_order_id);
CREATE INDEX IF NOT EXISTS idx_pos_payments_org_order
  ON public.pos_payments (organization_id, pos_order_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_org_location_status
  ON public.cash_sessions (organization_id, location_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_product_created
  ON public.stock_movements (organization_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_stock_org_wh_product
  ON public.product_stock (organization_id, warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_einvoices_org_status_created
  ON public.electronic_invoices (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_persistent_carts_org_token
  ON public.persistent_carts (organization_id, cart_token);
CREATE INDEX IF NOT EXISTS idx_license_activations_license_revoked
  ON public.license_activations (license_id, revoked_at);