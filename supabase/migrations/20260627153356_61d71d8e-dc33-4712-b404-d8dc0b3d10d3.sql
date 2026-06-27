DROP FUNCTION IF EXISTS public.report_einvoices_for_accountant(uuid, date, date, text);

CREATE OR REPLACE FUNCTION public.report_einvoices_for_accountant(_org_id uuid, _from date, _to date, _doc_type text DEFAULT NULL::text)
 RETURNS TABLE(issue_date date, full_number text, document_type text, status text, customer_identification text, customer_name text, customer_email text, subtotal numeric, tax_total numeric, total numeric, cufe text, track_id text, environment text, is_contingency boolean, pdf_url text, xml_url text, reference_full_number text, reference_cufe text, note_concept_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (ei.issue_date AT TIME ZONE 'America/Bogota')::date,
    ei.full_number,
    ei.document_type,
    ei.status,
    ei.customer_identification,
    ei.customer_name,
    ei.customer_email,
    ei.subtotal,
    ei.tax_total,
    ei.total,
    ei.cufe,
    ei.track_id,
    ei.environment,
    ei.is_contingency,
    ei.pdf_url,
    ei.xml_url,
    ei.reference_full_number,
    ei.reference_cufe,
    ei.note_concept_code
  FROM public.electronic_invoices ei
  WHERE ei.organization_id = _org_id
    AND (ei.issue_date AT TIME ZONE 'America/Bogota')::date BETWEEN _from AND _to
    AND (_doc_type IS NULL OR ei.document_type = _doc_type)
    AND (
      public.is_member_of(_org_id)
      OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role])
    )
  ORDER BY ei.issue_date DESC, ei.full_number DESC
$function$;