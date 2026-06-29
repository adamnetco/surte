-- Ola 28 Slice 1: Reservations system (deposits, status workflow, availability checker)

CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  dining_table_id uuid REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  dining_area_id uuid REFERENCES public.dining_areas(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  party_size integer NOT NULL CHECK (party_size > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','seated','completed','cancelled','no_show')),
  source text NOT NULL DEFAULT 'walkin' CHECK (source IN ('walkin','phone','whatsapp','web','admin')),
  deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
  deposit_status text NOT NULL DEFAULT 'none' CHECK (deposit_status IN ('none','pending','paid','refunded','forfeited')),
  deposit_paid_at timestamptz,
  notes text,
  internal_notes text,
  table_order_id uuid REFERENCES public.table_orders(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  seated_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_org_members_select" ON public.reservations
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "reservations_org_members_write" ON public.reservations
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE INDEX idx_reservations_org_time ON public.reservations(organization_id, starts_at);
CREATE INDEX idx_reservations_table_time ON public.reservations(dining_table_id, starts_at) WHERE dining_table_id IS NOT NULL;
CREATE INDEX idx_reservations_status ON public.reservations(organization_id, status) WHERE status IN ('pending','confirmed','seated');

CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: chequeo de disponibilidad en una ventana de tiempo
CREATE OR REPLACE FUNCTION public.reservation_check_availability(
  _org_id uuid,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _party_size integer,
  _location_id uuid DEFAULT NULL,
  _exclude_reservation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dining_table_id uuid,
  label text,
  capacity integer,
  dining_area_id uuid,
  area_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.label, t.capacity, t.dining_area_id, a.name
  FROM public.dining_tables t
  LEFT JOIN public.dining_areas a ON a.id = t.dining_area_id
  WHERE t.organization_id = _org_id
    AND t.is_active = true
    AND t.capacity >= _party_size
    AND (_location_id IS NULL OR t.location_id = _location_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.dining_table_id = t.id
        AND r.status IN ('pending','confirmed','seated')
        AND (_exclude_reservation_id IS NULL OR r.id <> _exclude_reservation_id)
        AND tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)')
    )
  ORDER BY t.capacity ASC, t.label ASC;
$$;

GRANT EXECUTE ON FUNCTION public.reservation_check_availability(uuid, timestamptz, timestamptz, integer, uuid, uuid) TO authenticated;

-- RPC: agenda de un día (reservations + ocupación actual)
CREATE OR REPLACE FUNCTION public.reservation_day_agenda(
  _org_id uuid,
  _day date,
  _location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  dining_table_id uuid,
  table_label text,
  customer_name text,
  party_size integer,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  source text,
  deposit_status text,
  deposit_amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.dining_table_id, t.label, r.customer_name, r.party_size,
         r.starts_at, r.ends_at, r.status, r.source, r.deposit_status, r.deposit_amount
  FROM public.reservations r
  LEFT JOIN public.dining_tables t ON t.id = r.dining_table_id
  WHERE r.organization_id = _org_id
    AND (_location_id IS NULL OR r.location_id = _location_id)
    AND r.starts_at::date = _day
    AND r.status <> 'cancelled'
  ORDER BY r.starts_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.reservation_day_agenda(uuid, date, uuid) TO authenticated;