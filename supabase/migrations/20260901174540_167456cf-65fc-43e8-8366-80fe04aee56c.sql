-- Editors: restringir a pedidos de su propia organización.
DROP POLICY IF EXISTS "Editors can view order items" ON public.order_items;
CREATE POLICY "Editors can view order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_any_role(auth.uid(), ARRAY['editor'::app_role])
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.organization_id IS NOT NULL
      AND is_member_of(o.organization_id)
  )
);

-- Dueño del pedido: excluir explícitamente auth.uid() nulo (pedidos de invitado).
DROP POLICY IF EXISTS "Order items viewable by order owner" ON public.order_items;
CREATE POLICY "Order items viewable by order owner"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
  )
);

-- Roles elevados: sólo dentro de su organización (el master superadmin conserva acceso global).
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    is_master_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.user_id = auth.uid()
          OR (
            has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'agente'::app_role])
            AND o.organization_id IS NOT NULL
            AND is_member_of(o.organization_id)
          )
        )
    )
  )
);