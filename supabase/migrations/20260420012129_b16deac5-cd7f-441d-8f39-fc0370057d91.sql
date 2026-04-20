-- Tabla de historial / programación de difusiones WhatsApp
CREATE TABLE IF NOT EXISTS public.broadcast_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  segment text NOT NULL DEFAULT 'all',
  total integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed', -- pending | running | completed | failed
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_by uuid,
  errors jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcast_logs"
  ON public.broadcast_logs
  FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'superadmin'::app_role]));

CREATE INDEX IF NOT EXISTS idx_broadcast_logs_scheduled_at_status
  ON public.broadcast_logs (status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created_at
  ON public.broadcast_logs (created_at DESC);

CREATE TRIGGER trg_broadcast_logs_updated_at
  BEFORE UPDATE ON public.broadcast_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Configuración de checkout: visibilidad de geolocalización
INSERT INTO public.app_settings (key, value)
VALUES ('checkout_show_geolocation', 'true')
ON CONFLICT (key) DO NOTHING;

-- Habilita extensiones para cron de difusiones programadas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;