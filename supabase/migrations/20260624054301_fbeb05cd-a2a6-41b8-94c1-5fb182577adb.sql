-- POS-einvoice-default-doctype-by-business — Observación #3
-- Trigger que blinda casas de cambio: cualquier escritura de defaults DIAN debe usar 'documento_soporte'.
CREATE OR REPLACE FUNCTION public.einvoice_configs_enforce_fx_doctypes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_type TEXT;
BEGIN
  SELECT o.business_type INTO v_business_type
  FROM public.organizations o
  WHERE o.id = NEW.organization_id;

  IF v_business_type = 'casa_de_cambio' THEN
    IF NEW.default_doc_type_consumer_final IS DISTINCT FROM 'documento_soporte'
       OR NEW.default_doc_type_with_nit   IS DISTINCT FROM 'documento_soporte'
       OR NEW.default_doc_type_fx_operation IS DISTINCT FROM 'documento_soporte' THEN
      RAISE EXCEPTION 'Casas de cambio solo admiten documento_soporte como tipo de documento DIAN (consumer_final/with_nit/fx_operation).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_einvoice_configs_enforce_fx_doctypes ON public.einvoice_configs;
CREATE TRIGGER trg_einvoice_configs_enforce_fx_doctypes
  BEFORE INSERT OR UPDATE OF default_doc_type_consumer_final, default_doc_type_with_nit, default_doc_type_fx_operation, organization_id
  ON public.einvoice_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.einvoice_configs_enforce_fx_doctypes();

COMMENT ON FUNCTION public.einvoice_configs_enforce_fx_doctypes() IS
  'POS-einvoice-default-doctype-by-business: bloquea cambios de defaults DIAN incompatibles con organizations.business_type = casa_de_cambio.';