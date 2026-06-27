
-- 1) Facturas electrónicas enviadas a DIAN (para el contador)
CREATE OR REPLACE FUNCTION public.report_einvoices_for_accountant(
  _org_id uuid,
  _from   date,
  _to     date,
  _doc_type text DEFAULT NULL
)
RETURNS TABLE (
  issue_date date,
  full_number text,
  document_type text,
  status text,
  customer_identification text,
  customer_name text,
  customer_email text,
  subtotal numeric,
  tax_total numeric,
  total numeric,
  cufe text,
  track_id text,
  environment text,
  is_contingency boolean,
  pdf_url text,
  xml_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
    ei.xml_url
  FROM public.electronic_invoices ei
  WHERE ei.organization_id = _org_id
    AND (ei.issue_date AT TIME ZONE 'America/Bogota')::date BETWEEN _from AND _to
    AND (_doc_type IS NULL OR ei.document_type = _doc_type)
    AND (
      public.is_member_of(_org_id)
      OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role])
    )
  ORDER BY ei.issue_date DESC, ei.full_number DESC
$$;

GRANT EXECUTE ON FUNCTION public.report_einvoices_for_accountant(uuid, date, date, text) TO authenticated;

-- 2) Resumen de IVA por tarifa (ventas generadas)
CREATE OR REPLACE FUNCTION public.report_vat_summary(
  _org_id uuid,
  _from   date,
  _to     date
)
RETURNS TABLE (
  tax_rate numeric,
  base_amount numeric,
  tax_amount numeric,
  total_amount numeric,
  ticket_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH src AS (
    SELECT
      i.tax_rate,
      SUM((i.quantity * i.unit_price) - COALESCE(i.discount,0))::numeric AS base_amount,
      SUM(i.tax_amount)::numeric AS tax_amount,
      SUM(i.total)::numeric AS total_amount,
      COUNT(DISTINCT o.id) AS ticket_count
    FROM public.pos_orders o
    JOIN public.pos_order_items i ON i.pos_order_id = o.id
    WHERE o.organization_id = _org_id
      AND o.status = 'paid'
      AND (o.paid_at AT TIME ZONE 'America/Bogota')::date BETWEEN _from AND _to
      AND (
        public.is_member_of(_org_id)
        OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role])
      )
    GROUP BY i.tax_rate
  )
  SELECT tax_rate, base_amount, tax_amount, total_amount, ticket_count
  FROM src
  ORDER BY tax_rate
$$;

GRANT EXECUTE ON FUNCTION public.report_vat_summary(uuid, date, date) TO authenticated;

-- 3) Libro auxiliar por cuenta contable
CREATE OR REPLACE FUNCTION public.report_account_ledger(
  _org_id uuid,
  _account_code text,
  _from   date,
  _to     date
)
RETURNS TABLE (
  entry_date date,
  entry_id uuid,
  narration text,
  reference_type text,
  reference_id uuid,
  debit numeric,
  credit numeric,
  running_balance numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH acc AS (
    SELECT id FROM public.accounting_accounts
    WHERE organization_id = _org_id AND code = _account_code
    LIMIT 1
  ),
  movs AS (
    SELECT
      e.entry_date,
      e.id AS entry_id,
      e.narration,
      e.reference_type,
      e.reference_id,
      COALESCE(l.debit_amount,0)::numeric AS debit,
      COALESCE(l.credit_amount,0)::numeric AS credit
    FROM public.journal_entries e
    JOIN public.journal_entry_lines l ON l.journal_entry_id = e.id
    WHERE e.organization_id = _org_id
      AND e.status = 'posted'
      AND l.account_id = (SELECT id FROM acc)
      AND e.entry_date BETWEEN _from AND _to
      AND (
        public.is_member_of(_org_id)
        OR public.has_any_role(auth.uid(), ARRAY['superadmin'::app_role,'admin'::app_role])
      )
    ORDER BY e.entry_date, e.id
  )
  SELECT
    entry_date, entry_id, narration, reference_type, reference_id,
    debit, credit,
    SUM(debit - credit) OVER (ORDER BY entry_date, entry_id
                              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
  FROM movs
$$;

GRANT EXECUTE ON FUNCTION public.report_account_ledger(uuid, text, date, date) TO authenticated;
