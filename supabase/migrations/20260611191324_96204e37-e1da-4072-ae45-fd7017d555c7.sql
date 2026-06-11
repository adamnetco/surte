
-- 1) custom_scripts: drop the overly-permissive policy
DROP POLICY IF EXISTS "Scripts readable by everyone" ON public.custom_scripts;

-- 2) order_items: remove the 15-min guest-window loophole on INSERT
DROP POLICY IF EXISTS "Order items insertable by owner or fresh guest order" ON public.order_items;
CREATE POLICY "Order items insertable by owner"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        o.user_id = auth.uid()
        OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role, 'agente'::app_role])
      )
  )
);
