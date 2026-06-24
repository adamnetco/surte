CREATE OR REPLACE FUNCTION public.einvoice_apply_business_type_defaults(_org_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected INTEGER := 0;
BEGIN
  WITH upd AS (
    UPDATE public.einvoice_configs c
    SET default_doc_type_consumer_final = CASE
          WHEN o.business_type IN ('casa_de_cambio', 'bureau_de_change', 'fx') THEN 'documento_soporte'
          WHEN o.business_type IN ('b2b', 'mayorista', 'wholesale', 'distribuidor') THEN 'factura_electronica'
          ELSE 'pos_electronico'
        END,
        default_doc_type_with_nit = CASE
          WHEN o.business_type IN ('casa_de_cambio', 'bureau_de_change', 'fx') THEN 'documento_soporte'
          ELSE 'factura_electronica'
        END,
        default_doc_type_fx_operation = 'documento_soporte'
    FROM public.organizations o
    WHERE c.organization_id = o.id
      AND (_org_id IS NULL OR c.organization_id = _org_id)
      AND c.default_doc_type_consumer_final = 'pos_electronico'
      AND c.default_doc_type_with_nit       = 'factura_electronica'
      AND c.default_doc_type_fx_operation   = 'documento_soporte'
      AND o.business_type IS NOT NULL
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_affected FROM upd;

  IF v_affected > 0 THEN
    INSERT INTO public.sync_logs (organization_id, service_name, status, payload)
    VALUES (
      _org_id,
      'einvoice_doctype_backfill',
      'success',
      jsonb_build_object(
        'affected', v_affected,
        'scope_org_id', _org_id,
        'note', format('Backfill aplicó defaults DIAN a %s einvoice_configs', v_affected)
      )
    );
  END IF;

  RETURN v_affected;
END;
$$;

COMMENT ON FUNCTION public.einvoice_apply_business_type_defaults(UUID) IS
  'POS-einvoice-default-doctype-by-business: re-aplica defaults DIAN basados en organizations.business_type. Idempotente: solo toca filas con defaults estándar. Loguea en sync_logs.';

CREATE OR REPLACE FUNCTION public.trg_org_business_type_apply_doctypes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_type IS DISTINCT FROM OLD.business_type THEN
    PERFORM public.einvoice_apply_business_type_defaults(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_business_type_apply_doctypes ON public.organizations;
CREATE TRIGGER trg_org_business_type_apply_doctypes
  AFTER UPDATE OF business_type ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_org_business_type_apply_doctypes();

SELECT public.einvoice_apply_business_type_defaults(NULL);