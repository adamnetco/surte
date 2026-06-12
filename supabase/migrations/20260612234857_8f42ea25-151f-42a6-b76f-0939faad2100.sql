
-- ============================================================
-- Phase 4: Audited mutations + co-sign pipeline
-- ============================================================

-- Catálogo de acciones críticas (configurable: qué requiere co-firma)
CREATE TABLE IF NOT EXISTS public.critical_action_types (
  action_type      text PRIMARY KEY,
  label            text NOT NULL,
  description      text,
  requires_cosign  boolean NOT NULL DEFAULT true,
  expires_minutes  integer NOT NULL DEFAULT 60,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.critical_action_types TO authenticated;
GRANT ALL ON public.critical_action_types TO service_role;
ALTER TABLE public.critical_action_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed can read action types"
  ON public.critical_action_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadmin manages action types"
  ON public.critical_action_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role));

-- Cola de solicitudes
CREATE TABLE IF NOT EXISTS public.critical_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type       text NOT NULL REFERENCES public.critical_action_types(action_type),
  target_org_id     uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  justification     text NOT NULL,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','executed','expired','cancelled')),
  requested_by      uuid NOT NULL,
  requested_by_email text,
  cosigned_by       uuid,
  cosigned_by_email text,
  cosign_decision   text CHECK (cosign_decision IN ('approve','reject')),
  cosign_reason     text,
  cosigned_at       timestamptz,
  executed_at       timestamptz,
  execution_result  jsonb,
  cancelled_reason  text,
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_critical_actions_status ON public.critical_actions(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_critical_actions_target ON public.critical_actions(target_org_id);
CREATE INDEX IF NOT EXISTS idx_critical_actions_requester ON public.critical_actions(requested_by);

GRANT SELECT, INSERT, UPDATE ON public.critical_actions TO authenticated;
GRANT ALL ON public.critical_actions TO service_role;
ALTER TABLE public.critical_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin reads all"
  ON public.critical_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role));

CREATE POLICY "superadmin inserts via rpc only"
  ON public.critical_actions FOR INSERT TO authenticated
  WITH CHECK (false);  -- forzar uso del RPC SECURITY DEFINER

CREATE POLICY "superadmin updates via rpc only"
  ON public.critical_actions FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_critical_actions_updated_at
  BEFORE UPDATE ON public.critical_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Catálogo inicial
INSERT INTO public.critical_action_types(action_type, label, description, requires_cosign, expires_minutes) VALUES
  ('tenant_archive',          'Archivar tienda',                'Mueve la tienda a estado archivado. Bloquea toda escritura.', true,  60),
  ('tenant_suspend',          'Suspender tienda',               'Suspende temporalmente la tienda. Reversible.',             false, 30),
  ('bulk_module_override',    'Anulación masiva de módulos',    'Activa/desactiva módulos en múltiples tiendas a la vez.',   true,  60),
  ('entitlement_mass_change', 'Cambio masivo de límites',       'Modifica límites cuantitativos en múltiples tiendas.',      true,  60),
  ('tenant_hard_delete',      'Borrar tienda definitivamente',  'Elimina la tienda y todos sus datos. Irreversible.',        true,  120)
ON CONFLICT (action_type) DO NOTHING;

-- ============================================================
-- RPCs
-- ============================================================

