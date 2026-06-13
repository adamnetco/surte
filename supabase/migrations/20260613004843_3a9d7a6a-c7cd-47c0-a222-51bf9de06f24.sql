-- Fase 2: enforcement atómico de límites + trigger max_users

CREATE OR REPLACE FUNCTION public.resolve_limit(_org_id uuid, _limit_key text)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT effective_value::bigint
  FROM public.v_tenant_entitlements_limits
  WHERE organization_id = _org_id AND limit_key = _limit_key
  LIMIT 1;
$$;

-- consume_limit: incrementa el contador y rechaza si excede el límite efectivo
-- _delta puede ser negativo (devoluciones). period = 'lifetime' | 'YYYY-MM' | 'YYYY-MM-DD'
CREATE OR REPLACE FUNCTION public.consume_limit(
  _org_id uuid,
  _limit_key text,
  _delta bigint DEFAULT 1,
  _period text DEFAULT 'lifetime'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit bigint;
  v_new_used bigint;
BEGIN
  -- Autorización: miembro activo, superadmin, o service_role
  IF current_setting('role', true) <> 'service_role'
     AND NOT public.is_master_superadmin(auth.uid())
     AND NOT public.is_member_of(_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_limit := public.resolve_limit(_org_id, _limit_key);

  -- Upsert + lock atómico
  INSERT INTO public.tenant_usage_counters(organization_id, limit_key, period_key, used, updated_at)
  VALUES (_org_id, _limit_key, _period, GREATEST(0, _delta), now())
  ON CONFLICT (organization_id, limit_key, period_key) DO UPDATE
    SET used = GREATEST(0, public.tenant_usage_counters.used + _delta),
        updated_at = now()
  RETURNING used INTO v_new_used;

  -- Si hay límite y se excedió, revertir y abortar
  IF v_limit IS NOT NULL AND _delta > 0 AND v_new_used > v_limit THEN
    UPDATE public.tenant_usage_counters
       SET used = GREATEST(0, used - _delta), updated_at = now()
     WHERE organization_id = _org_id AND limit_key = _limit_key AND period_key = _period;
    RAISE EXCEPTION 'limit_exceeded:%:%:%', _limit_key, v_new_used, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'limit_key', _limit_key,
    'period_key', _period,
    'used', v_new_used,
    'limit', v_limit,
    'remaining', CASE WHEN v_limit IS NULL THEN NULL ELSE GREATEST(0, v_limit - v_new_used) END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.consume_limit(uuid, text, bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_limit(uuid, text) TO authenticated, service_role;

-- peek_limit (no muta): para mostrar barras de uso sin riesgo
CREATE OR REPLACE FUNCTION public.peek_limit(_org_id uuid, _limit_key text, _period text DEFAULT 'lifetime')
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'limit_key', _limit_key,
    'period_key', _period,
    'used', COALESCE((SELECT used FROM public.tenant_usage_counters
                       WHERE organization_id = _org_id AND limit_key = _limit_key
                         AND period_key = _period), 0),
    'limit', public.resolve_limit(_org_id, _limit_key),
    'remaining', CASE WHEN public.resolve_limit(_org_id, _limit_key) IS NULL THEN NULL
                      ELSE GREATEST(0, public.resolve_limit(_org_id, _limit_key)
                                       - COALESCE((SELECT used FROM public.tenant_usage_counters
                                                    WHERE organization_id = _org_id AND limit_key = _limit_key
                                                      AND period_key = _period), 0)) END
  );
$$;
GRANT EXECUTE ON FUNCTION public.peek_limit(uuid, text, text) TO authenticated, service_role;

-- Trigger: enforcing max_users on organization_members INSERT/REACTIVATE
CREATE OR REPLACE FUNCTION public.tg_enforce_max_users()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_activating boolean;
BEGIN
  -- Saltar para service_role (provisioning) y superadmin maestro
  IF current_setting('role', true) = 'service_role'
     OR public.is_master_superadmin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_activating := COALESCE(NEW.is_active, true);
  ELSE
    v_activating := (COALESCE(OLD.is_active, false) = false AND COALESCE(NEW.is_active, false) = true);
  END IF;

  IF v_activating THEN
    PERFORM public.consume_limit(NEW.organization_id, 'max_users', 1, 'lifetime');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_max_users_ins ON public.organization_members;
CREATE TRIGGER trg_enforce_max_users_ins
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_max_users();

DROP TRIGGER IF EXISTS trg_enforce_max_users_upd ON public.organization_members;
CREATE TRIGGER trg_enforce_max_users_upd
  BEFORE UPDATE OF is_active ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_max_users();

-- Decremento en DELETE / desactivación (no falla nunca)
CREATE OR REPLACE FUNCTION public.tg_decrement_max_users()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_deact boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id;
    v_deact := COALESCE(OLD.is_active, false);
  ELSE
    v_org := NEW.organization_id;
    v_deact := (COALESCE(OLD.is_active, false) = true AND COALESCE(NEW.is_active, false) = false);
  END IF;
  IF v_deact THEN
    UPDATE public.tenant_usage_counters
       SET used = GREATEST(0, used - 1), updated_at = now()
     WHERE organization_id = v_org AND limit_key = 'max_users' AND period_key = 'lifetime';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_decrement_max_users_del ON public.organization_members;
CREATE TRIGGER trg_decrement_max_users_del
  AFTER DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_decrement_max_users();

DROP TRIGGER IF EXISTS trg_decrement_max_users_upd ON public.organization_members;
CREATE TRIGGER trg_decrement_max_users_upd
  AFTER UPDATE OF is_active ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_decrement_max_users();

-- Backfill: poblar contador max_users con miembros activos actuales
INSERT INTO public.tenant_usage_counters(organization_id, limit_key, period_key, used, updated_at)
SELECT om.organization_id, 'max_users', 'lifetime', COUNT(*)::bigint, now()
FROM public.organization_members om
WHERE om.is_active = true
GROUP BY om.organization_id
ON CONFLICT (organization_id, limit_key, period_key) DO UPDATE
  SET used = EXCLUDED.used, updated_at = now();