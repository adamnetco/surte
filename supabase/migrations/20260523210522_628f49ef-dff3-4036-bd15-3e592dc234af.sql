
-- AI Insights
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('pricing','stock','margin','demand','supplier','general')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  title text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  product_id uuid,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','applied','dismissed')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_insights_org ON public.ai_insights(organization_id, status, generated_at DESC);
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_insights_org_read ON public.ai_insights FOR SELECT TO authenticated
  USING (is_member_of(organization_id));
CREATE POLICY ai_insights_org_write ON public.ai_insights FOR ALL TO authenticated
  USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));

-- Invoice scans (OCR)
CREATE TABLE public.invoice_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  warehouse_id uuid,
  supplier_name text,
  supplier_nit text,
  invoice_number text,
  invoice_date date,
  currency text DEFAULT 'COP',
  subtotal numeric(14,2),
  tax numeric(14,2),
  total numeric(14,2),
  image_url text,
  raw_ocr jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','applied','rejected')),
  applied_at timestamptz,
  applied_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_scans_org ON public.invoice_scans(organization_id, status, created_at DESC);
ALTER TABLE public.invoice_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_scans_org ON public.invoice_scans FOR ALL TO authenticated
  USING (is_member_of(organization_id)) WITH CHECK (is_member_of(organization_id));

CREATE TABLE public.invoice_scan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.invoice_scans(id) ON DELETE CASCADE,
  line_no int,
  description text NOT NULL,
  gtin text,
  quantity numeric(14,3) NOT NULL DEFAULT 1,
  unit text,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2),
  matched_product_id uuid,
  matched_presentation_id uuid,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_scan_items_scan ON public.invoice_scan_items(scan_id);
ALTER TABLE public.invoice_scan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_scan_items_org ON public.invoice_scan_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoice_scans s WHERE s.id = invoice_scan_items.scan_id AND is_member_of(s.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoice_scans s WHERE s.id = invoice_scan_items.scan_id AND is_member_of(s.organization_id)));

CREATE TRIGGER trg_invoice_scans_updated BEFORE UPDATE ON public.invoice_scans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Apply an invoice scan to inventory (creates stock_in movements)
CREATE OR REPLACE FUNCTION public.apply_invoice_scan(_scan_id uuid, _warehouse_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_scan public.invoice_scans%ROWTYPE;
  v_item record;
  v_applied int := 0;
  v_skipped int := 0;
BEGIN
  SELECT * INTO v_scan FROM public.invoice_scans WHERE id = _scan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'scan_not_found'; END IF;
  IF NOT is_member_of(v_scan.organization_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_scan.status = 'applied' THEN RAISE EXCEPTION 'already_applied'; END IF;

  FOR v_item IN SELECT * FROM public.invoice_scan_items WHERE scan_id = _scan_id AND applied = false LOOP
    IF v_item.matched_product_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    PERFORM public.apply_stock_movement(
      v_scan.organization_id, _warehouse_id,
      v_item.matched_product_id, v_item.matched_presentation_id,
      'purchase', v_item.quantity, v_item.unit_cost,
      'invoice_scan', _scan_id,
      'OCR: ' || COALESCE(v_scan.invoice_number,'') || ' / ' || COALESCE(v_scan.supplier_name,'')
    );
    UPDATE public.invoice_scan_items SET applied = true WHERE id = v_item.id;
    v_applied := v_applied + 1;
  END LOOP;

  UPDATE public.invoice_scans
     SET status = 'applied', applied_at = now(), applied_by = auth.uid(), warehouse_id = _warehouse_id
   WHERE id = _scan_id;

  RETURN jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
END $$;

-- Storage bucket for invoices (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices','invoices', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "invoices_org_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);
CREATE POLICY "invoices_org_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);
CREATE POLICY "invoices_org_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);
