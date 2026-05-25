
CREATE TABLE IF NOT EXISTS public.sso_handoff_tokens (
  nonce uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  target_tenant text,
  issuer_ip text,
  issuer_ua text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sso_tokens_expires ON public.sso_handoff_tokens(expires_at);

ALTER TABLE public.sso_handoff_tokens ENABLE ROW LEVEL SECURITY;

-- Sin policies → ningún rol authenticated/anon puede tocarla.
-- Solo `service_role` (que bypassa RLS) la usa desde las edge functions.

CREATE OR REPLACE FUNCTION public.cleanup_sso_tokens()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.sso_handoff_tokens WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.cleanup_sso_tokens() FROM PUBLIC, anon, authenticated;
