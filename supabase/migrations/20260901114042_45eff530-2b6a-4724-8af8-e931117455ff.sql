-- crm_leads: admin/editor solo su propia organización
DROP POLICY IF EXISTS "crm_leads_admin_read" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_admin_write" ON public.crm_leads;

CREATE POLICY "crm_leads_admin_read" ON public.crm_leads
FOR SELECT TO authenticated
USING (
  public.is_master_superadmin(auth.uid())
  OR (
    public.has_any_role(auth.uid(), ARRAY['superadmin','admin','editor']::public.app_role[])
    AND organization_id IS NOT NULL
    AND public.is_member_of(organization_id)
  )
);

CREATE POLICY "crm_leads_admin_write" ON public.crm_leads
FOR ALL TO authenticated
USING (
  public.is_master_superadmin(auth.uid())
  OR (
    public.has_any_role(auth.uid(), ARRAY['superadmin','admin']::public.app_role[])
    AND organization_id IS NOT NULL
    AND public.is_member_of(organization_id)
  )
)
WITH CHECK (
  public.is_master_superadmin(auth.uid())
  OR (
    public.has_any_role(auth.uid(), ARRAY['superadmin','admin']::public.app_role[])
    AND organization_id IS NOT NULL
    AND public.is_member_of(organization_id)
  )
);

-- orders: admin solo su propia organización
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

CREATE POLICY "Admins can manage orders in their org" ON public.orders
FOR ALL TO authenticated
USING (
  public.is_master_superadmin(auth.uid())
  OR (
    public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::public.app_role[])
    AND organization_id IS NOT NULL
    AND public.is_member_of(organization_id)
  )
)
WITH CHECK (
  public.is_master_superadmin(auth.uid())
  OR (
    public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::public.app_role[])
    AND organization_id IS NOT NULL
    AND public.is_member_of(organization_id)
  )
);

-- order_items: se hereda el alcance del pedido padre
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;

CREATE POLICY "Admins can manage order items in their org" ON public.order_items
FOR ALL TO authenticated
USING (
  public.is_master_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.organization_id IS NOT NULL
      AND public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::public.app_role[])
      AND public.is_member_of(o.organization_id)
  )
)
WITH CHECK (
  public.is_master_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.organization_id IS NOT NULL
      AND public.has_any_role(auth.uid(), ARRAY['admin','superadmin']::public.app_role[])
      AND public.is_member_of(o.organization_id)
  )
);