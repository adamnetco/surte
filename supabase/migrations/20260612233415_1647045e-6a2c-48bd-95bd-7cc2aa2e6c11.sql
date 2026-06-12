-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.tenant_lifecycle_state AS ENUM ('pending','trial','active','past_due','suspended','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Column with safe default
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS lifecycle_state public.tenant_lifecycle_state NOT NULL DEFAULT 'active';

-- 3. Backfill from existing flags
UPDATE public.organizations
   SET lifecycle_state = CASE
     WHEN deleted_at IS NOT NULL THEN 'archived'::public.tenant_lifecycle_state
     WHEN is_active = false      THEN 'suspended'::public.tenant_lifecycle_state
     ELSE                              'active'::public.tenant_lifecycle_state
   END;

CREATE INDEX IF NOT EXISTS idx_orgs_lifecycle ON public.organizations(lifecycle_state);

-- 4. Helpers
CREATE OR REPLACE FUNCTION public.is_tenant_writable(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org_id
      AND o.lifecycle_state IN ('trial','active','past_due')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_readable(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org_id
      AND o.lifecycle_state IN ('trial','active','past_due','suspended')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_tenant_writable(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_readable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_writable(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_readable(uuid) TO authenticated, service_role;

-- 5. Sync trigger: keep is_active / deleted_at in sync with lifecycle_state
CREATE OR REPLACE FUNCTION public.sync_org_flags_from_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state THEN
    NEW.is_active := NEW.lifecycle_state IN ('trial','active','past_due','suspended');
    IF NEW.lifecycle_state = 'archived' AND NEW.deleted_at IS NULL THEN
      NEW.deleted_at := now();
      NEW.deleted_by := auth.uid();
    ELSIF NEW.lifecycle_state <> 'archived' AND OLD.lifecycle_state = 'archived' THEN
      NEW.deleted_at := NULL;
      NEW.deleted_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_org_lifecycle_flags ON public.organizations;
CREATE TRIGGER trg_sync_org_lifecycle_flags
  BEFORE UPDATE OF lifecycle_state ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_flags_from_lifecycle();

-- 6. Transition function (superadmin only, validated, audited)
CREATE OR REPLACE FUNCTION public.transition_tenant_lifecycle(
  _org_id uuid,
  _new_state public.tenant_lifecycle_state,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old public.tenant_lifecycle_state;
  v_allowed boolean := false;
BEGIN
  PERFORM public._require_superadmin();

  SELECT lifecycle_state INTO v_old FROM public.organizations WHERE id = _org_id FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'organization_not_found'; END IF;

  IF v_old = _new_state THEN
    RETURN jsonb_build_object('changed', false, 'state', _new_state);
  END IF;

  -- Allowed transitions
  v_allowed := CASE v_old
    WHEN 'pending'   THEN _new_state IN ('trial','active','archived')
    WHEN 'trial'     THEN _new_state IN ('active','past_due','suspended','archived')
    WHEN 'active'    THEN _new_state IN ('past_due','suspended','archived')
    WHEN 'past_due'  THEN _new_state IN ('active','suspended','archived')
    WHEN 'suspended' THEN _new_state IN ('active','archived')
    WHEN 'archived'  THEN _new_state IN ('active') -- restore path
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition: % -> %', v_old, _new_state;
  END IF;

  UPDATE public.organizations
     SET lifecycle_state = _new_state,
         updated_at = now()
   WHERE id = _org_id;

  PERFORM public._tenant_log(_org_id, 'lifecycle_transition',
    jsonb_build_object('from', v_old, 'to', _new_state, 'reason', _reason));

  RETURN jsonb_build_object('changed', true, 'from', v_old, 'to', _new_state);
END $$;

REVOKE EXECUTE ON FUNCTION public.transition_tenant_lifecycle(uuid, public.tenant_lifecycle_state, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_tenant_lifecycle(uuid, public.tenant_lifecycle_state, text) TO authenticated, service_role;