-- Helper SECURITY DEFINER para validar rol per-organización
-- Centraliza la lógica de organization_members que hoy se repite ad-hoc en 4 policies
CREATE OR REPLACE FUNCTION public.has_org_role(
  _user_id uuid,
  _org_id uuid,
  _roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_master_superadmin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = _user_id
        AND om.organization_id = _org_id
        AND om.is_active = true
        AND (
          _roles = '{}'::text[]
          OR om.role = ANY(_roles)
        )
    )
$$;

COMMENT ON FUNCTION public.has_org_role(uuid, uuid, text[]) IS
  'Devuelve true si el usuario es miembro activo de la organización con uno de los roles dados (o si es superadmin maestro). Usar en RLS multi-tenant en lugar de subqueries inline a organization_members.';

GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, text[]) TO authenticated, service_role;