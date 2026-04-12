-- Add customer_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_code text UNIQUE;

-- Create sequence for customer codes
CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq START WITH 1;

-- Function to auto-generate customer_code
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := 'CLI-' || LPAD(nextval('public.customer_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate code on profile insert
DROP TRIGGER IF EXISTS trg_generate_customer_code ON public.profiles;
CREATE TRIGGER trg_generate_customer_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_customer_code();

-- Add agent fields to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS agent_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_profile_id uuid;

-- RLS: Agents can read profiles for customer lookup
CREATE POLICY "Agents can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'agente'::app_role));

-- RLS: Agents can create orders on behalf of customers
CREATE POLICY "Agents can create orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'agente'::app_role));

-- RLS: Agents can view orders they created
CREATE POLICY "Agents can view their orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid() AND has_role(auth.uid(), 'agente'::app_role));

-- Backfill existing profiles with customer codes
UPDATE public.profiles
SET customer_code = 'CLI-' || LPAD(nextval('public.customer_code_seq')::text, 4, '0')
WHERE customer_code IS NULL;