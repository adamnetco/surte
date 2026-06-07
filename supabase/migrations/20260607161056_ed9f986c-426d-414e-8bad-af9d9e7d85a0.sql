
-- ============ PRINTERS ============
CREATE TABLE public.printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  model text,
  connection text NOT NULL CHECK (connection IN ('usb','lan','bluetooth','agent','browser')),
  ip_address text,
  port integer DEFAULT 9100,
  vendor_id text,
  product_id text,
  paper_width_mm integer NOT NULL DEFAULT 80 CHECK (paper_width_mm IN (48,58,80)),
  characters_per_line integer NOT NULL DEFAULT 48,
  codepage text NOT NULL DEFAULT 'CP858',
  cuts_paper boolean NOT NULL DEFAULT true,
  opens_drawer boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'receipt' CHECK (role IN ('receipt','kitchen','bar','label','any')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'unknown',
  last_seen_at timestamptz,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX printers_org_idx ON public.printers(organization_id);
CREATE INDEX printers_org_role_idx ON public.printers(organization_id, role);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printers TO authenticated;
GRANT ALL ON public.printers TO service_role;

ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read printers" ON public.printers FOR SELECT
  USING (public.is_member_of(organization_id) OR public.has_any_role(auth.uid(), ARRAY['superadmin'::public.app_role,'admin'::public.app_role]));
CREATE POLICY "managers manage printers" ON public.printers
  USING (public.can_write_org(organization_id))
  WITH CHECK (public.can_write_org(organization_id));

CREATE TRIGGER trg_printers_touch BEFORE UPDATE ON public.printers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRINTER TERMINALS ============
CREATE TABLE public.printer_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  name text NOT NULL,
  acts_as_server boolean NOT NULL DEFAULT false,
  printer_ids uuid[] NOT NULL DEFAULT '{}',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, fingerprint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.printer_terminals TO authenticated;
GRANT ALL ON public.printer_terminals TO service_role;
ALTER TABLE public.printer_terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read terminals" ON public.printer_terminals FOR SELECT
  USING (public.is_member_of(organization_id) OR public.has_any_role(auth.uid(), ARRAY['superadmin'::public.app_role,'admin'::public.app_role]));
CREATE POLICY "members upsert terminals" ON public.printer_terminals
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE TRIGGER trg_terminals_touch BEFORE UPDATE ON public.printer_terminals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRINT JOBS ============
CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  printer_id uuid REFERENCES public.printers(id) ON DELETE SET NULL,
  terminal_id uuid REFERENCES public.printer_terminals(id) ON DELETE SET NULL,
  pos_order_id uuid REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('receipt','kitchen','preorder','drawer','test','copy')),
  copies integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  escpos_b64 text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','printing','done','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  client_uuid uuid UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX print_jobs_queue_idx ON public.print_jobs(organization_id, status, printer_id, created_at);
CREATE INDEX print_jobs_order_idx ON public.print_jobs(pos_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read print jobs" ON public.print_jobs FOR SELECT
  USING (public.is_member_of(organization_id) OR public.has_any_role(auth.uid(), ARRAY['superadmin'::public.app_role,'admin'::public.app_role]));
CREATE POLICY "operators manage print jobs" ON public.print_jobs
  USING (public.can_write_org(organization_id) OR public.is_member_of(organization_id))
  WITH CHECK (public.can_write_org(organization_id) OR public.is_member_of(organization_id));
CREATE TRIGGER trg_print_jobs_touch BEFORE UPDATE ON public.print_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
ALTER TABLE public.print_jobs REPLICA IDENTITY FULL;

-- ============ ROUTING RULES ============
CREATE TABLE public.printer_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  printer_id uuid NOT NULL REFERENCES public.printers(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  kitchen_station_id uuid REFERENCES public.kitchen_stations(id) ON DELETE CASCADE,
  prints_on text NOT NULL DEFAULT 'kitchen' CHECK (prints_on IN ('receipt','kitchen','both')),
  copies integer NOT NULL DEFAULT 1,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (category_id IS NOT NULL OR product_id IS NOT NULL OR kitchen_station_id IS NOT NULL)
);
CREATE INDEX routing_rules_org_idx ON public.printer_routing_rules(organization_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printer_routing_rules TO authenticated;
GRANT ALL ON public.printer_routing_rules TO service_role;
ALTER TABLE public.printer_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read routing" ON public.printer_routing_rules FOR SELECT
  USING (public.is_member_of(organization_id) OR public.has_any_role(auth.uid(), ARRAY['superadmin'::public.app_role,'admin'::public.app_role]));
CREATE POLICY "managers manage routing" ON public.printer_routing_rules
  USING (public.can_write_org(organization_id))
  WITH CHECK (public.can_write_org(organization_id));
CREATE TRIGGER trg_routing_touch BEFORE UPDATE ON public.printer_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Link kitchen_stations <-> printers, categories/products <-> stations ============
ALTER TABLE public.kitchen_stations ADD COLUMN IF NOT EXISTS printer_id uuid REFERENCES public.printers(id) ON DELETE SET NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS kitchen_station_id uuid REFERENCES public.kitchen_stations(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kitchen_station_id uuid REFERENCES public.kitchen_stations(id) ON DELETE SET NULL;

-- ============ enqueue_print_job RPC ============
CREATE OR REPLACE FUNCTION public.enqueue_print_job(
  _order_id uuid,
  _kind text DEFAULT 'receipt'
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.pos_orders%ROWTYPE;
  v_default_printer uuid;
  v_station record;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.pos_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT public.is_member_of(v_order.organization_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Recibo cliente
  IF _kind IN ('receipt','copy') THEN
    SELECT id INTO v_default_printer
      FROM public.printers
     WHERE organization_id = v_order.organization_id
       AND is_active = true
       AND (location_id IS NULL OR location_id = v_order.location_id)
       AND role IN ('receipt','any')
     ORDER BY is_default DESC, created_at ASC
     LIMIT 1;

    INSERT INTO public.print_jobs(organization_id, printer_id, pos_order_id, kind, copies, created_by)
    VALUES (v_order.organization_id, v_default_printer, _order_id, _kind, 1, auth.uid())
    RETURNING id INTO v_job_id;
    RETURN NEXT v_job_id;
  END IF;

  -- Comandas cocina: una por estación con items
  IF _kind IN ('kitchen','receipt') THEN
    FOR v_station IN
      SELECT DISTINCT ks.id AS station_id, ks.printer_id
        FROM public.pos_order_items poi
        JOIN public.products p ON p.id = poi.product_id
        JOIN public.kitchen_stations ks ON ks.id = COALESCE(p.kitchen_station_id,
          (SELECT c.kitchen_station_id FROM public.categories c WHERE c.id = p.category_id))
       WHERE poi.pos_order_id = _order_id
         AND ks.printer_id IS NOT NULL
    LOOP
      INSERT INTO public.print_jobs(organization_id, printer_id, pos_order_id, kind, copies, payload, created_by)
      VALUES (v_order.organization_id, v_station.printer_id, _order_id, 'kitchen', 1,
              jsonb_build_object('kitchen_station_id', v_station.station_id), auth.uid())
      RETURNING id INTO v_job_id;
      RETURN NEXT v_job_id;
    END LOOP;
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, text) TO authenticated;
