-- 1) Fix mutable search_path
CREATE OR REPLACE FUNCTION public._tg_block_org_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_setting('app.allow_org_delete', true) <> 'true' THEN
    RAISE EXCEPTION 'direct DELETE on organizations forbidden — use purge_tenant_hard()';
  END IF;
  RETURN OLD;
END $function$;

-- 2) Prevent admin -> superadmin privilege escalation on user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Superadmins: full control
CREATE POLICY "Superadmins manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role));

-- Admins: manage only non-superadmin roles, and cannot grant superadmin
CREATE POLICY "Admins manage non-superadmin roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND role <> 'superadmin'::public.app_role
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND role <> 'superadmin'::public.app_role
);

-- 3) Restrict realtime.messages subscriptions to org members
DROP POLICY IF EXISTS "Scoped realtime subscriptions" ON realtime.messages;

CREATE POLICY "Org-scoped realtime subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Superadmins can subscribe to anything
  public.has_role(auth.uid(), 'superadmin'::public.app_role)
  OR (
    -- Topics must be of the form "<prefix>:<org_uuid>" and the user must be a member
    realtime.topic() ~ '^[a-z_]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_member_of(
      (split_part(realtime.topic(), ':', 2))::uuid
    )
  )
);