-- 1) Solicitar acción crítica
CREATE OR REPLACE FUNCTION public.request_critical_action(
  _action_type   text,
  _target_org    uuid,
  _payload       jsonb,
  _justification text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type   public.critical_action_types%ROWTYPE;
  v_email  text;
  v_id     uuid;
  v_status text;
BEGIN
  PERFORM public._require_superadmin();
  IF coalesce(trim(_justification), '') = '' THEN
    RAISE EXCEPTION 'justification_required';
  END IF;
  SELECT * INTO v_type FROM public.critical_action_types
   WHERE action_type = _action_type AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_action_type: %', _action_type;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Si NO requiere co-firma, queda 'approved' (lista para ejecutar)
  v_status := CASE WHEN v_type.requires_cosign THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.critical_actions(
    action_type, target_org_id, payload, justification, status,
    requested_by, requested_by_email, expires_at
  ) VALUES (
    _action_type, _target_org, coalesce(_payload, '{}'::jsonb), _justification, v_status,
    auth.uid(), v_email, now() + (v_type.expires_minutes || ' minutes')::interval
  ) RETURNING id INTO v_id;

  IF _target_org IS NOT NULL THEN
    PERFORM public._tenant_log(_target_org, 'critical_action_requested',
      jsonb_build_object('action_id', v_id, 'action_type', _action_type, 'requires_cosign', v_type.requires_cosign));
  END IF;

  RETURN jsonb_build_object('action_id', v_id, 'status', v_status, 'requires_cosign', v_type.requires_cosign);
END $$;

GRANT EXECUTE ON FUNCTION public.request_critical_action(text, uuid, jsonb, text) TO authenticated;

-- 2) Co-firmar (aprobar/rechazar)
CREATE OR REPLACE FUNCTION public.cosign_critical_action(
  _action_id uuid,
  _decision  text,
  _reason    text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action public.critical_actions%ROWTYPE;
  v_email  text;
  v_new    text;
BEGIN
  PERFORM public._require_superadmin();
  IF _decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  SELECT * INTO v_action FROM public.critical_actions WHERE id = _action_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'action_not_found'; END IF;
  IF v_action.status <> 'pending' THEN
    RAISE EXCEPTION 'action_not_pending: %', v_action.status;
  END IF;
  IF v_action.expires_at < now() THEN
    UPDATE public.critical_actions SET status='expired' WHERE id=_action_id;
    RAISE EXCEPTION 'action_expired';
  END IF;
  IF v_action.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'cosigner_must_be_different';
  END IF;
  IF _decision = 'reject' AND coalesce(trim(_reason),'') = '' THEN
    RAISE EXCEPTION 'reject_reason_required';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_new := CASE WHEN _decision = 'approve' THEN 'approved' ELSE 'rejected' END;

  UPDATE public.critical_actions
     SET status = v_new,
         cosigned_by = auth.uid(),
         cosigned_by_email = v_email,
         cosign_decision = _decision,
         cosign_reason = _reason,
         cosigned_at = now()
   WHERE id = _action_id;

  IF v_action.target_org_id IS NOT NULL THEN
    PERFORM public._tenant_log(v_action.target_org_id, 'critical_action_' || v_new,
      jsonb_build_object('action_id', _action_id, 'action_type', v_action.action_type, 'reason', _reason));
  END IF;

  RETURN jsonb_build_object('action_id', _action_id, 'status', v_new);
END $$;

GRANT EXECUTE ON FUNCTION public.cosign_critical_action(uuid, text, text) TO authenticated;

-- 3) Marcar como ejecutada (después de hacer la mutación)
CREATE OR REPLACE FUNCTION public.mark_critical_action_executed(
  _action_id uuid,
  _result    jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_action public.critical_actions%ROWTYPE;
BEGIN
  PERFORM public._require_superadmin();
  SELECT * INTO v_action FROM public.critical_actions WHERE id = _action_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'action_not_found'; END IF;
  IF v_action.status <> 'approved' THEN
    RAISE EXCEPTION 'action_not_approved: %', v_action.status;
  END IF;
  IF v_action.requested_by <> auth.uid() THEN
    RAISE EXCEPTION 'only_requester_can_execute';
  END IF;
  UPDATE public.critical_actions
     SET status='executed', executed_at=now(), execution_result = coalesce(_result,'{}'::jsonb)
   WHERE id = _action_id;
  IF v_action.target_org_id IS NOT NULL THEN
    PERFORM public._tenant_log(v_action.target_org_id, 'critical_action_executed',
      jsonb_build_object('action_id', _action_id, 'action_type', v_action.action_type));
  END IF;
  RETURN jsonb_build_object('action_id', _action_id, 'status', 'executed');
END $$;
GRANT EXECUTE ON FUNCTION public.mark_critical_action_executed(uuid, jsonb) TO authenticated;

-- 4) Cancelar (solo el solicitante, mientras esté pendiente o aprobada)
CREATE OR REPLACE FUNCTION public.cancel_critical_action(
  _action_id uuid,
  _reason    text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_action public.critical_actions%ROWTYPE;
BEGIN
  PERFORM public._require_superadmin();
  SELECT * INTO v_action FROM public.critical_actions WHERE id = _action_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'action_not_found'; END IF;
  IF v_action.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'action_not_cancellable: %', v_action.status;
  END IF;
  IF v_action.requested_by <> auth.uid() THEN
    RAISE EXCEPTION 'only_requester_can_cancel';
  END IF;
  UPDATE public.critical_actions
     SET status='cancelled', cancelled_reason = _reason
   WHERE id = _action_id;
  RETURN jsonb_build_object('action_id', _action_id, 'status', 'cancelled');
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_critical_action(uuid, text) TO authenticated;
