
-- Ola 14 — Documento Soporte DIAN: schema base
-- 1) Suppliers: marcar quien requiere DS
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS requires_support_doc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_natural_person boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS document_type_code text NOT NULL DEFAULT 'CC',
  ADD COLUMN IF NOT EXISTS regimen text NOT NULL DEFAULT 'no_responsable_iva';

COMMENT ON COLUMN public.suppliers.requires_support_doc IS 'Si true, las compras a este proveedor generan Documento Soporte DIAN (Res. 167/2021)';
COMMENT ON COLUMN public.suppliers.document_type_code IS 'CC / CE / PA / TI / NIT — código DIAN para el emisor del DS';
COMMENT ON COLUMN public.suppliers.regimen IS 'no_responsable_iva | responsable_iva | regimen_simple';

-- 2) Purchase orders: enlazar con DS emitido
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS ds_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ds_invoice_id uuid REFERENCES public.electronic_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ds_emitted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_ds_invoice ON public.purchase_orders(ds_invoice_id) WHERE ds_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_ds_required ON public.purchase_orders(organization_id, ds_required) WHERE ds_required = true AND ds_invoice_id IS NULL;

-- 3) Trigger: marcar ds_required al insertar PO con proveedor que requiere DS
CREATE OR REPLACE FUNCTION public.trg_set_po_ds_required()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req boolean;
BEGIN
  IF NEW.supplier_id IS NOT NULL THEN
    SELECT requires_support_doc INTO v_req FROM public.suppliers WHERE id = NEW.supplier_id;
    NEW.ds_required := COALESCE(v_req, false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_po_ds_required ON public.purchase_orders;
CREATE TRIGGER set_po_ds_required
BEFORE INSERT OR UPDATE OF supplier_id ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_set_po_ds_required();

-- 4) Backfill ds_required en POs existentes
UPDATE public.purchase_orders po
SET ds_required = s.requires_support_doc
FROM public.suppliers s
WHERE po.supplier_id = s.id AND s.requires_support_doc = true AND po.ds_required = false;
