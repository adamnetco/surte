
-- ============================================================
-- Ola 21 Slice 1 — Referral program schema
-- ============================================================

-- 1) Generador de códigos únicos
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  LOOP
    -- 8 chars alfanuméricos sin caracteres ambiguos (0/O/1/I)
    v_code := 'REF-' || upper(substring(
      translate(encode(gen_random_bytes(8), 'base64'), '+/=OI01', 'XYZABCDE')
      from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempts > 8;
    v_attempts := v_attempts + 1;
  END LOOP;
  RETURN v_code;
END;
$$;

-- 2) referral_codes
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  campaign_name text,
  is_active boolean NOT NULL DEFAULT true,
  uses_count int NOT NULL DEFAULT 0,
  max_uses int,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_codes_org ON public.referral_codes(organization_id);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_codes TO authenticated;
GRANT SELECT ON public.referral_codes TO anon; -- validar código en signup público
GRANT ALL ON public.referral_codes TO service_role;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage their codes"
ON public.referral_codes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = referral_codes.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  ) OR public.has_role(auth.uid(), 'superadmin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = referral_codes.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  ) OR public.has_role(auth.uid(), 'superadmin')
);

CREATE POLICY "Anyone can validate active referral codes"
ON public.referral_codes
FOR SELECT
TO anon, authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- 3) referral_conversions
CREATE TABLE public.referral_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE RESTRICT,
  referrer_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referee_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  referee_email text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','qualified','rewarded','expired','rejected')),
  reward_amount numeric(12,2) NOT NULL DEFAULT 0,
  reward_currency text NOT NULL DEFAULT 'COP',
  qualified_at timestamptz,
  rewarded_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_conv_referrer ON public.referral_conversions(referrer_org_id);
CREATE INDEX idx_referral_conv_referee ON public.referral_conversions(referee_org_id);
CREATE INDEX idx_referral_conv_status ON public.referral_conversions(status);

GRANT SELECT, INSERT, UPDATE ON public.referral_conversions TO authenticated;
GRANT ALL ON public.referral_conversions TO service_role;

ALTER TABLE public.referral_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see conversions of their org (as referrer or referee)"
ON public.referral_conversions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id IN (referral_conversions.referrer_org_id, referral_conversions.referee_org_id)
  ) OR public.has_role(auth.uid(), 'superadmin')
);

CREATE POLICY "Superadmin manages conversions"
ON public.referral_conversions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- 4) referral_rewards_config (un solo registro global por defecto)
CREATE TABLE public.referral_rewards_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text UNIQUE,
  referrer_reward_amount numeric(12,2) NOT NULL DEFAULT 50000,
  referrer_reward_currency text NOT NULL DEFAULT 'COP',
  referee_discount_pct numeric(5,2) NOT NULL DEFAULT 20.00,
  qualifying_period_days int NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_rewards_config TO authenticated, anon;
GRANT ALL ON public.referral_rewards_config TO service_role;

ALTER TABLE public.referral_rewards_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active reward config"
ON public.referral_rewards_config FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Superadmin manages reward config"
ON public.referral_rewards_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- 5) Trigger updated_at compartido
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_referral_conversions_updated_at
  BEFORE UPDATE ON public.referral_conversions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_referral_rewards_config_updated_at
  BEFORE UPDATE ON public.referral_rewards_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6) Seed: configuración global por defecto
INSERT INTO public.referral_rewards_config (plan_code, referrer_reward_amount, referee_discount_pct)
VALUES (NULL, 50000, 20.00)
ON CONFLICT DO NOTHING;
