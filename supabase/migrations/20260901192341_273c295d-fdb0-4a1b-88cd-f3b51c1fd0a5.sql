-- 1) Anti-takeover: la auto-inscripción como owner queda limitada al creador de la organización
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);

DROP POLICY IF EXISTS "user can self-register as owner of empty org" ON public.organization_members;

CREATE POLICY "creator can self-register as owner of own empty org"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'owner'
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_members.organization_id
      AND o.created_by = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_members.organization_id
  )
);

-- 2) price_list_items: lectura restringida a miembros de la organización dueña de la lista
DROP POLICY IF EXISTS "price_list_items_select_org" ON public.price_list_items;

CREATE POLICY "price_list_items_select_org_members"
ON public.price_list_items
FOR SELECT
TO authenticated
USING (
  price_list_id IN (
    SELECT pl.id FROM public.price_lists pl
    WHERE has_role(auth.uid(), 'superadmin'::app_role)
       OR pl.organization_id IN (
            SELECT om.organization_id FROM public.organization_members om
            WHERE om.user_id = auth.uid()
          )
  )
);