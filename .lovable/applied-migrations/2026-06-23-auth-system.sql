-- =========================================================================
-- Migración pendiente: Sistema de acceso (Fase 1-5)
-- Ejecutar con supabase--migration cuando Lovable Cloud responda.
-- Requiere secret previo: AUTH_ENCRYPTION_KEY (32 bytes base64).
-- =========================================================================

-- 1. Settings singleton (config runtime para todo el sistema de auth)
CREATE TABLE IF NOT EXISTS public.auth_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  methods_enabled JSONB NOT NULL DEFAULT '["passkey","google","password_totp","magic_link","recovery"]'::jsonb,
  require_2fa_roles JSONB NOT NULL DEFAULT '["superadmin","admin"]'::jsonb,
  enforce_2fa_grace_days INT NOT NULL DEFAULT 14,
  superadmin_ip_allowlist JSONB NOT NULL DEFAULT '[]'::jsonb,
  superadmin_requires_passkey BOOLEAN NOT NULL DEFAULT true,
  break_glass_approvers JSONB NOT NULL DEFAULT '[]'::jsonb,
  break_glass_method TEXT NOT NULL DEFAULT 'email_and_totp',
  idle_timeout_minutes JSONB NOT NULL DEFAULT '{"superadmin":15,"admin":60,"editor":240,"user":480}'::jsonb,
  reauth_window_minutes INT NOT NULL DEFAULT 5,
  rate_limit_per_15min INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.auth_settings TO authenticated;
GRANT ALL ON public.auth_settings TO service_role;
ALTER TABLE public.auth_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any auth can read settings" ON public.auth_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadmin updates settings" ON public.auth_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin'));
INSERT INTO public.auth_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 2. Factores (TOTP, SMS, recovery metadata)
CREATE TABLE IF NOT EXISTS public.auth_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('totp','webauthn','recovery','sms')),
  secret_encrypted TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_factors TO authenticated;
GRANT ALL ON public.auth_factors TO service_role;
ALTER TABLE public.auth_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own factors" ON public.auth_factors FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_auth_factors_user ON public.auth_factors(user_id, type);

-- 3. WebAuthn credentials
CREATE TABLE IF NOT EXISTS public.auth_webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports JSONB NOT NULL DEFAULT '[]'::jsonb,
  device_label TEXT,
  aaguid TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_webauthn_credentials TO authenticated;
GRANT ALL ON public.auth_webauthn_credentials TO service_role;
ALTER TABLE public.auth_webauthn_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own passkeys" ON public.auth_webauthn_credentials FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Recovery codes
CREATE TABLE IF NOT EXISTS public.auth_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_recovery_codes TO authenticated;
GRANT ALL ON public.auth_recovery_codes TO service_role;
ALTER TABLE public.auth_recovery_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user sees own recovery rows" ON public.auth_recovery_codes FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 5. Login audit (append-only)
CREATE TABLE IF NOT EXISTS public.auth_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT,
  method TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip INET,
  user_agent TEXT,
  risk_score INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.auth_login_events TO authenticated;
GRANT ALL ON public.auth_login_events TO service_role;
ALTER TABLE public.auth_login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user sees own login events" ON public.auth_login_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "service inserts events" ON public.auth_login_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_login_events_user_time ON public.auth_login_events(user_id, created_at DESC);

-- 6. Superadmin allowlist
CREATE TABLE IF NOT EXISTS public.auth_superadmin_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  enforced_ip_cidr TEXT,
  requires_passkey BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.auth_superadmin_allowlist TO authenticated;
GRANT ALL ON public.auth_superadmin_allowlist TO service_role;
ALTER TABLE public.auth_superadmin_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin sees allowlist" ON public.auth_superadmin_allowlist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'superadmin'));
INSERT INTO public.auth_superadmin_allowlist (email) VALUES ('edurdotp77@gmail.com') ON CONFLICT DO NOTHING;

-- 7. Break-glass
CREATE TABLE IF NOT EXISTS public.auth_break_glass_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_email TEXT NOT NULL,
  approver1_email TEXT,
  approver1_at TIMESTAMPTZ,
  approver2_email TEXT,
  approver2_at TIMESTAMPTZ,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.auth_break_glass_requests TO authenticated;
GRANT ALL ON public.auth_break_glass_requests TO service_role;
ALTER TABLE public.auth_break_glass_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin sees break-glass" ON public.auth_break_glass_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superadmin')) WITH CHECK (public.has_role(auth.uid(),'superadmin'));

-- 8. Helper: current_role
CREATE OR REPLACE FUNCTION public.current_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role::text
    WHEN 'superadmin' THEN 1 WHEN 'admin' THEN 2 WHEN 'editor' THEN 3 ELSE 4 END
  LIMIT 1
$$;

-- 9. Trigger updated_at en auth_settings
CREATE OR REPLACE FUNCTION public._touch_auth_settings() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_touch_auth_settings ON public.auth_settings;
CREATE TRIGGER trg_touch_auth_settings BEFORE UPDATE ON public.auth_settings
  FOR EACH ROW EXECUTE FUNCTION public._touch_auth_settings();
