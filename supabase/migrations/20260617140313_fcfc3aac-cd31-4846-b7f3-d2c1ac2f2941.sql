
-- Trigger function: log every change on tenant_module_overrides into tenant_audit_log
CREATE OR REPLACE FUNCTION public._audit_tenant_module_overrides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_action text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_org := NEW.organization_id;
    v_action := 'module_override.created';
    v_payload := jsonb_build_object(
      'module_key', NEW.module_key,
      'enabled_before', NULL,
      'enabled_after', NEW.enabled,
      'reason', NEW.reason
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_org := NEW.organization_id;
    v_action := 'module_override.updated';
    v_payload := jsonb_build_object(
      'module_key', NEW.module_key,
      'enabled_before', OLD.enabled,
      'enabled_after', NEW.enabled,
      'reason', NEW.reason
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id;
    v_action := 'module_override.deleted';
    v_payload := jsonb_build_object(
      'module_key', OLD.module_key,
      'enabled_before', OLD.enabled,
      'enabled_after', NULL,
      'reason', OLD.reason
    );
  END IF;

  PERFORM public._tenant_log(v_org, v_action, v_payload);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_tenant_module_overrides ON public.tenant_module_overrides;
CREATE TRIGGER trg_audit_tenant_module_overrides
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_module_overrides
FOR EACH ROW EXECUTE FUNCTION public._audit_tenant_module_overrides();
