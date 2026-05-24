-- Ensure the master user email always has superadmin access.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'eduardotp77@gmail.com'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'superadmin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Central helper: identifies the immutable master account by authenticated user id.
CREATE OR REPLACE FUNCTION public.is_master_superadmin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) = 'eduardotp77@gmail.com'
  )
$$;

REVOKE ALL ON FUNCTION public.is_master_superadmin(uuid) FROM public;
REVOKE ALL ON FUNCTION public.is_master_superadmin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_master_superadmin(uuid) TO authenticated;

-- Make role detection authoritative for the master account.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_master_superadmin(auth.uid()) THEN 'superadmin'::public.app_role
    ELSE COALESCE(
      (
        SELECT role
        FROM public.user_roles
        WHERE user_id = auth.uid()
        ORDER BY CASE role
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'editor' THEN 3
          WHEN 'agente' THEN 4
          WHEN 'user' THEN 5
          ELSE 6
        END
        LIMIT 1
      ),
      'user'::public.app_role
    )
  END
$$;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM public;
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- Protect the master superadmin assignment from accidental downgrade/removal.
CREATE OR REPLACE FUNCTION public.prevent_master_superadmin_demotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_master boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT public.is_master_superadmin(OLD.user_id) INTO v_is_master;

    IF v_is_master AND OLD.role = 'superadmin'::public.app_role THEN
      RAISE EXCEPTION 'master_superadmin_role_is_immutable';
    END IF;

    RETURN OLD;
  END IF;

  SELECT public.is_master_superadmin(OLD.user_id) INTO v_is_master;

  IF v_is_master AND OLD.role = 'superadmin'::public.app_role
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'master_superadmin_role_is_immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_master_superadmin_role ON public.user_roles;
CREATE TRIGGER protect_master_superadmin_role
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_master_superadmin_demotion();