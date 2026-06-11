
-- 0) Asegurar que ambos correos del master superadmin estén en la allowlist
INSERT INTO public.auth_superadmin_allowlist (email)
VALUES ('eduardotp77@gmail.com'), ('edurdotp77@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 1) Refactor is_master_superadmin: leer de allowlist (sin hardcode)
CREATE OR REPLACE FUNCTION public.is_master_superadmin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.auth_superadmin_allowlist a
      ON lower(u.email) = lower(a.email)
    WHERE u.id = _user_id
  )
$function$;

-- 2) persistent_carts: INSERT explícito sólo para el dueño
DROP POLICY IF EXISTS "Users insert own carts" ON public.persistent_carts;
CREATE POLICY "Users insert own carts"
ON public.persistent_carts
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 3) auth_login_events: forzar user_id = auth.uid() (los nulos sólo via service_role)
DROP POLICY IF EXISTS "user inserts own login events" ON public.auth_login_events;
CREATE POLICY "user inserts own login events"
ON public.auth_login_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
