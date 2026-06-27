
-- Slice 4: Permisos por sucursal
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS location_ids uuid[] NULL;

COMMENT ON COLUMN public.organization_members.location_ids IS
  'Sucursales permitidas para este miembro. NULL o vacío = acceso a todas las sucursales de la organización. Owners/admins ignoran este filtro.';

CREATE INDEX IF NOT EXISTS idx_org_members_location_ids
  ON public.organization_members USING GIN (location_ids);

-- Helper: ¿el usuario tiene acceso a una sucursal específica?
CREATE OR REPLACE FUNCTION public.member_can_access_location(
  _user_id uuid,
  _org_id uuid,
  _location_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = _user_id
      AND m.organization_id = _org_id
      AND (
        m.role IN ('owner','admin')
        OR m.location_ids IS NULL
        OR cardinality(m.location_ids) = 0
        OR _location_id = ANY(m.location_ids)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.member_can_access_location(uuid, uuid, uuid) TO authenticated;

-- Lista de sucursales permitidas para el usuario actual en una org
CREATE OR REPLACE FUNCTION public.member_allowed_locations(_org_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT role, location_ids
    FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = _org_id
    LIMIT 1
  )
  SELECT l.id
  FROM public.locations l, me
  WHERE l.organization_id = _org_id
    AND l.is_active = true
    AND (
      me.role IN ('owner','admin')
      OR me.location_ids IS NULL
      OR cardinality(me.location_ids) = 0
      OR l.id = ANY(me.location_ids)
    );
$$;

GRANT EXECUTE ON FUNCTION public.member_allowed_locations(uuid) TO authenticated;
