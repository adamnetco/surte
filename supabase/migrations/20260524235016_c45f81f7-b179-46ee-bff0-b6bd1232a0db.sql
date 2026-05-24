
-- ============================================
-- FASE 3: Portal de Clientes — Esquema completo
-- ============================================

-- Extiende licenses con columnas usadas por el portal
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS start_date timestamptz;

-- ============================================
-- client_tickets
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  category text,
  module text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  description text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_to uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_tickets_user ON public.client_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_client_tickets_status ON public.client_tickets(status);
ALTER TABLE public.client_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets owner select" ON public.client_tickets;
CREATE POLICY "tickets owner select" ON public.client_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP POLICY IF EXISTS "tickets owner insert" ON public.client_tickets;
CREATE POLICY "tickets owner insert" ON public.client_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tickets owner update" ON public.client_tickets;
CREATE POLICY "tickets owner update" ON public.client_tickets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP POLICY IF EXISTS "tickets admin delete" ON public.client_tickets;
CREATE POLICY "tickets admin delete" ON public.client_tickets
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP TRIGGER IF EXISTS trg_client_tickets_updated ON public.client_tickets;
CREATE TRIGGER trg_client_tickets_updated BEFORE UPDATE ON public.client_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ticket_messages
-- ============================================
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.client_tickets(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_role text NOT NULL DEFAULT 'client',
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages select" ON public.ticket_messages;
CREATE POLICY "messages select" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.client_tickets t WHERE t.id = ticket_id
            AND (t.user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[])))
  );

DROP POLICY IF EXISTS "messages insert" ON public.ticket_messages;
CREATE POLICY "messages insert" ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.client_tickets t WHERE t.id = ticket_id
            AND (t.user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[])))
  );

-- ============================================
-- payments
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  license_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'COP',
  status text NOT NULL DEFAULT 'pending',
  invoice_url text,
  invoice_number text,
  period_start date,
  period_end date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments owner select" ON public.payments;
CREATE POLICY "payments owner select" ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP POLICY IF EXISTS "payments admin write" ON public.payments;
CREATE POLICY "payments admin write" ON public.payments
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP TRIGGER IF EXISTS trg_payments_updated ON public.payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- support_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS public.support_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_sub_user ON public.support_subscriptions(user_id);
ALTER TABLE public.support_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub owner select" ON public.support_subscriptions;
CREATE POLICY "sub owner select" ON public.support_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP POLICY IF EXISTS "sub admin write" ON public.support_subscriptions;
CREATE POLICY "sub admin write" ON public.support_subscriptions
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP TRIGGER IF EXISTS trg_support_sub_updated ON public.support_subscriptions;
CREATE TRIGGER trg_support_sub_updated BEFORE UPDATE ON public.support_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- contracts
-- ============================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  contract_type text NOT NULL DEFAULT 'otro',
  signed_at timestamptz,
  expires_at timestamptz,
  pdf_url text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contracts_user ON public.contracts(user_id);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts owner select" ON public.contracts;
CREATE POLICY "contracts owner select" ON public.contracts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP POLICY IF EXISTS "contracts admin write" ON public.contracts;
CREATE POLICY "contracts admin write" ON public.contracts
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP TRIGGER IF EXISTS trg_contracts_updated ON public.contracts;
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- client_downloads (catálogo público)
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  download_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'exe',
  category text NOT NULL DEFAULT 'pos',
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "downloads public read" ON public.client_downloads;
CREATE POLICY "downloads public read" ON public.client_downloads
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP POLICY IF EXISTS "downloads admin write" ON public.client_downloads;
CREATE POLICY "downloads admin write" ON public.client_downloads
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP TRIGGER IF EXISTS trg_downloads_updated ON public.client_downloads;
CREATE TRIGGER trg_downloads_updated BEFORE UPDATE ON public.client_downloads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- client_pos_sessions
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_pos_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device text,
  ip text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_user ON public.client_pos_sessions(user_id);
ALTER TABLE public.client_pos_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos sessions owner select" ON public.client_pos_sessions;
CREATE POLICY "pos sessions owner select" ON public.client_pos_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP POLICY IF EXISTS "pos sessions owner end" ON public.client_pos_sessions;
CREATE POLICY "pos sessions owner end" ON public.client_pos_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

-- ============================================
-- leads_trials
-- ============================================
CREATE TABLE IF NOT EXISTS public.leads_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text,
  business_name text,
  phone text,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_trials_email ON public.leads_trials(lower(email));
ALTER TABLE public.leads_trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads admin all" ON public.leads_trials;
CREATE POLICY "leads admin all" ON public.leads_trials
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[]));

DROP TRIGGER IF EXISTS trg_leads_trials_updated ON public.leads_trials;
CREATE TRIGGER trg_leads_trials_updated BEFORE UPDATE ON public.leads_trials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Storage bucket privado para attachments
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ticket attachments owner read" ON storage.objects;
CREATE POLICY "ticket attachments owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[])
    )
  );

DROP POLICY IF EXISTS "ticket attachments owner upload" ON storage.objects;
CREATE POLICY "ticket attachments owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "ticket attachments owner delete" ON storage.objects;
CREATE POLICY "ticket attachments owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-attachments' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_any_role(auth.uid(), ARRAY['admin','superadmin']::app_role[])
    )
  );

-- ============================================
-- Realtime
-- ============================================
ALTER TABLE public.client_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.client_tickets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
