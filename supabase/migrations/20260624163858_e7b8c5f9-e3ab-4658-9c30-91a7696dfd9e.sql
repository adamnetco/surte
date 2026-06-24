CREATE TABLE IF NOT EXISTS public.whatsapp_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  whatsapp_ref text,
  status text NOT NULL CHECK (status IN ('queued','sent','delivered','read','failed','retry_requested')),
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_msg_events_order ON public.whatsapp_message_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_events_ref ON public.whatsapp_message_events(whatsapp_ref);
GRANT SELECT ON public.whatsapp_message_events TO anon, authenticated;
GRANT ALL ON public.whatsapp_message_events TO service_role;
ALTER TABLE public.whatsapp_message_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_events_public_select" ON public.whatsapp_message_events
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "wa_events_service_insert" ON public.whatsapp_message_events
  FOR INSERT TO service_role WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_message_events;