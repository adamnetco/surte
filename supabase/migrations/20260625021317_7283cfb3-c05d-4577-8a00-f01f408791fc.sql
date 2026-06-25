-- =========================================================================
-- Phase 4 — WhatsApp traces (richer columns + tightened RLS) + Data-API health
-- =========================================================================

-- 1) whatsapp_message_events: enrich
ALTER TABLE public.whatsapp_message_events
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS direction       text CHECK (direction IN ('outbound','inbound','system')),
  ADD COLUMN IF NOT EXISTS latency_ms      integer;

CREATE INDEX IF NOT EXISTS idx_wa_msg_events_org_created
  ON public.whatsapp_message_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_events_phone_created
  ON public.whatsapp_message_events (phone, created_at DESC)
  WHERE phone IS NOT NULL;

-- 2) Replace overly permissive public select policy with org-scoped
DROP POLICY IF EXISTS wa_events_public_select ON public.whatsapp_message_events;

CREATE POLICY wa_events_org_select
  ON public.whatsapp_message_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_master_superadmin(auth.uid())
    OR (organization_id IS NOT NULL AND public.can_write_org(organization_id))
    OR (
      organization_id IS NULL
      AND order_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = whatsapp_message_events.order_id
          AND public.can_write_org(o.organization_id)
      )
    )
  );

-- Anon read solo si el order_id pertenece a un pedido público (tracking /pedido/:n).
-- Mantiene la UX actual de Pedido.tsx (sin sesión) sin filtrar eventos cross-org.
CREATE POLICY wa_events_order_tracking_select
  ON public.whatsapp_message_events
  FOR SELECT
  TO anon, authenticated
  USING (
    order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = whatsapp_message_events.order_id
    )
  );

-- =========================================================================
-- 3) health_events: ampliar fuentes válidas
-- =========================================================================
ALTER TABLE public.health_events DROP CONSTRAINT IF EXISTS health_events_source_check;
ALTER TABLE public.health_events
  ADD CONSTRAINT health_events_source_check
  CHECK (source IN ('printer','core','wordpress','sites','session','data_api','rls_audit','whatsapp'));

-- Permitir INSERT desde service_role (edge functions) y desde RPC SECURITY DEFINER.
-- No exponemos INSERT a authenticated directamente.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid='public.health_events'::regclass AND polname='health_events_service_insert'
  ) THEN
    CREATE POLICY health_events_service_insert
      ON public.health_events FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

GRANT INSERT ON public.health_events TO service_role;
GRANT SELECT ON public.health_events TO authenticated;

-- =========================================================================
-- 4) record_health_event: helper SECURITY DEFINER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.record_health_event(
  p_source         text,
  p_status         text,
  p_message        text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_latency_ms     integer DEFAULT NULL,
  p_metadata       jsonb DEFAULT '{}'::jsonb,
  p_correlation_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.health_events (
    source, status, message, organization_id, latency_ms, metadata, correlation_id
  ) VALUES (
    p_source, p_status, p_message, p_organization_id, p_latency_ms,
    COALESCE(p_metadata, '{}'::jsonb), p_correlation_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_health_event(text,text,text,uuid,integer,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_health_event(text,text,text,uuid,integer,jsonb,text) TO authenticated, service_role;

-- =========================================================================
-- 5) check_public_catalog_health: prueba que /planes verá filas
-- =========================================================================
CREATE OR REPLACE FUNCTION public.check_public_catalog_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_started  timestamptz := clock_timestamp();
  v_count    integer;
  v_status   text;
  v_latency  integer;
  v_event_id uuid;
BEGIN
  -- Solo superadmin o service_role
  IF NOT (public.has_role(auth.uid(), 'superadmin'::app_role) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.saas_plans
  WHERE is_public = true;

  v_latency := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started)::int;
  v_status  := CASE WHEN v_count = 0 THEN 'critical' ELSE 'ok' END;

  -- Solo registrar si es problema o si fue invocado explícitamente para auditoría
  IF v_status = 'critical' THEN
    v_event_id := public.record_health_event(
      'data_api', v_status,
      'saas_plans devolvió 0 filas con is_public=true — /planes mostraría vacío.',
      NULL, v_latency,
      jsonb_build_object('table','saas_plans','filter','is_public=true','count',v_count),
      'saas_plans_zero_public'
    );
  END IF;

  RETURN jsonb_build_object(
    'table','saas_plans','public_count',v_count,
    'status',v_status,'latency_ms',v_latency,'event_id',v_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_public_catalog_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_public_catalog_health() TO authenticated, service_role;

COMMENT ON FUNCTION public.check_public_catalog_health() IS
  'Verifica que /planes vea filas en saas_plans (GRANT+RLS). Si vacío, inserta en health_events.';